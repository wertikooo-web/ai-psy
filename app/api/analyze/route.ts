import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getConsultation, updateConsultation } from "@/lib/data/consultations";
import { generateAnalysis } from "@/lib/analysisService";
import type { AnalysisMode } from "@/lib/knowledgeBase";
import { getClients as readAllClients } from "@/lib/data/clients";
import { getHistoryForClient as getHistory } from "@/lib/data/clientHistory";
import { getMaterialsForClient as getMaterials } from "@/lib/data/clientMaterials";
import { getConsultations as readAllConsultations } from "@/lib/data/consultations";
import { readProfile } from "@/lib/data/userProfile";

export async function POST(req: NextRequest) {
  try {
    const { consultationId, mode } = await req.json();

    if (!consultationId || !mode) {
      return NextResponse.json({ error: "consultationId и mode обязательны" }, { status: 400 });
    }

    const consultation = await getConsultation(consultationId);
    if (!consultation) {
      return NextResponse.json({ error: "Консультация не найдена" }, { status: 404 });
    }

    // Priority: Whisper/uploaded transcript > psychologist notes
    const hasTranscript = !!consultation.transcript?.text;
    const hasNotes      = !!consultation.notes;
    const rawText       = consultation.transcript?.text ?? consultation.notes ?? null;

    if (!rawText) {
      return NextResponse.json({ error: "Нет текста для анализа. Добавьте транскрипт или заметки." }, { status: 400 });
    }

    // Tell AI what kind of text it's dealing with
    const transcript = hasTranscript
      ? rawText
      : `[КОНТЕКСТ: Это заметки психолога о сессии, а не дословная стенограмма. Психолог описывает своими словами что происходило.]\n\n${rawText}`;

    // Build clientContext from stored data
    const clientContext = await assembleClientContext(
      consultation.clientId,
      consultation.clientName,
      consultationId,
    );

    // Mark as analyzing
    await updateConsultation(consultationId, { status: "analyzing" });

    // Read model from user profile settings
    const profile = await readProfile();
    const model = profile.aiModel ?? "gpt-4o";

    const output = await generateAnalysis({
      mode: mode as AnalysisMode,
      transcript,
      clientContext: clientContext || undefined,
      provider: "openai",
      model,
    });

    // Persist result
    const entry = {
      id:        randomUUID(),
      mode,
      result:    output.text,
      createdAt: new Date().toISOString(),
    };

    const existingAnalyses = consultation.analyses ?? [];
    await updateConsultation(consultationId, {
      status:   "done",
      analyses: [...existingAnalyses, entry],
    });

    return NextResponse.json({
      id:       entry.id,
      result:   output.text,
      mode,
      model:    output.model,
      provider: output.provider,
    });

  } catch (err) {
    console.error("[analyze]", err);
    // Reset status so the user can retry
    try {
      const { consultationId } = await req.clone().json().catch(() => ({}));
      if (consultationId) await updateConsultation(consultationId, { status: "ready" });
    } catch { /* ignore */ }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка анализа" },
      { status: 500 },
    );
  }
}

// ── clientContext builder ────────────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  main_topics:         "Основные темы",
  hypotheses:          "Гипотезы",
  resources:           "Ресурсы",
  significant_events:  "Значимые события",
  explored:            "Проработано",
  needs_clarification: "Требует прояснения",
  notes:               "Заметки",
};

async function assembleClientContext(
  clientId: string,
  fallbackName: string,
  currentConsultationId: string,
): Promise<string> {
  const parts: string[] = [];

  // 1. Client card
  try {
    const clients = await readAllClients();
    const client  = clients.find((c) => c.id === clientId);
    if (client) {
      parts.push(`Клиент: ${client.name}`);
      if (client.concern)              parts.push(`Запрос: ${client.concern}`);
      if (client.mainTopics?.length)   parts.push(`Темы работы: ${client.mainTopics.join(", ")}`);
      if (client.currentFocus)         parts.push(`Текущий фокус: ${client.currentFocus}`);
    } else {
      parts.push(`Клиент: ${fallbackName}`);
    }
  } catch {
    parts.push(`Клиент: ${fallbackName}`);
  }

  // 2. Client history (structured, grouped by section)
  try {
    const history = await getHistory(clientId);
    if (history.length > 0) {
      parts.push("\nИстория клиента:");
      const grouped: Record<string, string[]> = {};
      for (const item of history) {
        (grouped[item.section] ??= []).push(item.text);
      }
      for (const [section, items] of Object.entries(grouped)) {
        parts.push(`${SECTION_LABELS[section] ?? section}: ${items.join("; ")}`);
      }
    }
  } catch { /* no history yet */ }

  // 3. Materials (up to 10, up to 2000 chars each — therapist_notes excluded, private)
  try {
    const materials = await getMaterials(clientId);
    const forGPT = materials.filter((m) => m.type !== "therapist_notes");
    if (forGPT.length > 0) {
      parts.push("\nМатериалы клиента:");
      for (const m of forGPT.slice(0, 10)) {
        const label   = m.title ? `${m.title} [${m.type}]` : `[${m.type}]`;
        const preview = m.content.length > 2000
          ? m.content.slice(0, 2000) + "…"
          : m.content;
        parts.push(`${label}:\n${preview}`);
      }
    }
  } catch { /* no materials yet */ }

  // 4. Previous consultations with analyses (excluding current)
  try {
    const allConsults = await readAllConsultations();
    const prev = allConsults.filter(
      (c) => c.clientId === clientId &&
             c.id !== currentConsultationId &&
             c.analyses?.length,
    );
    if (prev.length > 0) {
      parts.push("\nПредыдущие анализы:");
      for (const p of prev.slice(0, 2)) {
        const lastAnalysis = p.analyses![p.analyses!.length - 1];
        const preview = lastAnalysis.result.length > 400
          ? lastAnalysis.result.slice(0, 400) + "…"
          : lastAnalysis.result;
        parts.push(`[${p.title} · ${lastAnalysis.mode}]\n${preview}`);
      }
    }
  } catch { /* ok */ }

  return parts.join("\n");
}
