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

    const isOModel = /^o\d/.test(model);
    const maxTokens = input.maxTokens ?? 4000;
    const completion = await client.chat.completions.create({
      model,
      ...(isOModel
        ? { max_completion_tokens: maxTokens }
        : { temperature: input.temperature ?? 0.7, max_tokens: maxTokens }),
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
