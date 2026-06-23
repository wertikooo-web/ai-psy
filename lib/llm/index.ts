import type { LLMProvider, LLMProviderClient } from "./provider";
import { openaiProvider }    from "./openai";
import { anthropicProvider } from "./anthropic";
import { deepseekProvider }  from "./deepseek";

export type { LLMProvider, LLMProviderClient, GenerateTextInput, GenerateTextOutput } from "./provider";

const PROVIDERS: Record<LLMProvider, LLMProviderClient> = {
  openai:    openaiProvider,
  anthropic: anthropicProvider,
  deepseek:  deepseekProvider,
};

/** Returns the provider client by name. Throws if unknown. */
export function getProvider(name: LLMProvider): LLMProviderClient {
  const client = PROVIDERS[name];
  if (!client) throw new Error(`Unknown LLM provider: "${name}"`);
  return client;
}

export const DEFAULT_PROVIDER: LLMProvider = "anthropic";
