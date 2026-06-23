import type { LLMProviderClient, GenerateTextInput, GenerateTextOutput } from "./provider";

// ── Anthropic / Claude provider ───────────────────────────────────────────────
// Currently a mock. To go live:
//   1. npm install @anthropic-ai/sdk
//   2. Replace the mock body with a real messages.create call
//   3. Set ANTHROPIC_API_KEY in .env.local

export const DEFAULT_MODEL = "claude-sonnet-4-6";

export const anthropicProvider: LLMProviderClient = {
  provider: "anthropic",

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const model = input.model ?? DEFAULT_MODEL;

    // TODO: replace with real Anthropic call
    // const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    // const message = await client.messages.create({
    //   model,
    //   max_tokens: 2048,
    //   temperature: input.temperature ?? 0.7,
    //   system: input.systemPrompt,
    //   messages: [{ role: "user", content: input.userPrompt }],
    // });
    // const text = message.content[0].type === "text" ? message.content[0].text : "";
    // return {
    //   text,
    //   provider:         "anthropic",
    //   model,
    //   promptTokens:     message.usage.input_tokens,
    //   completionTokens: message.usage.output_tokens,
    // };

    await simulateLatency(300);
    return {
      text:     `[MOCK Anthropic response] model=${model} | system=${input.systemPrompt.length} chars`,
      provider: "anthropic",
      model,
    };
  },
};

function simulateLatency(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
