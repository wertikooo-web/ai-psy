import { openaiProvider } from "@/lib/llm/openai";
import type { TelegramIntent } from "@/lib/telegram/search";

export type ConversationMode =
  | "project_data"
  | "product_help"
  | "general_conversation"
  | "clarification";

export type TelegramLlmIntentResult = {
  mode: ConversationMode;
  intent: TelegramIntent | null;
  clientName?: string;
  clientStatus?: "all" | "active" | "archived";
  query?: string;
  period?: "month" | "week" | "today" | "all";
  dateFrom?: string;
  dateTo?: string;
};

const ALLOWED_INTENTS: Array<TelegramIntent | null> = [
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
  "get_top_payer",
  "get_notebook_count",
  "get_session_brief",
  "add_notebook_entry",
  "add_client_note",
  "analytics_open",
  "analytics_metric_query",
  "unknown",
  null,
];

const ALLOWED_MODES: ConversationMode[] = [
  "project_data",
  "product_help",
  "general_conversation",
  "clarification",
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

  const rawMode = typeof parsed.mode === "string" ? parsed.mode : "project_data";
  const mode: ConversationMode = ALLOWED_MODES.includes(rawMode as ConversationMode)
    ? (rawMode as ConversationMode)
    : "project_data";

  const rawIntent = typeof parsed.intent === "string" ? parsed.intent : null;
  const intent = rawIntent === null || !ALLOWED_INTENTS.includes(rawIntent as TelegramIntent)
    ? (mode === "project_data" ? "unknown" : null)
    : (rawIntent as TelegramIntent | null);

  return {
    mode,
    intent,
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

ШАГ 1 — ОПРЕДЕЛИ РЕЖИМ (поле mode):
- "general_conversation": приветствие, благодарность, короткая реплика, не требующая данных
  Примеры: "привет", "спасибо", "ты здесь?", "помоги", "понял", "отлично", "хорошо", "ок"
- "product_help": вопросы о возможностях и функциях самого бота
  Примеры: "что ты умеешь?", "какие возможности?", "как пользоваться?", "покажи функции", "а ещё?", "расскажи подробнее о функциях"
- "clarification": запрос частично понятен, но не хватает ключевого параметра
  Примеры: "покажи последнее" (без контекста), "что было?" (неясно о чём), "открой" (неясно что)
- "project_data": любой запрос о клиентах, консультациях, анализах, заметках, оплатах, аналитике, календаре

ШАГ 2 — ОПРЕДЕЛИ INTENT (только если mode = "project_data"):
- list_clients: пользователь хочет список клиентов (все / активные / архивные)
  Параметр client_status: "all" | "active" | "archived" (по умолчанию "all")
- get_last_consultation: последняя консультация с клиентом или вообще
- get_consultations: список консультаций клиента
- find_client / get_client_summary: информация о конкретном клиенте
- search_consultations: поиск по содержимому консультаций
- search_analyses: поиск по анализам
- search_notebook: поиск по заметкам/блокноту
- get_consultation_count: сколько консультаций
- get_payment_total: оплаты / доходы — общие или по конкретному клиенту
  Примеры: "сколько получено за месяц?", "какой доход за июнь?", "что у жоры по оплате?", "сколько должен кирилл?", "долг анны"
  Если есть имя клиента — заполни client_name. Это НЕ find_client.
- get_top_payer: кто из клиентов заплатил больше всего
  Примеры: "кто заплатил больше всех?", "из клиентов кто больше всех?", "топ клиентов по оплатам", "кто больше всех платит?"
- get_notebook_count: сколько записей в блокноте
  Примеры: "сколько записей у меня в блокноте?", "сколько заметок?", "количество записей в блокноте"
- get_upcoming_consultation: ближайшая консультация
- get_session_brief: сводка по клиенту перед сессией ("что помнить", "подготовка к сессии")
- add_notebook_entry: записать заметку без привязки к клиенту ("запиши:", "добавь в блокнот:")
- add_client_note: добавить заметку/наблюдение к конкретному клиенту
  Примеры: "добавь жоре продал кошку", "про кошку добавь жоре- продал кошку", "к кириллу заметка конфликт с бабушкой", "запиши родиону про дружбу"
  ВАЖНО: содержит "добавь"/"запиши"/"зафиксируй" + имя клиента + текст. Не путать с поиском ("найди", "что было")
- analytics_open: пользователь хочет открыть аналитику/статистику
  Примеры: "открой мою статистику", "покажи аналитику", "статистика", "моя аналитика", "дай статистику", "что у меня по статистике"
- analytics_metric_query: вопрос о конкретной метрике — ВСЕГДА когда есть «сколько» + множественный объект
  Примеры: "сколько активных клиентов?", "сколько клиентов сейчас активны?", "сколько консультаций за месяц?", "сколько оплат получено?", "сколько неоплаченных консультаций?", "сколько клиентов без следующей встречи?"
  СТРОГОЕ ПРАВИЛО: любая фраза с «сколько» + (клиентов/консультаций/встреч/оплат/сессий/активных/архивных) → ВСЕГДА analytics_metric_query. НИКОГДА не list_clients, find_client или get_client_summary.
  list_clients срабатывает ТОЛЬКО на: "покажи всех клиентов", "список клиентов", "мои клиенты", "кто мои клиенты" — без слова «сколько».
- unknown: если запрос явно не относится ни к одной функции выше

ПРАВИЛА:
- Если mode != "project_data" — intent можно установить в null
- Понимай смысл, а не только точные слова
- "клиенты"/"пациенты" = одно и то же; "встреча"/"сессия"/"приём" = консультация
- "деньги"/"доход"/"получено" = оплаты; "заметки"/"блокнот" = notebook
- Имена нормализуй в именительный падеж
- Если ТЕКУЩИЙ запрос — короткое уточнение (начинается с "а", "ещё", "а что") — используй КОНТЕКСТ РАЗГОВОРА
- Для intent search_consultations/search_analyses/search_notebook: поле query ОБЯЗАТЕЛЬНО — поставь query = ключевые слова запроса (не null!)
- Одиночное слово или тема (например "тревога", "кошка", "семья") — это search_consultations с query = это слово

JSON SHAPE:
{"mode":"project_data","intent":"list_clients","client_name":null,"client_status":"all","query":null,"period":null,"date_from":null,"date_to":null}
`.trim();

export async function parseTelegramIntentWithLlm(
  text: string,
  priorMessages?: string[],
): Promise<TelegramLlmIntentResult | null> {
  if (!hasOpenAiKey()) return null;

  const today = new Date().toISOString().slice(0, 10);
  const contextBlock =
    priorMessages && priorMessages.length > 0
      ? `\n\nКОНТЕКСТ РАЗГОВОРА (предыдущие сообщения пользователя, от ранних к поздним):\n${priorMessages.map((m) => `— ${m}`).join("\n")}\n\nТЕКУЩИЙ ЗАПРОС:`
      : "";

  try {
    const result = await openaiProvider.generateText({
      model: process.env.TELEGRAM_INTENT_MODEL || "gpt-4o-mini",
      temperature: 0,
      maxTokens: 300,
      systemPrompt: `${SYSTEM_PROMPT}\n\nToday: ${today}`,
      userPrompt: contextBlock ? `${contextBlock} ${text}` : text,
    });
    return parseIntentJson(result.text);
  } catch (error) {
    console.error("[telegram/intent llm]", error);
    return null;
  }
}
