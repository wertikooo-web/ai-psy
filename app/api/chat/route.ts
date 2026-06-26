import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getConsultation } from "@/lib/data/consultations";
import { getClientById } from "@/lib/data/clients";
import { getMaterialsForClient } from "@/lib/data/clientMaterials";
import { readProfile } from "@/lib/data/userProfile";
import type { FormattedSegment } from "@/lib/consultationStore";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0)
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function segmentsToText(segs: FormattedSegment[]): string {
  return segs
    .map((s) => {
      const who = s.speaker === "therapist" ? "Психолог" : s.speaker === "client" ? "Клиент" : "Другой";
      const ts  = s.start_seconds > 0 ? `[${fmtTime(s.start_seconds)}] ` : "";
      return `${ts}${who}: ${s.text}`;
    })
    .join("\n");
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, consultationId } = body as {
      messages:       Array<{ role: string; content: string }>;
      consultationId?: string;
    };

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "messages обязательны" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY не задан" }, { status: 500 });
    }

    // ── Load context from DB ──────────────────────────────────────────────────
    let clientName       = "";
    let clientAge        = "";
    let clientConcern    = "";
    let clientMaterials  = "";
    let transcriptBlock  = "";
    let analysisBlock    = "";
    let consultationMeta = "";
    let analysisStatus   = "";

    if (consultationId) {
      const [consultation] = await Promise.all([getConsultation(consultationId)]);

      if (consultation) {
        // Consultation meta
        const dateStr = consultation.createdAt
          ? new Date(consultation.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
          : "";
        consultationMeta = `Консультация: ${consultation.title || "Без названия"}${dateStr ? ` — ${dateStr}` : ""}`;

        clientName = consultation.clientName || "";

        // Client card from DB (name, age, concern)
        if (consultation.clientId) {
          const [client, materials] = await Promise.all([
            getClientById(consultation.clientId),
            getMaterialsForClient(consultation.clientId).catch(() => []),
          ]);

          if (client) {
            clientName    = client.name || clientName;
            clientAge     = client.age ? `${client.age} лет` : "";
            clientConcern = client.concern || "";
          }

          // Client materials (exclude therapist_notes — private)
          const publicMaterials = materials.filter(m => m.type !== "therapist_notes");
          if (publicMaterials.length > 0) {
            clientMaterials = publicMaterials
              .map(m => `[${m.title || m.type}]\n${m.content.slice(0, 600)}`)
              .join("\n\n")
              .slice(0, 3000);
          }
        }

        // Transcript: prefer formatted segments (with speakers), fall back to raw text
        if (consultation.transcriptFormatted?.length) {
          const text = segmentsToText(consultation.transcriptFormatted);
          // Limit: 14 000 chars ≈ 3 500 tokens
          transcriptBlock = text.length > 14_000 ? text.slice(0, 14_000) + "\n[...транскрипт обрезан...]" : text;
        } else if (consultation.transcript?.text) {
          const raw = consultation.transcript.text;
          transcriptBlock = raw.length > 14_000 ? raw.slice(0, 14_000) + "\n[...транскрипт обрезан...]" : raw;
        }

        // AI analyses — group by mode, use the most recent per mode
        const allAnalyses = consultation.analyses ?? [];
        if (allAnalyses.length > 0) {
          // The most recent overall analysis for the main block
          const lastAnalysis = allAnalyses[allAnalyses.length - 1];
          const analysisAt   = lastAnalysis.createdAt ? new Date(lastAnalysis.createdAt).getTime() : 0;
          const transcriptAt = consultation.transcript?.createdAt
            ? new Date(consultation.transcript.createdAt).getTime()
            : 0;
          const isStale = transcriptAt > 0 && analysisAt > 0 && transcriptAt > analysisAt;
          analysisStatus = isStale ? "устаревший (транскрипт обновлён после анализа)" : "актуальный";

          const MODE_LABELS: Record<string, string> = {
            working: "Рабочий анализ", deep: "Глубокий анализ",
            hypothesis: "Гипотезы", therapist_process: "Работа психолога",
            gestalt: "Гештальт-анализ", next_session: "Следующая сессия",
          };

          // Build per-mode map (last wins)
          const byMode = new Map<string, { result: string }>();
          for (const a of allAnalyses) byMode.set(a.mode, a);

          // Combine all analyses into one block (newest mode first), truncate total
          let combined = "";
          for (const [mode, a] of byMode) {
            const label = MODE_LABELS[mode] ?? mode;
            const chunk = a.result.length > 3_000 ? a.result.slice(0, 3_000) + "…" : a.result;
            combined += `\n\n### ${label}\n${chunk}`;
            if (combined.length > 8_000) break;
          }
          analysisBlock = combined.trim();
        }
      }
    }

    // ── System prompt ─────────────────────────────────────────────────────────
    const clientInfo = [
      clientName    ? `Клиент: ${clientName}` : null,
      clientAge     ? `Возраст: ${clientAge}` : null,
      clientConcern ? `Запрос: ${clientConcern}` : null,
    ].filter(Boolean).join("\n");

    const systemPrompt = `Ты — AI-ассистент внутри психологической консультации. Ты помогаешь психологу анализировать сессию, замечать паттерны, готовиться к следующей встрече.

${clientInfo ? `ТЕКУЩИЙ КЛИЕНТ:\n${clientInfo}` : ""}
${consultationMeta ? `\n${consultationMeta}` : ""}

Правила работы:
- Опирайся на данные, которые тебе переданы ниже — транскрипт, анализ, карточку клиента.
- Если информация о клиенте присутствует в контексте — используй её. Не говори, что у тебя нет информации о клиенте.
- Отделяй факты из транскрипта от выводов AI-анализа.
- Не придумывай диагнозы и факты, которых нет в материалах.
- Если информации действительно недостаточно — укажи чего именно не хватает.
- Отвечай на русском языке.
- По умолчанию краткий ответ (2–4 предложения), если не просят развернуть.
- Профессиональный, но живой тон — поддерживаешь, не критикуешь.`

    + (transcriptBlock
      ? `\n\n---\nТРАНСКРИПТ СЕССИИ${transcriptBlock.includes("Психолог:") || transcriptBlock.includes("Клиент:") ? " (с разметкой по репликам)" : ""}:\n${transcriptBlock}\n---`
      : "\n\n(Транскрипт этой сессии недоступен)")

    + (analysisBlock
      ? `\n\n---\nAI-АНАЛИЗ СЕССИИ (${analysisStatus}):\n${analysisBlock}\n---`
      : "")

    + (clientMaterials
      ? `\n\n---\nМАТЕРИАЛЫ ПО КЛИЕНТУ:\n${clientMaterials}\n---`
      : "");

    // ── Call model ────────────────────────────────────────────────────────────
    const profile = await readProfile();
    const model   = profile.aiModel ?? "gpt-4o";

    const openai = new OpenAI({ apiKey });

    const isOModel = /^o\d/.test(model);
    const completion = await openai.chat.completions.create({
      model,
      ...(isOModel ? {} : { temperature: 0.7 }),
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({
          role:    m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
      max_tokens: 800,
    });

    const reply = completion.choices[0]?.message?.content ?? "Не удалось получить ответ.";
    return NextResponse.json({ reply });

  } catch (err) {
    console.error("[api/chat]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка" },
      { status: 500 },
    );
  }
}
