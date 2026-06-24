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
  } = input;

  // 1. Build prompt from knowledge base
  const systemPrompt = await buildAnalysisPrompt({ mode, transcript, clientContext });

  // 2. Select provider
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

  // 3. Call LLM
  const result = await providerClient.generateText({
    systemPrompt,
    userPrompt: "Выполни анализ согласно инструкциям выше.",
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
