/**
 * GET  /api/evidence/[id]  — return existing evidence (or null + isStale flag)
 * POST /api/evidence/[id]  — (re)generate evidence from current transcript
 *
 * Never touches audio, FFmpeg, or Whisper.
 * Source: transcript_formatted if present, else transcript_text.
 */

import { NextRequest, NextResponse } from "next/server";
import { getConsultation, updateConsultation } from "@/lib/data/consultations";
import { buildEvidence, transcriptHash, canonicalTranscriptText } from "@/lib/evidenceService";
import { readProfile } from "@/lib/data/userProfile";

export const maxDuration = 120;

// ── GET: return current evidence + staleness check ───────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const consultation = await getConsultation(id);
  if (!consultation) {
    return NextResponse.json({ error: "Консультация не найдена" }, { status: 404 });
  }

  const currentText = canonicalTranscriptText(
    consultation.transcriptFormatted,
    consultation.transcript?.text,
  );

  const evidence = consultation.analysisEvidence ?? null;
  const currentHash = currentText ? transcriptHash(currentText) : null;
  const isStale = evidence !== null && currentHash !== null && evidence.source.sourceHash !== currentHash;
  const hasTranscript = Boolean(currentText);

  return NextResponse.json({ evidence, isStale, hasTranscript });
}

// ── POST: generate or regenerate evidence ────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const consultation = await getConsultation(id);
  if (!consultation) {
    return NextResponse.json({ error: "Консультация не найдена" }, { status: 404 });
  }

  const transcriptText = consultation.transcript?.text ?? "";
  const transcriptFormatted = consultation.transcriptFormatted?.length
    ? consultation.transcriptFormatted
    : undefined;

  if (!transcriptText && !transcriptFormatted) {
    return NextResponse.json(
      { error: "Транскрипт отсутствует — evidence невозможно построить" },
      { status: 400 },
    );
  }

  try {
    const profile = await readProfile();
    const model   = profile.aiModel ?? "gpt-4o";

    const evidence = await buildEvidence({
      consultationId: id,
      transcriptText,
      transcriptFormatted,
      model,
    });

    await updateConsultation(id, { analysisEvidence: evidence });

    return NextResponse.json({ evidence });
  } catch (err) {
    console.error("[api/evidence]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка генерации evidence" },
      { status: 500 },
    );
  }
}
