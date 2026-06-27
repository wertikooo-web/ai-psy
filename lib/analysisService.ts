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

// OpenAI free/low-tier TPM limit: 30 000 TPM.
// Calibrated from real overflow: 31 429 tokens for ~114 000-char prompt → ~3.6 chars/token.
// We use 4 chars/token as conservative estimate (overestimates tokens → trims earlier → safer).

const TPM_LIMIT                 = 30_000;
const TPM_SAFE_LIMIT            = 27_000;  // 3k buffer for burst variance + tokenization error
const PROMPT_CHARS_PER_TOKEN    = 4;       // calibrated: ~4 chars/token for mixed Cyrillic KB + dialogue

// Chunking threshold: trigger compression when canonical transcript alone risks overflow.
// KB + context + evidence ≈ 20 000–24 000 tokens. Output ≈ 3 000–6 000.
// Remaining budget for transcript ≈ 27 000 − 24 000 − 6 000 = 0 at worst → compress anything > 1 500 tokens.
export const TOKEN_BUDGET_PER_REQUEST   = 8_000;  // trigger chunking when transcript > 8k tokens (~12k chars)
export const CHARS_PER_TOKEN            = 1.5;    // used only for chunking threshold (transcripts tokenize denser)
const CHUNK_CHARS                       = Math.floor(8_000 * CHARS_PER_TOKEN); // ~12 000 chars per chunk

// Static pre-cap: rough first pass before we can measure the assembled prompt.
// The dynamic guard below is the real safety net.
const TRANSCRIPT_STATIC_CAP_CHARS      = 12_000;

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

  // ── Step 1: static pre-cap (fast, no KB read) ───────────────────────────
  // Rough guard before we can measure the assembled prompt.
  let effectiveTranscript = transcript;
  if (effectiveTranscript.length > TRANSCRIPT_STATIC_CAP_CHARS) {
    effectiveTranscript =
      effectiveTranscript.slice(0, TRANSCRIPT_STATIC_CAP_CHARS) +
      "\n\n[...транскрипт обрезан из-за ограничений токенов...]";
    console.log(`[analysis] mode=${mode} static pre-cap applied: ${transcript.length} → ${TRANSCRIPT_STATIC_CAP_CHARS} chars`);
  }

  // ── Step 2: build prompt and measure actual size ─────────────────────────
  let systemPrompt = await buildAnalysisPrompt({
    mode,
    transcript: effectiveTranscript,
    clientContext,
    styleHint,
    lengthHint,
    extraInstructions,
    preparedEvidence,
  });

  // ── Step 3: dynamic overflow guard ───────────────────────────────────────
  // Measure assembled prompt, trim transcript if total would exceed TPM_SAFE_LIMIT.
  // This fires regardless of how KB size, context, or evidence grows in the future.
  const estimatedInput  = Math.ceil(systemPrompt.length / PROMPT_CHARS_PER_TOKEN);
  const estimatedTotal  = estimatedInput + maxTokens;

  if (estimatedTotal > TPM_SAFE_LIMIT) {
    const allowedInputChars  = (TPM_SAFE_LIMIT - maxTokens) * PROMPT_CHARS_PER_TOKEN;
    // Non-transcript overhead = prompt chars minus the transcript portion
    const nonTranscriptChars = systemPrompt.length - effectiveTranscript.length;
    const transcriptBudget   = Math.max(1_000, allowedInputChars - nonTranscriptChars);

    console.warn(
      `[analysis] mode=${mode} TPM guard: estimated ${estimatedTotal} tokens > safe ${TPM_SAFE_LIMIT} ` +
      `— trimming transcript ${effectiveTranscript.length} → ${transcriptBudget} chars`,
    );

    effectiveTranscript =
      effectiveTranscript.slice(0, transcriptBudget) +
      "\n\n[...транскрипт обрезан из-за ограничений токенов...]";

    // Rebuild prompt with trimmed transcript
    systemPrompt = await buildAnalysisPrompt({
      mode,
      transcript: effectiveTranscript,
      clientContext,
      styleHint,
      lengthHint,
      extraInstructions,
      preparedEvidence,
    });
  } else {
    console.log(
      `[analysis] mode=${mode} tokens OK: ~${estimatedTotal} ` +
      `(input ~${estimatedInput} + output ≤${maxTokens}, safe limit ${TPM_SAFE_LIMIT})`,
    );
  }

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
