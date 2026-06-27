import { NextRequest, NextResponse } from "next/server";
import {
  buildAnalysisPrompt,
  getKnowledgeFilesForMode,
  AnalysisMode,
} from "@/lib/knowledgeBase";

/**
 * GET /api/preview-prompt?mode=working
 *   → returns the list of KB files for that mode
 *
 * POST /api/preview-prompt
 *   body: { mode, transcript, clientContext? }
 *   → builds and returns the full prompt (console.log + JSON response)
 *   No LLM call — just prompt assembly.
 */

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const mode = (req.nextUrl.searchParams.get("mode") ?? "working") as AnalysisMode;
  const files = getKnowledgeFilesForMode(mode);

  return NextResponse.json({ mode, files });
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const body = await req.json();

    const mode: AnalysisMode = body.mode ?? "working";
    const transcript: string = body.transcript ?? "(транскрипт не передан)";
    const clientContext: string | undefined = body.clientContext;

    const prompt = await buildAnalysisPrompt({ mode, transcript, clientContext });

    // Print to server console so developer can inspect without a frontend
    console.log("\n========== PREVIEW PROMPT ==========");
    console.log(`Mode: ${mode}`);
    console.log("-------------------------------------");
    console.log(prompt.slice(0, 3000) + (prompt.length > 3000 ? "\n...[truncated]" : ""));
    console.log("====================================\n");

    return NextResponse.json({
      mode,
      files:  getKnowledgeFilesForMode(mode),
      chars:  prompt.length,
      tokens: Math.round(prompt.length / 4), // rough estimate
      prompt,
    });
  } catch (err) {
    console.error("[preview-prompt]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
