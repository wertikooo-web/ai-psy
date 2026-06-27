import { buildAnalysisPrompt, getKnowledgeFilesForMode, type AnalysisMode } from "./knowledgeBase";
import { getProvider, DEFAULT_PROVIDER, type LLMProvider } from "./llm";
import type { AnalysisEvidence } from "./consultationStore";
import type { AnalysisBlock } from "./analysisBlocks";
import {
  prepareEvidenceForAnalysis,
  buildBlockExtractionPrompt,
  BlocksOutputSchema,
} from "./analysisBlocks";

// ── Types ────────────────────────────────────────────────────────────────────

export interface GenerateAnalysisInput {
  mode: AnalysisMode;
  transcript: string;
  clientContext?: string;
  provider?: LLMProvider;
  model?: string;
  temperature?: number;
  styleHint?: "professional" | "simple" | "academic";
  lengthHint?: "brief" | "standard" | "detailed";
  extraInstructions?: string;
  analysisEvidence?: AnalysisEvidence;
}

export interface GenerateAnalysisOutput {
  text: string;
  mode: AnalysisMode;
  provider: LLMProvider;
  model: string;
  knowledgeFiles: string[];
  promptChars: number;
  promptTokensEstimate: number;
}

// ── Block extraction (second pass, short LLM call) ────────────────────────────

export async function extractBlocks(
  analysisText: string,
  evidence: AnalysisEvidence,
  model: string | undefined,
  providerName: LLMProvider,
): Promise<AnalysisBlock[]> {
  const prepared = prepareEvidenceForAnalysis(evidence);
  const { systemPrompt, userPrompt } = buildBlockExtractionPrompt(analysisText, prepared);

  const providerClient = getProvider(providerName);
  let raw: string;
  try {
    const result = await providerClient.generateText({
      systemPrompt,
      userPrompt,
      model,
      temperature: 0.1,
      maxTokens:   4000,
    });
    raw = result.text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error(`[analysisBlocks] LLM call failed: ${msg}`);
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error(`[analysisBlocks] JSON parse failed, len=${raw.length}`);
    return [];
  }

  const validated = BlocksOutputSchema.safeParse(parsed);
  if (!validated.success) {
    console.error(`[analysisBlocks] Zod failed: ${validated.error.issues.length} issues`);
    return [];
  }

  return validated.data.blocks as AnalysisBlock[];
}

// ── Token budget constants ────────────────────────────────────────────────────

// OpenAI free/low-tier TPM limit is ~30 000.
// Working mode KB = 9 files ≈ 100k chars ≈ 17 000–22 000 tokens (Cyrillic tokenizes at ~4–6 chars/token).
// clientContext + evidence ≈ 3 000 tokens. Output ≈ 3 000–6 000 tokens.
// That leaves ~4 000–7 000 tokens for the transcript → ~8 000–12 000 chars.
export const TOKEN_BUDGET_PER_REQUEST   = 8_000;  // trigger chunking when transcript alone > 8k tokens
export const CHARS_PER_TOKEN            = 1.5;    // conservative lower-bound (real Cyrillic rate is ~4–6 chars/token)
const CHUNK_CHARS                       = Math.floor(8_000 * CHARS_PER_TOKEN); // ~12 000 chars per chunk
// Hard cap applied before final LLM analysis call — keeps total prompt under 30k TPM
const TRANSCRIPT_FINAL_CAP_CHARS        = 12_000; // ~8 000 tokens at 1.5 c/t; comfortably within budget

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── Compression pass ─────────────────────────────────────────────────────────

async function compressChunk(
  chunk: string,
  chunkIndex: number,
  totalChunks: number,
  providerClient: ReturnType<typeof getProvider>,
  model: string | undefined,
): Promise<string> {
  const system = `Ты ассистент-конспектор. Получаешь фрагмент ${chunkIndex + 1} из ${totalChunks} психотерапевтической сессии.
Задача: сжать до 350–450 слов, сохранив ВСЕ клинически значимые моменты:
- Темы и проблемы, поднятые клиентом
- Эмоциональные реакции, защиты, паттерны
- Интервенции терапевта и реакция клиента
- Инсайты, сдвиги, тупики
Пиши связным текстом, без заголовков, на русском.`;

  const result = await providerClient.generateText({
    systemPrompt: system,
    userPrompt:   chunk,
    model,
    temperature:  0.2,
    maxTokens:    700,
  });
  return result.text;
}

// ── Public: build compressed transcript (map-reduce) ─────────────────────────
// Called from route.ts when compressedTranscript is stale or absent.
// Returns the compressed text + metadata for DB storage.

export interface BuildCompressedTranscriptInput {
  transcriptText: string;   // canonical raw text (already formatted for analysis)
  sourceHash:     string;   // transcriptHash(canonicalText) — caller computes this
  model?:         string;
  provider?:      LLMProvider;
}

export interface BuildCompressedTranscriptOutput {
  text:        string;
  sourceHash:  string;
  chunksCount: number;
  createdAt:   string;
  model:       string;
}

export async function buildCompressedTranscript(
  input: BuildCompressedTranscriptInput,
): Promise<BuildCompressedTranscriptOutput> {
  const { transcriptText, sourceHash, model, provider: providerName = DEFAULT_PROVIDER } = input;
  const providerClient = getProvider(providerName);

  const chunks: string[] = [];
  for (let i = 0; i < transcriptText.length; i += CHUNK_CHARS) {
    chunks.push(transcriptText.slice(i, i + CHUNK_CHARS));
  }

  console.log(`[compress] ${Math.round(transcriptText.length / CHARS_PER_TOKEN)} tokens → ${chunks.length} chunks`);

  // Sequential: each chunk takes ~8s, replenishing ~4k TPM — enough for the next chunk.
  const compressions: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const compressed = await compressChunk(chunks[i], i, chunks.length, providerClient, model);
    compressions.push(`=== Часть ${i + 1} из ${chunks.length} ===\n${compressed}`);
  }

  // Sleep before the caller makes the main analysis LLM call
  await sleep(12_000);

  const text =
    `[Транскрипт сжат из-за длины: ${chunks.length} частей → конспекты]\n\n` +
    compressions.join("\n\n");

  return {
    text,
    sourceHash,
    chunksCount: chunks.length,
    createdAt:   new Date().toISOString(),
    model:       model ?? "gpt-4o",
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

export async function generateAnalysis(
  input: GenerateAnalysisInput
): Promise<GenerateAnalysisOutput> {
  const {
    mode,
    transcript,
    clientContext,
    provider: providerName = DEFAULT_PROVIDER,
    model,
    temperature,
    styleHint,
    lengthHint,
    extraInstructions,
    analysisEvidence,
  } = input;

  const preparedEvidence = analysisEvidence
    ? prepareEvidenceForAnalysis(analysisEvidence)
    : undefined;

  const providerClient = getProvider(providerName);

  const maxTokensByMode: Record<string, number> = {
    working:           3000,
    deep:              6000,
    therapist_process: 4000,
    gestalt:           4000,
    hypothesis:        3000,
    next_session:      2500,
  };
  const maxTokens = maxTokensByMode[mode] ?? 3000;

  // transcript is already effective (compressed or short) — route.ts handles chunking/cache.
  // Apply hard cap to guarantee we stay within TPM regardless of source.
  let effectiveTranscript = transcript;
  if (effectiveTranscript.length > TRANSCRIPT_FINAL_CAP_CHARS) {
    effectiveTranscript =
      effectiveTranscript.slice(0, TRANSCRIPT_FINAL_CAP_CHARS) +
      "\n\n[...транскрипт обрезан из-за ограничений токенов...]";
    console.log(`[analysis] transcript capped to ${TRANSCRIPT_FINAL_CAP_CHARS} chars`);
  }

  // ── Final analysis call ───────────────────────────────────────────────────
  const systemPrompt = await buildAnalysisPrompt({
    mode,
    transcript: effectiveTranscript,
    clientContext,
    styleHint,
    lengthHint,
    extraInstructions,
    preparedEvidence,
  });

  const result = await providerClient.generateText({
    systemPrompt,
    userPrompt:  "Выполни анализ согласно инструкциям выше.",
    model,
    temperature,
    maxTokens,
  });

  return {
    text:                 result.text,
    mode,
    provider:             result.provider,
    model:                result.model,
    knowledgeFiles:       getKnowledgeFilesForMode(mode),
    promptChars:          systemPrompt.length,
    promptTokensEstimate: Math.round(systemPrompt.length / 4),
  };
}
