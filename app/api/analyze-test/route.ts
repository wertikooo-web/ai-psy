import { NextRequest, NextResponse } from "next/server";
import { generateAnalysis } from "@/lib/analysisService";
import { getKnowledgeFilesForMode } from "@/lib/knowledgeBase";
import type { AnalysisMode } from "@/lib/knowledgeBase";
import type { LLMProvider } from "@/lib/llm";

/**
 * POST /api/analyze-test
 *
 * Body:
 * {
 *   "mode":          "working" | "deep" | "therapist_process" | "gestalt",
 *   "transcript":    "текст консультации",
 *   "clientContext": "контекст клиента"  (optional)
 *   "provider":      "openai"            (optional, default: openai)
 *   "model":         "gpt-4o"            (optional)
 * }
 *
 * Response:
 * {
 *   "analysis":   "текст анализа от LLM",
 *   "usedFiles":  ["000_CORE_INSTRUCTIONS.md", ...],
 *   "provider":   "openai",
 *   "model":      "gpt-4o",
 *   "promptTokens":     N,
 *   "completionTokens": N
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const mode:          AnalysisMode = body.mode          ?? "working";
    const transcript:    string       = body.transcript    ?? "";
    const clientContext: string | undefined = body.clientContext;
    const provider:      LLMProvider  = body.provider      ?? "openai";
    const model:         string | undefined = body.model;

    if (!transcript.trim()) {
      return NextResponse.json(
        { error: "Поле transcript обязательно" },
        { status: 400 }
      );
    }

    const result = await generateAnalysis({
      mode,
      transcript,
      clientContext,
      provider,
      model,
    });

    return NextResponse.json({
      analysis:         result.text,
      usedFiles:        result.knowledgeFiles,
      provider:         result.provider,
      model:            result.model,
      promptTokens:     result.promptTokensEstimate,
      completionTokens: undefined, // available from provider directly if needed
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[analyze-test]", message);

    // Surface key errors clearly
    const status = message.includes("OPENAI_API_KEY") ? 400
                 : message.includes("429")            ? 429
                 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
