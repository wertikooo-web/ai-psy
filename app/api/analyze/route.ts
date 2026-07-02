import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getConsultation, updateConsultation } from "@/lib/data/consultations";
import { buildEvidence, transcriptHash, canonicalTranscriptText } from "@/lib/evidenceService";
import {
  generateAnalysis,
  extractBlocks,
  buildCompressedTranscript,
  TOKEN_BUDGET_PER_REQUEST,
  CHARS_PER_TOKEN,
} from "@/lib/analysisService";
import type { AnalysisMode } from "@/lib/knowledgeBase";
import { getClientById } from "@/lib/data/clients";
import { getHistoryForClient as getHistory } from "@/lib/data/clientHistory";
import { getMaterialsForClient as getMaterials } from "@/lib/data/clientMaterials";
import { getConsultationsForClient } from "@/lib/data/consultations";
import { readProfile } from "@/lib/data/userProfile";
import { getClientRequestById, getCurrentClientRequest } from "@/lib/data/clientRequests";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let consultationId: string | undefined;
  let mode: string | undefined;
  try {
    const body = await req.json();
    consultationId = body.consultationId as string | undefined;
    mode           = body.mode           as string | undefined;
    const force: boolean = body.force ?? false;

    if (!consultationId || !mode) {
      return NextResponse.json({ error: "consultationId и mode обязательны" }, { status: 400 });
    }

    const consultation = await getConsultation(consultationId);
    if (!consultation) {
      return NextResponse.json({ error: "Консультация не найдена" }, { status: 404 });
    }

    const existingAnalyses = consultation.analyses ?? [];

    // Protect against duplicate generation: if already generating (status=analyzing),
    // return 409. If exists and !force, return the cached result immediately.
    if (!force) {
      const existing = existingAnalyses.find(a => a.mode === mode);
      if (existing) {
        return NextResponse.json({
          id:        existing.id,
          result:    existing.result,
          blocks:    existing.blocks,
          mode,
          model:     "cached",
          provider:  "cache",
          fromCache: true,
        });
      }
    }

    // Priority: formatted segments > raw transcript > psychologist notes
    const hasFormatted  = (consultation.transcriptFormatted?.length ?? 0) > 0;
    const hasTranscript = !!consultation.transcript?.text;
    const hasNotes      = !!consultation.notes;

    if (!hasFormatted && !hasTranscript && !hasNotes) {
      return NextResponse.json({ error: "Нет текста для анализа. Добавьте транскрипт или заметки." }, { status: 400 });
    }

    // Build transcript string for AI
    let transcript: string;

    if (hasFormatted) {
      // Format segments as readable dialogue with timecodes
      const speakerLabel = (s: string) => s === "therapist" ? "Психолог" : s === "client" ? "Клиент" : "Неизвестно";
      const fmtTime = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = Math.floor(sec % 60);
        return h > 0
          ? `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`
          : `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
      };
      transcript = consultation.transcriptFormatted!
        .map((seg) => `[${fmtTime(seg.start_seconds)}] ${speakerLabel(seg.speaker)}:\n${seg.text}`)
        .join("\n\n");
    } else if (hasTranscript) {
      transcript = consultation.transcript!.text;
    } else {
      transcript = `[КОНТЕКСТ: Это заметки психолога о сессии, а не дословная стенограмма. Психолог описывает своими словами что происходило.]\n\n${consultation.notes!}`;
    }

    // Build clientContext from stored data
    const clientContext = await assembleClientContext(
      consultation.clientId,
      consultation.clientName,
      consultationId,
      consultation.requestId,
    );

    // Mark as analyzing
    await updateConsultation(consultationId, { status: "analyzing" });

    // Read model and style settings from user profile
    const profile        = await readProfile();
    const model          = profile.aiModel       ?? "gpt-4o";
    const analysisStyle  = profile.analysisStyle  ?? "professional";
    const analysisLength = profile.analysisLength ?? "standard";

    console.log("AI_SETTINGS_RESOLVED", {
      mode,
      model,
      analysisStyle,
      analysisLength,
      hasCustomInstruction: !!(profile.aiInstructions?.trim()),
    });

    // Build canonical text and compute hash (single source of truth for staleness)
    const canonicalText = canonicalTranscriptText(
      consultation.transcriptFormatted,
      consultation.transcript?.text,
    );
    const currentHash = transcriptHash(canonicalText);

    // ── Evidence staleness ────────────────────────────────────────────────────
    const storedEvidence  = consultation.analysisEvidence;
    const evidenceIsStale = !storedEvidence || storedEvidence.source.sourceHash !== currentHash;

    // ── Compressed transcript cache ───────────────────────────────────────────
    // If the transcript needs chunking, check whether we already have a fresh
    // compressed version. If yes, skip all compressChunk LLM calls entirely.
    const needsChunking = Math.round(canonicalText.length / CHARS_PER_TOKEN) > TOKEN_BUDGET_PER_REQUEST;
    const storedCompressed = consultation.compressedTranscript;
    const compressedIsStale =
      needsChunking &&
      (!storedCompressed || storedCompressed.sourceHash !== currentHash);

    let effectiveTranscript = transcript; // default: use the formatted dialogue transcript

    if (needsChunking) {
      if (!compressedIsStale && storedCompressed) {
        // Cache HIT — zero compressChunk calls, zero sleep
        effectiveTranscript = storedCompressed.text;
        console.log(`[analyze] mode=${mode} compressedTranscript=HIT hash=${currentHash.slice(0, 8)} chunks=${storedCompressed.chunksCount}`);
      } else {
        // Cache MISS — build fresh compression
        console.log(`[analyze] mode=${mode} compressedTranscript=MISS hash=${currentHash.slice(0, 8)} reason=${!storedCompressed ? "absent" : "stale"}`);
        const built = await buildCompressedTranscript({
          transcriptText: canonicalText,
          sourceHash:     currentHash,
          model,
          provider:       "openai",
        });
        effectiveTranscript = built.text;
        // Save BEFORE generateAnalysis so the next request always finds it in DB.
        // Wrapped in try/catch: if save fails, analysis still completes; next request rebuilds.
        try {
          await updateConsultation(consultationId, {
            compressedTranscript: { version: "1.0", ...built },
          });
          console.log(`[analyze] mode=${mode} compressedTranscript=SAVED chunks=${built.chunksCount}`);
        } catch (err) {
          console.error("[analyze] compressedTranscript save failed (analysis continues):", err);
        }
      }
    } else {
      console.log(`[analyze] mode=${mode} compressedTranscript=SKIP (short transcript, ${canonicalText.length} chars)`);
    }

    // Run analysis and evidence build in parallel.
    // effectiveTranscript is already compressed (or short) — no chunking inside generateAnalysis.
    const [output, freshEvidence] = await Promise.all([
      generateAnalysis({
        mode: mode as AnalysisMode,
        transcript:        effectiveTranscript,
        clientContext:     clientContext || undefined,
        provider:          "openai",
        model,
        styleHint:         analysisStyle,
        lengthHint:        analysisLength,
        extraInstructions: profile.aiInstructions ?? "",
        analysisEvidence:  storedEvidence ?? undefined,
      }),
      evidenceIsStale
        ? buildEvidence({
            consultationId,
            transcriptText:      canonicalText,
            transcriptFormatted: consultation.transcriptFormatted?.length
              ? consultation.transcriptFormatted
              : undefined,
            model,
          })
        : Promise.resolve(storedEvidence!),
    ]);

    // Save fresh evidence if it was (re)built
    if (evidenceIsStale) {
      updateConsultation(consultationId, { analysisEvidence: freshEvidence }).catch(
        (err) => console.error("[analyze] evidence save failed:", err),
      );
    }

    // Extract blocks synchronously so lupa icons appear immediately in UI
    const blocks = await extractBlocks(output.text, freshEvidence, model, "openai");

    // Persist result + blocks + settings metadata
    const entry = {
      id:             randomUUID(),
      mode,
      result:         output.text,
      blocks:         blocks.length > 0 ? blocks : undefined,
      createdAt:      new Date().toISOString(),
      model:          output.model,
      analysisStyle,
      analysisLength,
    };

    console.log("AI_REQUEST_CONFIG", {
      operation:   "analysis",
      mode,
      provider:    output.provider,
      model:       output.model,
      style:       analysisStyle,
      length:      analysisLength,
      blocks:      blocks.length,
    });

    const withoutCurrent = existingAnalyses.filter(a => a.mode !== mode);
    await updateConsultation(consultationId, {
      status:   "done",
      analyses: [...withoutCurrent, entry],
    });

    console.log(`[analyze] consultationId=${consultationId} mode=${mode} blocks=${blocks.length}`);

    return NextResponse.json({
      id:       entry.id,
      result:   output.text,
      blocks:   entry.blocks,
      mode,
      model:    output.model,
      provider: output.provider,
    });

  } catch (err) {
    console.error("[analyze]", err);
    if (consultationId) {
      await updateConsultation(consultationId, { status: "ready" }).catch(() => {});
    }
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
  requestId?: string | null,
): Promise<string> {
  // All sources fetched in parallel — sequential was ~500-1400ms, parallel is ~100-300ms
  const [client, history, materials, clientConsults, linkedRequest] = await Promise.allSettled([
    getClientById(clientId),
    getHistory(clientId),
    getMaterials(clientId),
    getConsultationsForClient(clientId),
    // Priority: request linked to this consultation → current client request
    requestId
      ? getClientRequestById(requestId)
      : getCurrentClientRequest(clientId),
  ]);

  const parts: string[] = [];

  // 1. Client card
  const clientData = client.status === "fulfilled" ? client.value : null;
  if (clientData) {
    parts.push(`Клиент: ${clientData.name}`);

    // Request text: linked request > current request > legacy clients.concern
    const reqData = linkedRequest.status === "fulfilled" ? linkedRequest.value : null;
    const requestText = reqData?.text ?? (clientData.concern || undefined);
    if (requestText) parts.push(`Запрос: ${requestText}`);

    if (clientData.mainTopics?.length)   parts.push(`Темы работы: ${clientData.mainTopics.join(", ")}`);
    if (clientData.currentFocus)         parts.push(`Текущий фокус: ${clientData.currentFocus}`);
  } else {
    parts.push(`Клиент: ${fallbackName}`);
  }

  // 2. Client history (structured, grouped by section)
  const historyItems = history.status === "fulfilled" ? history.value : [];
  if (historyItems.length > 0) {
    parts.push("\nИстория клиента:");
    const grouped: Record<string, string[]> = {};
    for (const item of historyItems) {
      (grouped[item.section] ??= []).push(item.text);
    }
    for (const [section, items] of Object.entries(grouped)) {
      parts.push(`${SECTION_LABELS[section] ?? section}: ${items.join("; ")}`);
    }
  }

  // 3. Materials (up to 10, up to 2000 chars each — therapist_notes excluded, private)
  const allMaterials = materials.status === "fulfilled" ? materials.value : [];
  const forGPT = allMaterials.filter((m) => m.type !== "therapist_notes");
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

  // 4. Previous consultations with analyses for this client only (excluding current)
  const allConsults = clientConsults.status === "fulfilled" ? clientConsults.value : [];
  const prev = allConsults.filter(
    (c) => c.id !== currentConsultationId && c.analyses?.length,
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

  return parts.join("\n");
}
