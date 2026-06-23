import { NextRequest, NextResponse } from "next/server";
import { buildAnalysisPrompt, getKnowledgeFilesForMode } from "@/lib/knowledgeBase";
import type { AnalysisMode } from "@/lib/knowledgeBase";
import type { LLMProvider } from "@/lib/llm";
import path from "path";
import fs from "fs/promises";

const KB_DIR = path.join(process.cwd(), "knowledge_base");

/**
 * POST /api/debug-analysis
 * Pure debug — NO OpenAI call. Returns assembled prompt info only.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const mode:          AnalysisMode = body.mode          ?? "working";
    const provider:      LLMProvider  = body.provider      ?? "openai";
    const transcript:    string       = body.transcript    ?? "(транскрипт не передан)";
    const clientContext: string | undefined = body.clientContext;

    // 1. Resolve file list for this mode
    const usedFiles = getKnowledgeFilesForMode(mode);

    // 2. Check which files actually exist on disk
    const missingFiles: string[] = [];
    for (const f of usedFiles) {
      try {
        await fs.access(path.join(KB_DIR, f));
      } catch {
        missingFiles.push(f);
      }
    }

    // 3. Build the full prompt (reads files from disk)
    const fullPrompt = await buildAnalysisPrompt({ mode, transcript, clientContext });

    // 4. Verify 000_CORE_INSTRUCTIONS.md is first
    const coreFile = "000_CORE_INSTRUCTIONS.md";
    const coreIsFirst = usedFiles[0] === coreFile;

    return NextResponse.json({
      mode,
      provider,
      usedFiles,
      missingFiles,
      coreIsFirst,
      promptLength:  fullPrompt.length,
      promptPreview: fullPrompt.slice(0, 1500),
      mockResponse:  `[MOCK ${provider.toUpperCase()} response] — prompt ${fullPrompt.length} chars, ${usedFiles.length} KB files loaded`,
    });

  } catch (err) {
    console.error("[debug-analysis]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
