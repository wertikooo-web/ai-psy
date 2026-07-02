import { openaiProvider } from "@/lib/llm/openai";
import type { TelegramIntent } from "@/lib/telegram/search";

export type TelegramLlmIntentResult = {
  intent: TelegramIntent;
  clientName?: string;
  query?: string;
  period?: "month" | "week" | "today" | "all";
  dateFrom?: string;
  dateTo?: string;
};

const ALLOWED_INTENTS: TelegramIntent[] = [
  "find_client",
  "get_client_summary",
  "get_last_consultation",
  "get_consultations",
  "search_consultations",
  "search_analyses",
  "search_notebook",
  "get_upcoming_consultation",
  "get_consultation_count",
  "get_payment_total",
  "unknown",
];

function hasOpenAiKey(): boolean {
  const apiKey = process.env.OPENAI_API_KEY;
  return Boolean(apiKey && !apiKey.startsWith("sk-..."));
}

function stripJsonFence(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asPeriod(value: unknown): TelegramLlmIntentResult["period"] | undefined {
  return value === "month" || value === "week" || value === "today" || value === "all" ? value : undefined;
}

function parseIntentJson(text: string): TelegramLlmIntentResult | null {
  const parsed = JSON.parse(stripJsonFence(text)) as Record<string, unknown>;
  const intent = typeof parsed.intent === "string" ? parsed.intent : "unknown";
  if (!ALLOWED_INTENTS.includes(intent as TelegramIntent)) return { intent: "unknown" };

  return {
    intent: intent as TelegramIntent,
    clientName: asString(parsed.client_name) ?? asString(parsed.clientName),
    query: asString(parsed.query),
    period: asPeriod(parsed.period),
    dateFrom: asString(parsed.date_from) ?? asString(parsed.dateFrom),
    dateTo: asString(parsed.date_to) ?? asString(parsed.dateTo),
  };
}

export async function parseTelegramIntentWithLlm(text: string): Promise<TelegramLlmIntentResult | null> {
  if (!hasOpenAiKey()) return null;

  const today = new Date().toISOString().slice(0, 10);
  try {
    const result = await openaiProvider.generateText({
      model: process.env.TELEGRAM_INTENT_MODEL || "gpt-4o-mini",
      temperature: 0,
      maxTokens: 260,
      systemPrompt: [
        "You classify Russian Telegram requests for a psychologist CRM.",
        "Return only valid JSON. Do not answer the user. Do not generate SQL.",
        "You only choose a read-only intent and extract parameters.",
        "If the user asks to create, edit, delete, send, or change data, use unknown.",
        `Today is ${today}.`,
        "Allowed intents: find_client, get_client_summary, get_last_consultation, get_consultations, search_consultations, search_analyses, search_notebook, get_upcoming_consultation, get_consultation_count, get_payment_total, unknown.",
        "JSON shape: {\"intent\":\"search_consultations\",\"client_name\":null,\"query\":null,\"period\":null,\"date_from\":null,\"date_to\":null}.",
        "Use client_name for a person name. Use query for the topic/search words.",
        "For counts/payments set period to today, week, month, or all when clear.",
        "For notebook/notes requests use search_notebook. For analysis requests use search_analyses.",
      ].join("\n"),
      userPrompt: text,
    });
    return parseIntentJson(result.text);
  } catch (error) {
    console.error("[telegram/intent llm]", error);
    return null;
  }
}
