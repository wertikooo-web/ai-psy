import type { LLMProviderClient, GenerateTextInput, GenerateTextOutput } from "./provider";

// ── DeepSeek provider ─────────────────────────────────────────────────────────
// Currently a mock. To go live:
//   DeepSeek is OpenAI-compatible — same SDK, different base URL + model names.
//   1. npm install openai  (if not already installed)
//   2. Replace the mock body with a real call
//   3. Set DEEPSEEK_API_KEY in .env.local

export const DEFAULT_MODEL = "deepseek-chat";

export const deepseekProvider: LLMProviderClient = {
  provider: "deepseek",

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const model = input.model ?? DEFAULT_MODEL;

    // TODO: replace with real DeepSeek call (OpenAI-compatible API)
    // const openai = new OpenAI({
    //   apiKey:  process.env.DEEPSEEK_API_KEY,
    //   baseURL: "https://api.deepseek.com/v1",
    // });
    // const completion = await openai.chat.completions.create({
    //   model,
    //   temperature: input.temperature ?? 0.7,
    //   messages: [
    //     { role: "system", content: input.systemPrompt },
    //     { role: "user",   content: input.userPrompt },
    //   ],
    // });
    // return {
    //   text:             completion.choices[0].message.content ?? "",
    //   provider:         "deepseek",
    //   model,
    //   promptTokens:     completion.usage?.prompt_tokens,
    //   completionTokens: completion.usage?.completion_tokens,
    // };

    await simulateLatency(300);
    return {
      text:     `[MOCK DeepSeek response] model=${model} | system=${input.systemPrompt.length} chars`,
      provider: "deepseek",
      model,
    };
  },
};

function simulateLatency(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
