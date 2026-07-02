import { openaiProvider } from "@/lib/llm/openai";
import type { TelegramIntent } from "@/lib/telegram/search";

export type TelegramLlmIntentResult = {
  intent: TelegramIntent;
  clientName?: string;
  clientStatus?: "all" | "active" | "archived";
  query?: string;
  period?: "month" | "week" | "today" | "all";
  dateFrom?: string;
  dateTo?: string;
};

const ALLOWED_INTENTS: TelegramIntent[] = [
  "list_clients",
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

function asClientStatus(value: unknown): TelegramLlmIntentResult["clientStatus"] | undefined {
  return value === "active" || value === "archived" || value === "all" ? value : undefined;
}

function parseIntentJson(text: string): TelegramLlmIntentResult | null {
  const parsed = JSON.parse(stripJsonFence(text)) as Record<string, unknown>;
  const intent = typeof parsed.intent === "string" ? parsed.intent : "unknown";
  if (!ALLOWED_INTENTS.includes(intent as TelegramIntent)) return { intent: "unknown" };

  return {
    intent: intent as TelegramIntent,
    clientName: asString(parsed.client_name) ?? asString(parsed.clientName),
    clientStatus: asClientStatus(parsed.client_status) ?? asClientStatus(parsed.clientStatus),
    query: asString(parsed.query),
    period: asPeriod(parsed.period),
    dateFrom: asString(parsed.date_from) ?? asString(parsed.dateFrom),
    dateTo: asString(parsed.date_to) ?? asString(parsed.dateTo),
  };
}

const SYSTEM_PROMPT = `
Ты классификатор намерений для Telegram-бота психолога. Пользователь пишет на русском разговорном языке.

ЗАДАЧА: Вернуть ТОЛЬКО валидный JSON без пояснений. Не отвечай пользователю. Не генерируй SQL.
Выбери intent и извлеки параметры из запроса.

ДОПУСТИМЫЕ INTENTS:
- list_clients: пользователь хочет список клиентов (все / активные / архивные)
  Примеры: "кто наши клиенты", "список всех клиентов", "покажи клиентов", "мои клиенты", "кто в работе", "активные клиенты"
  Параметр client_status: "all" | "active" | "archived" (по умолчанию "all")

- get_last_consultation: последняя консультация с конкретным клиентом или вообще
  Примеры: "когда была последняя консультация с Кириллом", "последняя встреча с Анной", "когда видел Жору"
  Если клиент не указан — client_name = null

- get_consultations: список консультаций клиента
  Примеры: "консультации Кирилла", "покажи встречи с Анной"

- find_client / get_client_summary: информация о конкретном клиенте
  Примеры: "/client Анна", "Кирилл", "расскажи про Жору"

- search_consultations: поиск по содержимому консультаций
  Примеры: "найди тревогу", "что обсуждали с Кириллом про маму", "о самостоятельности"

- search_analyses: поиск по анализам
  Примеры: "анализ про депрессию", "выводы по Кириллу"

- search_notebook: поиск по заметкам/блокноту
  Примеры: "заметки про тревогу", "найди в блокноте", "записи по Анне"

- get_consultation_count: сколько консультаций
  Примеры: "сколько консультаций было в июне", "количество встреч за месяц"

- get_payment_total: оплаты / доходы
  Примеры: "оплаты за июль", "сколько получено за месяц", "доход за июнь", "деньги за неделю"

- get_upcoming_consultation: ближайшая консультация
  Примеры: "следующая консультация", "ближайшая встреча"

- unknown: ТОЛЬКО если запрос явно не относится к ни одной функции выше, или это запрос на создание/изменение/удаление данных

ПРАВИЛА:
- Пользователь пишет разговорно, без знаков препинания, с опечатками и сокращениями
- Понимай смысл, а не только точные слова
- "клиенты", "пациенты", "люди в работе" = одно и то же
- "встреча", "сессия", "приём", "разговор" = консультация
- "деньги", "доход", "получено", "начислено" = оплаты
- "заметки", "блокнот", "записи", "напоминания" = notebook
- Месяцы: "июнь" → период "month" с датой июня; если не указан месяц — текущий месяц
- Имена в разных падежах: Кирилл/Кирилла/Кириллом, Анна/Анны/Анной — нормализуй в именительный падеж
- НЕ возвращай unknown, если запрос явно про клиентов/консультации/оплаты/заметки

JSON SHAPE (верни только это):
{"intent":"list_clients","client_name":null,"client_status":"all","query":null,"period":null,"date_from":null,"date_to":null}
`.trim();

export async function parseTelegramIntentWithLlm(text: string): Promise<TelegramLlmIntentResult | null> {
  if (!hasOpenAiKey()) return null;

  const today = new Date().toISOString().slice(0, 10);
  try {
    const result = await openaiProvider.generateText({
      model: process.env.TELEGRAM_INTENT_MODEL || "gpt-4o-mini",
      temperature: 0,
      maxTokens: 300,
      systemPrompt: `${SYSTEM_PROMPT}\n\nToday: ${today}`,
      userPrompt: text,
    });
    return parseIntentJson(result.text);
  } catch (error) {
    console.error("[telegram/intent llm]", error);
    return null;
  }
}
