import { NextRequest, NextResponse } from "next/server";
import { getConsultation } from "@/lib/data/consultations";
import { buildAnalysisPrompt, getKnowledgeFilesForMode } from "@/lib/knowledgeBase";
import type { AnalysisMode } from "@/lib/knowledgeBase";
import { readProfile } from "@/lib/data/userProfile";

export async function POST(req: NextRequest) {
  const { consultationId, mode = "working" } = await req.json();

  const profile = await readProfile();
  const model = profile.aiModel ?? "gpt-4o";

  let transcriptRaw = "(нет транскрипта)";
  let transcript    = transcriptRaw;

  if (consultationId) {
    const c = await getConsultation(consultationId);
    if (c?.transcript?.text) {
      transcriptRaw = c.transcript.text;
      transcript = c.source === "notes"
        ? `[КОНТЕКСТ: заметки]\n\n${transcriptRaw}`
        : transcriptRaw;
    }
  }

  const knowledgeFiles = getKnowledgeFilesForMode(mode as AnalysisMode);
  const prompt         = await buildAnalysisPrompt({ mode: mode as AnalysisMode, transcript });
  const promptChars    = prompt.length;
  const promptTokens   = Math.round(promptChars / 4);

  const maxTokensByMode: Record<string, number> = {
    working: 3000, deep: 6000, therapist_process: 4000,
    gestalt: 4000, hypothesis: 3000, next_session: 2500,
  };

  return NextResponse.json({
    provider:           "openai",
    model,
    mode,
    knowledgeFiles,
    transcriptLength:   transcriptRaw.length,
    transcriptTruncated: false,
    promptChars,
    promptTokensEstimate: promptTokens,
    maxOutputTokens:    maxTokensByMode[mode] ?? 3000,
    promptPreview:      prompt.slice(0, 800) + "\n\n... [обрезано для preview]",
  });
}
