import { buildAnalysisPrompt, getKnowledgeFilesForMode, type AnalysisMode } from "./knowledgeBase";
import { getProvider, DEFAULT_PROVIDER, type LLMProvider } from "./llm";

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

// ── Token budget constants ────────────────────────────────────────────────────

// OpenAI free/low-tier TPM limit is ~30 000. We leave room for output tokens.
const TOKEN_BUDGET_PER_REQUEST = 20_000; // safe input token budget per single request
const CHARS_PER_TOKEN          = 1.5;    // Russian Cyrillic: ~1.5 chars per token (not 4 like English)
const CHUNK_CHARS              = Math.floor(15_000 * CHARS_PER_TOKEN); // ~22 500 chars per chunk

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
  } = input;

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

  // Decide whether chunking is needed
  const estimatedTokens = Math.round(transcript.length / CHARS_PER_TOKEN);
  let effectiveTranscript = transcript;

  if (estimatedTokens > TOKEN_BUDGET_PER_REQUEST) {
    // ── Map-reduce: compress each chunk, then analyze the compressed text ──
    const chunks: string[] = [];
    for (let i = 0; i < transcript.length; i += CHUNK_CHARS) {
      chunks.push(transcript.slice(i, i + CHUNK_CHARS));
    }

    console.log(`[analysis] transcript ${estimatedTokens} tokens → chunking into ${chunks.length} parts`);

    const compressions: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      if (i > 0) await sleep(12_000); // stay within TPM window
      const compressed = await compressChunk(chunks[i], i, chunks.length, providerClient, model);
      compressions.push(`=== Часть ${i + 1} из ${chunks.length} ===\n${compressed}`);
    }

    effectiveTranscript =
      `[Транскрипт сжат из-за длины: ${chunks.length} частей → конспекты]\n\n` +
      compressions.join("\n\n");

    await sleep(12_000); // pause before final analysis call
  }

  // ── Final analysis call ───────────────────────────────────────────────────
  const systemPrompt = await buildAnalysisPrompt({
    mode,
    transcript: effectiveTranscript,
    clientContext,
    styleHint,
    lengthHint,
    extraInstructions,
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
