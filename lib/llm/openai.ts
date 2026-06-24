import OpenAI from "openai";
import type { LLMProviderClient, GenerateTextInput, GenerateTextOutput } from "./provider";

export const DEFAULT_MODEL = "gpt-4o";

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.startsWith("sk-...")) {
    throw new Error(
      "OPENAI_API_KEY не задан. Добавьте реальный ключ в .env.local"
    );
  }
  return new OpenAI({ apiKey });
}

export const openaiProvider: LLMProviderClient = {
  provider: "openai",

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const model = input.model ?? DEFAULT_MODEL;
    const client = getClient();

    // o-series models (o1, o3, o4-mini, etc.) don't support custom temperature
    const isOModel = /^o\d/.test(model);
    const completion = await client.chat.completions.create({
      model,
      ...(isOModel ? {} : { temperature: input.temperature ?? 0.7 }),
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user",   content: input.userPrompt },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "";

    return {
      text,
      provider:         "openai",
      model:            completion.model,
      promptTokens:     completion.usage?.prompt_tokens,
      completionTokens: completion.usage?.completion_tokens,
    };
  },
};
