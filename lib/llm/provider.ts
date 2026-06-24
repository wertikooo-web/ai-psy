// ── LLM Provider Interface ────────────────────────────────────────────────────
//
// All concrete providers implement this interface.
// Swap the provider in analysisService.ts without touching any other code.

export type LLMProvider = "openai" | "anthropic" | "deepseek";

export interface GenerateTextInput {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateTextOutput {
  text: string;
  provider: LLMProvider;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
}

export interface LLMProviderClient {
  provider: LLMProvider;
  generateText(input: GenerateTextInput): Promise<GenerateTextOutput>;
}
