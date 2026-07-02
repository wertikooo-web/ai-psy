import { randomUUID } from "crypto";
import { getClients } from "@/lib/data/clients";
import { getConsultations, getConsultationsForClient } from "@/lib/data/consultations";
import { addEntry, getEntries } from "@/lib/data/notebook";
import { getPayments } from "@/lib/data/payments";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { requireLinkedTelegramAccount } from "@/lib/telegram/auth";
import { sendTelegramMessage, type TelegramInlineKeyboardButton, type TelegramMessage } from "@/lib/telegram/bot";
import { parseTelegramIntentWithLlm, type ConversationMode } from "@/lib/telegram/intent";
import {
  buildCapabilitiesIntroText,
  getCapabilityHelpText,
  getEnabledCapabilities,
} from "@/lib/telegram/capabilities";
import type { StoredClient } from "@/lib/clientStore";
import type { StoredConsultation } from "@/lib/consultationStore";

export type TelegramIntent =
  | "list_clients"
  | "find_client"
  | "get_client_summary"
  | "get_last_consultation"
  | "get_consultations"
  | "search_consultations"
  | "search_analyses"
  | "search_notebook"
  | "get_upcoming_consultation"
  | "get_consultation_count"
  | "get_payment_total"
  | "get_top_payer"
  | "get_notebook_count"
  | "get_session_brief"
  | "add_notebook_entry"
  | "unknown";

type ParsedRequest = {
  mode?: ConversationMode;
  intent: TelegramIntent;
  clientName?: string;
  clientStatus?: "all" | "active" | "archived";
  query?: string;
  period?: "month" | "week" | "today" | "all";
  dateFrom?: string;
  dateTo?: string;
};

type SearchResult = {
  type: "consultation" | "analysis" | "notebook" | "client_request" | "client_history" | "client_material" | "calendar";
  title: string;
  clientName?: string;
  date?: string;
  snippet: string;
  url?: string;
};

// In-memory conversation history per chat (last 3 messages, TTL 10 min)
const MAX_HISTORY = 3;
const HISTORY_TTL_MS = 10 * 60 * 1000;
type HistoryEntry = { text: string; ts: number };
const chatHistory = new Map<number, HistoryEntry[]>();

function getChatHistory(chatId: number): string[] {
  const now = Date.now();
  const entries = (chatHistory.get(chatId) ?? []).filter((e) => now - e.ts < HISTORY_TTL_MS);
  return entries.map((e) => e.text);
}

function pushChatHistory(chatId: number, text: string): void {
  const now = Date.now();
  const entries = (chatHistory.get(chatId) ?? []).filter((e) => now - e.ts < HISTORY_TTL_MS);
  entries.push({ text, ts: now });
  if (entries.length > MAX_HISTORY) entries.splice(0, entries.length - MAX_HISTORY);
  chatHistory.set(chatId, entries);
}

function navKeyboard(): { inline_keyboard: TelegramInlineKeyboardButton[][] } {
  return {
    inline_keyboard: [
      [
        { text: "Клиенты", callback_data: "help:clients" },
        { text: "Консультации", callback_data: "help:consultations" },
        { text: "Поиск", callback_data: "help:search" },
      ],
      [
        { text: "Оплаты", callback_data: "help:analytics" },
        { text: "Аналитика", callback_data: "help:analytics" },
        { text: "Что ты умеешь?", callback_data: "help:capabilities" },
      ],
    ],
  };
}

async function sendUnknownResponse(chatId: number): Promise<void> {
  await sendTelegramMessage(chatId, "Не совсем понял, что вы хотите.\n\nВыберите направление:", navKeyboard());
}

export async function sendCapabilitiesOverview(chatId: number): Promise<void> {
  const caps = getEnabledCapabilities();
  const keyboard: { inline_keyboard: TelegramInlineKeyboardButton[][] } = {
    inline_keyboard: [
      caps.slice(0, 3).map((c) => ({ text: c.title, callback_data: `help:${c.id}` })),
      caps.slice(3).map((c) => ({ text: c.title, callback_data: `help:${c.id}` })),
    ].filter((row) => row.length > 0),
  };
  await sendTelegramMessage(chatId, buildCapabilitiesIntroText(), keyboard);
}

export async function sendCapabilityHelp(chatId: number, capId: string): Promise<void> {
  const helpText = getCapabilityHelpText(capId);
  if (!helpText) {
    await sendCapabilitiesOverview(chatId);
    return;
  }
  const base = appBaseUrl();
  const urlMap: Record<string, string> = {
    clients: "/clients",
    consultations: "/analytics",
    search: "/",
    analytics: "/analytics",
  };
  const path = urlMap[capId];
  const keyboard = base && path
    ? { inline_keyboard: [[{ text: "Открыть на сайте", url: `${base}${path}` }]] }
    : undefined;
  await sendTelegramMessage(chatId, helpText, keyboard);
}

const CONVERSATIONAL_RESPONSES: Array<{ pattern: RegExp; response: string }> = [
  { pattern: /^(привет|здравствуй|добрый|хай|хэй|hello|hi)\b/, response: "Привет! Я здесь. Могу помочь найти клиента, консультацию, заметку или принять аудио." },
  { pattern: /^(спасибо|благодарю|спс)\b/, response: "Пожалуйста. Можно продолжить обычной фразой — команды помнить необязательно." },
  { pattern: /^(отлично|хорошо|понял|ок|окей|ладно|класс|супер|👍|🙏)/, response: "Хорошо. Если нужна помощь — просто напишите." },
  { pattern: /^(ты здесь|ты работаешь|есть кто|ау|работаешь)\b/, response: "Здесь. Готов помочь." },
  { pattern: /^(помоги|помогите|помощь|не знаю|с чего начать|что делать)\b/, response: "Помогу. Напишите, что вы хотите найти или сделать — даже своими словами." },
];

async function sendConversationalResponse(chatId: number, lower: string): Promise<void> {
  const match = CONVERSATIONAL_RESPONSES.find((item) => item.pattern.test(lower));
  const text = match?.response ?? "Слушаю. Чем могу помочь?";
  await sendTelegramMessage(chatId, text, navKeyboard());
}

function detectConversationMode(lower: string): ConversationMode | null {
  if (/^(привет|здравствуй|добрый|хай|хэй|hello|hi)\b/.test(lower)) return "general_conversation";
  if (/^(спасибо|благодарю|спс)\b/.test(lower)) return "general_conversation";
  if (/^(отлично|хорошо|понял|ок|окей|ладно|класс|супер|👍|🙏)/.test(lower)) return "general_conversation";
  if (/^(ты здесь|ты работаешь|есть кто|ау|работаешь)\b/.test(lower)) return "general_conversation";
  if (/^(помоги|помогите|помощь|не знаю|с чего начать|что делать)\b/.test(lower)) return "general_conversation";
  if (/что ты умеешь|какие (твои |у тебя |есть )?возможности|чем (ты )?(можешь )?помочь|что можно (у тебя )?спросить|покажи (свои )?функции|как (тобой|тебя|тебе) пользоваться/.test(lower)) return "product_help";
  if (/^(а ещё|ещё что|и ещё|что ещё умеешь|покажи примеры|расскажи подробнее о|как это работает)\b/.test(lower)) return "product_help";
  if (/^покажи последнее\.?$|^последнее\.?$|^что было\?*$|^открой\.?$/.test(lower)) return "clarification";
  return null;
}

function appBaseUrl(): string {
  return (process.env.APP_BASE_URL || "").replace(/\/$/, "");
}

function appUrl(path: string): string | undefined {
  const base = appBaseUrl();
  if (!base) return undefined;
  return `${base}${path}`;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function snippet(value: unknown, max = 180): string {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "Текст не заполнен.";
  return clean.length > max ? `${clean.slice(0, max - 1).trim()}...` : clean;
}

function formatDate(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = Array.from({ length: b.length + 1 }, () => 0);
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
  }
  return prev[b.length];
}

function getClientUrl(clientId: string): string | undefined {
  return appUrl(`/client/${clientId}`);
}

function getConsultationUrl(consultationId: string): string | undefined {
  return appUrl(`/consultation/${consultationId}`);
}

function getNotebookUrl(query?: string): string | undefined {
  const params = query ? `?search=${encodeURIComponent(query)}` : "";
  return appUrl(`/notebook${params}`);
}

function urlButton(text: string, url?: string): TelegramInlineKeyboardButton | null {
  return url ? { text, url } : null;
}

function keyboardFromButtons(buttons: Array<TelegramInlineKeyboardButton | null>) {
  const rows = buttons.filter((item): item is TelegramInlineKeyboardButton => !!item).map((item) => [item]);
  return rows.length ? { inline_keyboard: rows } : undefined;
}

async function findClientsByName(name: string): Promise<StoredClient[]> {
  const search = normalize(name);
  if (!search) return [];
  const clients = await getClients();
  const exact = clients.filter((client) => normalize(client.name) === search);
  if (exact.length) return exact;
  const starts = clients.filter((client) => normalize(client.name).startsWith(search));
  if (starts.length) return starts;
  const partial = clients.filter((client) => normalize(client.name).includes(search));
  if (partial.length) return partial;
  const fuzzy = clients
    .map((client) => ({ client, distance: levenshtein(normalize(client.name), search) }))
    .filter((item) => item.distance <= Math.max(2, Math.floor(search.length / 4)))
    .sort((a, b) => a.distance - b.distance)
    .map((item) => item.client);
  return fuzzy.slice(0, 5);
}

function extractClientName(text: string): string {
  return text
    .replace(/^\/\w+(@\w+)?/i, "")
    .replace(/^(найди|покажи|клиент|клиента|последняя|последнюю|консультации|консультация|с|у|для)\s+/i, "")
    .replace(/\?+$/g, "")
    .trim();
}

/** Extract client name from a natural-language phrase, stripping verb/preposition prefixes. */
function extractClientNameFromPhrase(text: string): string | undefined {
  const name = text
    .replace(/\?+$/g, "")
    .replace(/^(когда\s+)?(была?|был|последняя|последнюю|последнее|покажи|найди|посмотри)\s*/i, "")
    .replace(/^(консультаци[яюи]|встреча?|встреч[аие]|сессия|сессии)\s*/i, "")
    .replace(/\b(с|у|для|клиент[аа]?|по|про|клиента)\s+/i, "")
    .replace(/\b(когда|виде[лл]|встречал[аи]?|был[аои]?)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return name || undefined;
}

/** Detect "клиент" list signals in normalized text. */
function parseClientListRequest(lower: string): ParsedRequest | null {
  const hasClientWord = /клиент|пациент/.test(lower);
  const hasListSignal = /все|всех|список|мои|наши|покажи|какие|кто|сколько|активн|архив/.test(lower);
  const isSimpleClientQuery = /^(клиенты|мои клиенты|наши клиенты|все клиенты|список клиентов|список всех клиентов)$/.test(lower);

  if (!isSimpleClientQuery && !(hasClientWord && hasListSignal) && !/кто (в работе|сейчас|у нас|активен)/.test(lower)) {
    return null;
  }
  const clientStatus: "all" | "active" | "archived" = lower.includes("архив") ? "archived"
    : (lower.includes("актив") || lower.includes("в работе") || lower.includes("сейчас")) ? "active"
    : "all";
  return { intent: "list_clients", clientStatus };
}

function parseTextRequest(text: string): ParsedRequest {
  const raw = text.trim();
  const lower = normalize(raw);

  // 0. Conversational patterns (no LLM needed)
  const conversationalMode = detectConversationMode(lower);
  if (conversationalMode) return { mode: conversationalMode, intent: "unknown" };

  // 1. Slash commands
  const command = raw.match(/^\/([a-z_]+)(?:@\w+)?\s*(.*)$/i);
  if (command) {
    const cmd = `/${command[1].toLowerCase()}`;
    const args = command[2]?.trim() ?? "";
    if (cmd === "/client") return { intent: "get_client_summary", clientName: args };
    if (cmd === "/consultations") return { intent: "get_consultations", clientName: args };
    if (cmd === "/last") return { intent: "get_last_consultation", clientName: args };
    if (cmd === "/search") return { intent: "search_consultations", query: args };
    if (cmd === "/stats") return parseStats(args);
    if (cmd === "/clients") return { intent: "list_clients", clientStatus: "all" };
    return { intent: "unknown" };
  }

  // 2a. Quick note to notebook — "запиши:", "добавь в блокнот:", "заметка:"
  if (/^(запиши|сохрани заметку|добавь в блокнот|заметка)[:\s]/i.test(raw)) {
    const noteText = raw.replace(/^(запиши:?|сохрани заметку:?|добавь в блокнот:?|заметка:?)\s*/i, "").trim();
    return { intent: "add_notebook_entry", query: noteText };
  }

  // 2b. Pre-session brief — "что помнить про клиента", "подготовка к сессии"
  if (lower.includes("помнить") || lower.includes("подготовк") || (lower.includes("напомни") && !lower.includes("напомн"+"и мне"))) {
    return { intent: "get_session_brief", clientName: extractClientNameFromPhrase(raw) };
  }

  // 2a. Who paid the most — must be before generic payment check
  if ((lower.includes("кто") && (lower.includes("заплатил") || lower.includes("оплатил") || lower.includes("платит") || lower.includes("платил"))) ||
      (lower.includes("больше всех") && (lower.includes("оплат") || lower.includes("заплат") || lower.includes("платил"))) ||
      /топ.{0,10}(клиент|оплат)|рейтинг.{0,10}(оплат|клиент)/.test(lower)) {
    return { intent: "get_top_payer" };
  }

  // 2b. Notebook record count
  if ((lower.includes("сколько") || lower.includes("количество")) &&
      (lower.includes("запис") || lower.includes("заметк") || lower.includes("блокнот") || lower.includes("заметок"))) {
    return { intent: "get_notebook_count" };
  }

  // 2. Payment / money patterns (check before "list clients" to avoid "сколько оплатили")
  if (lower.includes("оплат") || lower.includes("доход") || lower.includes("получен") || lower.includes("деньг") || lower.includes("начислен")) {
    return { intent: "get_payment_total", period: periodFromText(lower) };
  }

  // 3. Client list — "кто наши клиенты", "список всех клиентов", etc.
  const clientList = parseClientListRequest(lower);
  if (clientList) return clientList;

  // 4. Consultation count — "сколько консультаций было в июне", "сколько консультаций с клиентом"
  if (lower.includes("сколько") && (lower.includes("консультац") || lower.includes("встреч") || lower.includes("сессий"))) {
    return { intent: "get_consultation_count", period: periodFromText(lower), clientName: extractClientNameFromPhrase(raw) };
  }

  // 5. Last consultation — "когда была последняя консультация с Васей", "последняя встреча"
  if ((lower.includes("последн") || lower.includes("посл ")) && (lower.includes("консультац") || lower.includes("встреч") || lower.includes("сессия") || lower.includes("виде") || lower.includes("встречал"))) {
    return { intent: "get_last_consultation", clientName: extractClientNameFromPhrase(raw) };
  }

  // 6. Upcoming consultation
  if ((lower.includes("следующ") || lower.includes("ближайш") || lower.includes("когда") && lower.includes("следующ")) && (lower.includes("консультац") || lower.includes("встреч") || lower.includes("сессия"))) {
    return { intent: "get_upcoming_consultation", clientName: extractClientNameFromPhrase(raw) };
  }

  // 7. Consultation listing for a specific client
  if ((lower.includes("консультац") || lower.includes("встреч") || lower.includes("сессия")) && (lower.includes("покажи") || lower.includes("найди") || lower.includes("список"))) {
    return { intent: "get_consultations", clientName: extractClientNameFromPhrase(raw) };
  }

  // 8. Notebook / notes search
  if (lower.includes("заметк") || lower.includes("блокнот") || lower.includes("запис") || lower.includes("напоминан")) {
    return { intent: "search_notebook", query: cleanupSearchQuery(raw) };
  }

  // 9. Analysis search
  if (lower.includes("анализ") || lower.includes("разбор") || lower.includes("вывод")) {
    return { intent: "search_analyses", query: cleanupSearchQuery(raw), clientName: extractClientNameFromPhrase(raw) };
  }

  // 10. General search phrases
  if (lower.includes("обсуждал") || lower.includes("про ") || lower.includes("о ")) {
    return { intent: "search_consultations", query: cleanupSearchQuery(raw) };
  }
  if (lower.startsWith("найди ")) return { intent: "search_consultations", query: cleanupSearchQuery(raw) };
  if (lower.startsWith("покажи ")) return { intent: "get_client_summary", clientName: extractClientName(raw) };

  return raw.length >= 3 ? { intent: "search_consultations", query: raw } : { intent: "unknown" };
}

export function isTelegramNaturalLanguageEnabled(): boolean {
  return process.env.TELEGRAM_NATURAL_LANGUAGE_SEARCH !== "false";
}

export function isTelegramSearchCommand(text: string | undefined): boolean {
  if (!text) return false;
  const parsed = text.trim().match(/^\/([a-z_]+)(?:@\w+)?(?:\s|$)/i);
  if (!parsed) return false;
  return ["/client", "/last", "/consultations", "/search", "/stats"].includes(`/${parsed[1].toLowerCase()}`);
}

function cleanupSearchQuery(raw: string): string {
  return raw
    .replace(/^\/search(@\w+)?\s*/i, "")
    .replace(/^(найди|покажи)\s+/i, "")
    .replace(/^(заметки|заметку|записи|про)\s+/i, "")
    .replace(/\?+$/g, "")
    .trim();
}

function sanitizeSupabaseSearch(value: string): string {
  return value
    .replace(/[%,_(),{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SEARCH_STOP_WORDS = new Set([
  "найди", "найти", "покажи", "показать", "найдите", "поищи", "поискать",
  "все", "всё", "всю", "всех", "вся", "весь",
  "про", "по", "о", "об", "обо", "что", "где", "кто", "там", "тут", "здесь",
  "есть", "было", "были", "была", "был", "есть", "нет",
  "упоминание", "упоминания", "тема", "темы",
  "нас", "нам", "наш", "наша", "наше", "наши", "нашего", "нашей", "нашем",
  "вас", "вам", "ваш", "ваша", "ваше", "ваши",
  "нас", "них", "ним", "ними", "них", "него", "ней",
  "у", "в", "к", "с", "из", "от", "до", "за", "под", "над", "при", "через",
  "как", "так", "же", "ли", "бы", "вот", "вообще", "вдруг", "уже", "ещё",
  "только", "даже", "именно", "тоже", "также", "ведь", "хоть", "хотя",
]);

function meaningfulSearchTokens(query: string): string[] {
  return normalize(cleanupSearchQuery(query))
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && !SEARCH_STOP_WORDS.has(part));
}

function tokenVariants(token: string): string[] {
  const variants = new Set<string>([token]);
  for (let cut = 1; cut <= Math.min(3, token.length - 3); cut += 1) {
    variants.add(token.slice(0, -cut));
  }
  return Array.from(variants).filter((item) => item.length >= 3);
}

function searchNeedles(query: string): string[] {
  const tokens = meaningfulSearchTokens(query);
  const variants = tokens.flatMap(tokenVariants);
  return Array.from(new Set(variants)).slice(0, 12);
}

function matchesSearchText(text: string, query: string): boolean {
  return searchScore(text, query) > 0;
}

function searchScore(text: string, query: string): number {
  const haystack = normalize(text);
  const tokens = meaningfulSearchTokens(query);
  if (!tokens.length) return haystack.includes(normalize(query)) ? 1 : 0;
  let score = 0;
  let matched = 0;
  for (const token of tokens) {
    const variants = tokenVariants(token);
    const exactHit = haystack.includes(token);
    const variantHit = !exactHit && variants.some((variant) => haystack.includes(variant));
    if (exactHit || variantHit) {
      matched++;
      score += exactHit ? 10 : 4;
    }
  }
  // At least one meaningful token must match
  if (matched === 0) return 0;
  // Bonus when all tokens matched (high-confidence hit)
  if (matched === tokens.length && tokens.length > 1) score += 15;
  // Bonus for exact phrase match
  if (haystack.includes(normalize(query))) score += 20;
  return score;
}

function snippetForSearch(value: unknown, query: string, max = 220): string {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "Текст не заполнен.";
  const lower = clean.toLowerCase().replace(/ё/g, "е");
  const needles = searchNeedles(query).sort((a, b) => b.length - a.length);
  const hit = needles
    .map((needle) => lower.indexOf(needle))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  if (hit === undefined) return snippet(clean, max);
  const start = Math.max(0, hit - Math.floor(max / 3));
  const end = Math.min(clean.length, start + max);
  return `${start > 0 ? "..." : ""}${clean.slice(start, end).trim()}${end < clean.length ? "..." : ""}`;
}

function analysisText(analysis: NonNullable<StoredConsultation["analyses"]>[number]): string {
  const blockText = analysis.blocks?.map((block) => [
    block.title,
    block.content,
    block.explanation,
    block.evidenceTooltip?.join(" "),
    block.tags?.join(" "),
  ].filter(Boolean).join(" ")).join(" ");
  return [analysis.result, blockText].filter(Boolean).join(" ");
}

function periodFromText(text: string): "month" | "week" | "today" | "all" {
  if (text.includes("сегодня")) return "today";
  if (text.includes("недел")) return "week";
  if (text.includes("месяц") || text.includes("июн") || text.includes("июл")) return "month";
  return "all";
}

function parseStats(args: string): ParsedRequest {
  const lower = normalize(args);
  if (lower.includes("pay") || lower.includes("оплат") || lower.includes("доход")) {
    return { intent: "get_payment_total", period: periodFromText(lower || "month") };
  }
  return { intent: "get_consultation_count", period: periodFromText(lower || "month") };
}

function currentPeriodRange(period: "month" | "week" | "today" | "all" = "month"): { from?: Date; to?: Date; label: string } {
  const now = new Date();
  if (period === "all") return { label: "за всё время" };
  const start = new Date(now);
  if (period === "today") {
    start.setHours(0, 0, 0, 0);
    return { from: start, to: now, label: "сегодня" };
  }
  if (period === "week") {
    start.setDate(now.getDate() - 7);
    return { from: start, to: now, label: "за 7 дней" };
  }
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return { from: start, to: now, label: "за текущий месяц" };
}

function inRange(value: string, range: { from?: Date; to?: Date }): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

function consultationText(consultation: StoredConsultation): string {
  return [
    consultation.title,
    consultation.notes,
    consultation.transcript?.text,
    consultation.transcriptFormatted?.map((segment) => segment.text).join(" "),
    consultation.analyses?.map(analysisText).join(" "),
    consultation.analysisEvidence ? JSON.stringify(consultation.analysisEvidence) : "",
    consultation.compressedTranscript?.text,
  ].filter(Boolean).join(" ");
}

async function resolveSingleClient(chatId: number, clientName: string | undefined): Promise<StoredClient | null> {
  if (!clientName?.trim()) {
    await sendTelegramMessage(chatId, "Напишите имя клиента. Например: /client Анна");
    return null;
  }
  const matches = await findClientsByName(clientName);
  if (!matches.length) {
    await sendTelegramMessage(chatId, `Клиент «${clientName}» не найден.`);
    return null;
  }
  if (matches.length > 1) {
    await sendTelegramMessage(
      chatId,
      `Нашёл несколько клиентов по запросу «${clientName}». Выберите нужного:`,
      keyboardFromButtons(matches.slice(0, 6).map((client) => urlButton(client.name, getClientUrl(client.id)))),
    );
    return null;
  }
  return matches[0];
}

async function sendClientSummary(chatId: number, clientName: string | undefined): Promise<void> {
  const client = await resolveSingleClient(chatId, clientName);
  if (!client) return;
  const consultations = await getConsultationsForClient(client.id);
  const latest = consultations[0];
  const lines = [
    `Клиент: ${client.name}`,
    `Статус: ${client.status}`,
    `Консультаций: ${consultations.length}`,
    client.currentFocus ? `Текущий запрос: ${snippet(client.currentFocus, 120)}` : "",
    latest ? `Последняя консультация: ${formatDate(latest.createdAt)}` : "Консультаций пока нет.",
  ].filter(Boolean);
  await sendTelegramMessage(chatId, lines.join("\n"), keyboardFromButtons([urlButton("Открыть клиента", getClientUrl(client.id))]));
}

async function sendClientConsultations(chatId: number, clientName: string | undefined): Promise<void> {
  const client = await resolveSingleClient(chatId, clientName);
  if (!client) return;
  const consultations = (await getConsultationsForClient(client.id)).slice(0, 5);
  if (!consultations.length) {
    await sendTelegramMessage(chatId, `У клиента ${client.name} консультаций пока нет.`, keyboardFromButtons([urlButton("Открыть клиента", getClientUrl(client.id))]));
    return;
  }
  const text = [`Консультации: ${client.name}`]
    .concat(consultations.map((item, index) => `${index + 1}. ${formatDate(item.createdAt)} — ${item.title || item.status}`))
    .join("\n");
  await sendTelegramMessage(chatId, text, keyboardFromButtons(consultations.map((item) => urlButton(`Открыть: ${formatDate(item.createdAt)}`, getConsultationUrl(item.id)))));
}

async function sendLastConsultation(chatId: number, clientName: string | undefined): Promise<void> {
  if (!clientName?.trim()) {
    const activeClients = (await getClients())
      .filter((c) => c.status === "active")
      .slice(0, 5);
    const buttons = activeClients.map((c) => urlButton(c.name, getClientUrl(c.id)));
    await sendTelegramMessage(
      chatId,
      [
        "По какому клиенту показать последнюю консультацию?",
        "",
        "Выберите на сайте или напишите:",
        "/last Имя",
      ].join("\n"),
      keyboardFromButtons([...buttons, urlButton("Все клиенты", appUrl("/clients"))]),
    );
    return;
  }
  const client = await resolveSingleClient(chatId, clientName);
  if (!client) return;
  const latest = (await getConsultationsForClient(client.id))[0];
  if (!latest) {
    await sendTelegramMessage(chatId, `У клиента ${client.name} консультаций пока нет.`, keyboardFromButtons([urlButton("Открыть клиента", getClientUrl(client.id))]));
    return;
  }
  const latestAnalysis = latest.analyses?.length
    ? latest.analyses[latest.analyses.length - 1]
    : null;
  await sendTelegramMessage(
    chatId,
    [
      `Последняя консультация: ${formatDate(latest.createdAt)}`,
      `Клиент: ${client.name}`,
      latest.title ? `Тема: ${latest.title}` : "",
      latestAnalysis
        ? `Анализ:\n${snippet(latestAnalysis.result, 350)}`
        : `Фрагмент:\n${snippet(consultationText(latest), 220)}`,
    ].filter(Boolean).join("\n"),
    keyboardFromButtons([urlButton("Открыть консультацию", getConsultationUrl(latest.id))]),
  );
}

async function sendClientList(chatId: number, clientStatus?: "all" | "active" | "archived"): Promise<void> {
  const all = await getClients();
  const active = all.filter((c) => c.status === "active");
  const archived = all.filter((c) => c.status !== "active");
  const filtered = clientStatus === "active" ? active : clientStatus === "archived" ? archived : all;
  const shown = filtered.slice(0, 10);

  const statusLabel = clientStatus === "active" ? "активные" : clientStatus === "archived" ? "архивные" : "все";
  const lines: string[] = [
    `Клиенты (${statusLabel}): ${filtered.length}`,
    clientStatus !== "active" && clientStatus !== "archived"
      ? `\nАктивные: ${active.length}\nАрхивные: ${archived.length}`
      : "",
    "",
    ...shown.map((c, i) => `${i + 1}. ${c.name}`),
    filtered.length > 10 ? `\n...и ещё ${filtered.length - 10}` : "",
  ].filter((l) => l !== undefined);

  const keyboard = [
    shown.length < filtered.length ? urlButton("Показать всех на сайте", appUrl("/clients")) : null,
    clientStatus !== "active" ? urlButton("Только активные", appUrl("/clients")) : null,
    urlButton("Открыть клиентов", appUrl("/clients")),
  ];
  await sendTelegramMessage(chatId, lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(), keyboardFromButtons(keyboard));
}

async function searchConsultations(query: string, clientId?: string): Promise<SearchResult[]> {
  const q = normalize(query);
  if (!q) return [];
  const consultations = clientId ? await getConsultationsForClient(clientId) : await getConsultations();
  return consultations
    .map((item) => ({ item, text: consultationText(item), score: searchScore(consultationText(item), query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || new Date(b.item.createdAt).getTime() - new Date(a.item.createdAt).getTime())
    .slice(0, 5)
    .map(({ item, text }) => ({
      type: item.analyses?.length ? "analysis" : "consultation",
      title: item.analyses?.length ? `Анализ от ${formatDate(item.createdAt)}` : `Консультация от ${formatDate(item.createdAt)}`,
      clientName: item.clientName,
      date: item.createdAt,
      snippet: snippetForSearch(text, query),
      url: getConsultationUrl(item.id),
    }));
}

async function searchNotebook(query: string): Promise<SearchResult[]> {
  const terms = Array.from(new Set([query, ...searchNeedles(query)])).filter(Boolean).slice(0, 8);
  const found = new Map<string, Awaited<ReturnType<typeof getEntries>>["entries"][number]>();
  for (const term of terms) {
    if (found.size >= 8) break;
    const page = await getEntries({
      page: 1,
      pageSize: 8,
      search: term,
      sort: "newest",
      group: "none",
      date: "all",
      status: "all",
    });
    for (const entry of page.entries) {
      const text = [entry.title, entry.text, entry.topic, ...(entry.tags ?? [])].filter(Boolean).join(" ");
      if (matchesSearchText(text, query)) found.set(entry.id, entry);
    }
  }
  return [...found.values()]
    .sort((a, b) => searchScore([b.title, b.text, b.topic, ...(b.tags ?? [])].filter(Boolean).join(" "), query)
      - searchScore([a.title, a.text, a.topic, ...(a.tags ?? [])].filter(Boolean).join(" "), query))
    .slice(0, 5)
    .map((entry) => ({
      type: "notebook",
      title: entry.title ? `Заметка: ${entry.title}` : `Заметка от ${formatDate(entry.createdAt)}`,
      clientName: entry.clientName,
      date: entry.createdAt,
      snippet: snippetForSearch([entry.title, entry.text, entry.topic, ...(entry.tags ?? [])].filter(Boolean).join(" "), query),
      url: getNotebookUrl(query),
    }));
}
async function searchSupabaseTextTables(query: string, consultationIdsAlreadyFound?: Set<string>): Promise<SearchResult[]> {
  if (!isSupabaseConfigured()) return [];
  const safeQuery = sanitizeSupabaseSearch(query);
  if (!safeQuery) return [];
  const needles = searchNeedles(safeQuery).map(sanitizeSupabaseSearch).filter(Boolean);
  const terms = needles.length ? needles : [safeQuery];
  const orFor = (columns: string[]) => terms
    .flatMap((term) => columns.map((column) => `${column}.ilike.%${term}%`))
    .join(",");
  const [consultations, requests, history, materials, calendar] = await Promise.all([
    // Direct DB search on transcript_text — catches text that in-memory search may miss
    supabaseServer!.from("consultations").select("id,client_id,client_name,title,created_at,notes,transcript_text").or(orFor(["title", "notes", "transcript_text"])).is("deleted_at", null).order("created_at", { ascending: false }).limit(8),
    supabaseServer!.from("client_requests").select("id,client_id,text,created_at").or(orFor(["text"])).is("deleted_at", null).order("created_at", { ascending: false }).limit(5),
    supabaseServer!.from("client_history").select("id,client_id,section,text,created_at").or(orFor(["text"])).order("created_at", { ascending: false }).limit(5),
    supabaseServer!.from("client_materials").select("id,client_id,title,content,created_at").or(orFor(["title", "content"])).order("created_at", { ascending: false }).limit(5),
    supabaseServer!.from("calendar_events").select("id,client_name,title,notes,starts_at").or(orFor(["title", "notes", "client_name"])).is("deleted_at", null).order("starts_at", { ascending: false }).limit(5),
  ]);
  const clients = await getClients();
  const clientName = (id?: string) => clients.find((client) => client.id === id)?.name;
  const rows: SearchResult[] = [];
  for (const row of consultations.data ?? []) {
    // Skip if already found by in-memory search (avoid duplicates by URL)
    const url = getConsultationUrl(row.id as string);
    if (consultationIdsAlreadyFound?.has(row.id as string)) continue;
    const textSrc = [row.title, row.notes, row.transcript_text].filter(Boolean).join(" ");
    rows.push({ type: "consultation", title: (row.title as string) || `Консультация от ${formatDate(row.created_at as string)}`, clientName: (row.client_name as string) || clientName(row.client_id as string), date: row.created_at as string, snippet: snippetForSearch(textSrc, query), url });
  }
  for (const row of requests.data ?? []) {
    rows.push({ type: "client_request", title: "Запрос клиента", clientName: clientName(row.client_id as string), date: row.created_at as string, snippet: snippetForSearch(row.text, query), url: row.client_id ? getClientUrl(row.client_id as string) : undefined });
  }
  for (const row of history.data ?? []) {
    rows.push({ type: "client_history", title: `История: ${row.section}`, clientName: clientName(row.client_id as string), date: row.created_at as string, snippet: snippetForSearch(row.text, query), url: row.client_id ? getClientUrl(row.client_id as string) : undefined });
  }
  for (const row of materials.data ?? []) {
    rows.push({ type: "client_material", title: (row.title as string) || "Материал клиента", clientName: clientName(row.client_id as string), date: row.created_at as string, snippet: snippetForSearch([row.title, row.content].filter(Boolean).join(" "), query), url: row.client_id ? getClientUrl(row.client_id as string) : undefined });
  }
  for (const row of calendar.data ?? []) {
    rows.push({ type: "calendar", title: (row.title as string) || "Событие календаря", clientName: row.client_name as string, date: row.starts_at as string, snippet: snippetForSearch([row.title, row.notes, row.client_name].filter(Boolean).join(" "), query), url: appUrl("/calendar") });
  }
  return rows
    .sort((a, b) => searchScore(b.snippet, query) - searchScore(a.snippet, query))
    .slice(0, 6);
}

function renderSearchResults(query: string, results: SearchResult[]): string {
  if (!results.length) return `По запросу «${query}» ничего не найдено.`;
  return [
    `Нашёл ${results.length} совпадений по запросу «${query}».`,
    "",
    ...results.map((item, index) => [
      `${index + 1}. ${item.title}`,
      item.clientName ? `Клиент: ${item.clientName}` : "",
      item.date ? `Дата: ${formatDate(item.date)}` : "",
      `«${item.snippet}»`,
    ].filter(Boolean).join("\n")),
  ].join("\n\n");
}

async function sendSearch(chatId: number, query: string | undefined, onlyNotebook = false, clientName?: string): Promise<void> {
  const cleaned = cleanupSearchQuery(query ?? "");
  if (!cleaned) {
    await sendTelegramMessage(chatId, "Напишите, что искать. Например: /search тревога");
    return;
  }
  const client = clientName?.trim() ? await resolveSingleClient(chatId, clientName) : null;
  if (clientName?.trim() && !client) return;
  let rawResults: SearchResult[];
  if (onlyNotebook) {
    rawResults = await searchNotebook(cleaned);
  } else {
    const consultationResults = await searchConsultations(cleaned, client?.id);
    const foundConsultationIds = new Set(
      consultationResults.map((r) => r.url?.split("/consultation/")[1]).filter((id): id is string => Boolean(id)),
    );
    const [notebookResults, supabaseResults] = await Promise.all([
      searchNotebook(cleaned),
      searchSupabaseTextTables(cleaned, foundConsultationIds),
    ]);
    rawResults = [...consultationResults, ...notebookResults, ...supabaseResults];
  }
  // Dedup by URL (same consultation from different sources)
  const seen = new Set<string>();
  const results = rawResults
    .filter((item) => {
      const key = item.url ?? `${item.type}:${item.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => searchScore([b.title, b.clientName, b.snippet].filter(Boolean).join(" "), cleaned)
      - searchScore([a.title, a.clientName, a.snippet].filter(Boolean).join(" "), cleaned))
    .slice(0, 5);
  await sendTelegramMessage(
    chatId,
    renderSearchResults(cleaned, results),
    keyboardFromButtons([
      ...results.slice(0, 5).map((item, index) => urlButton(`Открыть ${index + 1}`, item.url)),
      urlButton("Открыть поиск в блокноте", getNotebookUrl(cleaned)),
    ]),
  );
}

async function sendConsultationCount(chatId: number, period: ParsedRequest["period"], clientName?: string): Promise<void> {
  const range = currentPeriodRange(period);
  if (clientName?.trim()) {
    const client = await resolveSingleClient(chatId, clientName);
    if (!client) return;
    const all = await getConsultationsForClient(client.id);
    const count = all.filter((item) => !range.from || inRange(item.createdAt, range)).length;
    await sendTelegramMessage(chatId, `Консультаций с ${client.name} ${range.label}: ${count}.`, keyboardFromButtons([urlButton("Открыть клиента", getClientUrl(client.id))]));
    return;
  }
  const consultations = (await getConsultations()).filter((item) => !range.from || inRange(item.createdAt, range));
  await sendTelegramMessage(chatId, `Консультаций ${range.label}: ${consultations.length}.`, keyboardFromButtons([urlButton("Открыть аналитику", appUrl("/analytics"))]));
}

function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

async function sendNotebookCount(chatId: number): Promise<void> {
  const page = await getEntries({
    page: 1, pageSize: 1, search: "", sort: "newest",
    group: "none", date: "all", status: "all",
  });
  const n = page.total;
  await sendTelegramMessage(
    chatId,
    `В блокноте ${n} ${pluralRu(n, "запись", "записи", "записей")}.`,
    keyboardFromButtons([urlButton("Открыть блокнот", appUrl("/notebook"))]),
  );
}

async function sendTopPayer(chatId: number): Promise<void> {
  const [payments, clients] = await Promise.all([getPayments(), getClients()]);
  const byClient = new Map<string, { name: string; paid: number }>();
  for (const p of payments) {
    const key = p.clientId ?? "__none__";
    const name = clients.find((c) => c.id === p.clientId)?.name ?? "Без клиента";
    const prev = byClient.get(key) ?? { name, paid: 0 };
    byClient.set(key, { name, paid: prev.paid + Number(p.paidAmount || 0) });
  }
  const sorted = [...byClient.values()].filter((c) => c.paid > 0).sort((a, b) => b.paid - a.paid);
  if (!sorted.length) {
    await sendTelegramMessage(chatId, "Оплат пока нет.", keyboardFromButtons([urlButton("Открыть оплаты", appUrl("/payments"))]));
    return;
  }
  const lines = [
    `Клиенты по сумме оплат:`,
    "",
    ...sorted.slice(0, 5).map((c, i) => `${i + 1}. ${c.name}: ${c.paid} MDL`),
  ];
  await sendTelegramMessage(chatId, lines.join("\n"), keyboardFromButtons([urlButton("Открыть оплаты", appUrl("/payments"))]));
}

async function sendPaymentTotal(chatId: number, period: ParsedRequest["period"]): Promise<void> {
  const range = currentPeriodRange(period);
  const payments = (await getPayments()).filter((item) => !range.from || inRange(item.paymentDate || item.createdAt, range));
  const paid = payments.reduce((sum, item) => sum + Number(item.paidAmount || 0), 0);
  const charged = payments.reduce((sum, item) => sum + Number(item.chargedAmount || 0), 0);
  await sendTelegramMessage(chatId, `Оплаты ${range.label}:\nНачислено: ${charged} MDL\nПолучено: ${paid} MDL`, keyboardFromButtons([urlButton("Открыть оплаты", appUrl("/payments"))]));
}

async function sendUpcomingConsultation(chatId: number, clientName?: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    await sendTelegramMessage(chatId, "Календарь сейчас не настроен.");
    return;
  }
  const client = clientName?.trim() ? await resolveSingleClient(chatId, clientName) : null;
  if (clientName?.trim() && !client) return;
  let query = supabaseServer!
    .from("calendar_events")
    .select("id,client_id,client_name,title,notes,starts_at")
    .gte("starts_at", new Date().toISOString())
    .is("deleted_at", null)
    .order("starts_at", { ascending: true })
    .limit(1);
  if (client?.id) query = query.eq("client_id", client.id);
  const { data, error } = await query;
  if (error) {
    console.error("[telegram/upcoming consultation]", error);
    await sendTelegramMessage(chatId, "Не удалось прочитать ближайшую встречу.");
    return;
  }
  const item = data?.[0];
  if (!item) {
    await sendTelegramMessage(chatId, client ? `У ${client.name} нет ближайших встреч.` : "Ближайших встреч не найдено.");
    return;
  }
  await sendTelegramMessage(
    chatId,
    [
      "Ближайшая встреча:",
      `Дата: ${formatDate(item.starts_at as string)}`,
      item.client_name ? `Клиент: ${item.client_name}` : "",
      item.title ? `Тема: ${item.title}` : "",
      item.notes ? `Заметка: ${snippet(item.notes, 120)}` : "",
    ].filter(Boolean).join("\n"),
    keyboardFromButtons([urlButton("Открыть календарь", appUrl("/calendar"))]),
  );
}

async function sendSessionBrief(chatId: number, clientName: string | undefined): Promise<void> {
  const client = await resolveSingleClient(chatId, clientName);
  if (!client) return;
  const consultations = await getConsultationsForClient(client.id);
  const latest = consultations[0] ?? null;
  const latestAnalysis = latest?.analyses?.length
    ? latest.analyses[latest.analyses.length - 1]
    : null;

  let nextDate: string | null = null;
  if (isSupabaseConfigured()) {
    const { data } = await supabaseServer!
      .from("calendar_events")
      .select("starts_at")
      .eq("client_id", client.id)
      .gte("starts_at", new Date().toISOString())
      .is("deleted_at", null)
      .order("starts_at", { ascending: true })
      .limit(1);
    nextDate = (data?.[0]?.starts_at as string) ?? null;
  }

  const lines = [
    `Клиент: ${client.name}`,
    client.currentFocus ? `Текущий запрос: ${snippet(client.currentFocus, 150)}` : "",
    `Консультаций всего: ${consultations.length}`,
    latest ? `Последняя сессия: ${formatDate(latest.createdAt)}` : "Консультаций пока нет.",
    latestAnalysis ? `\nАнализ последней сессии:\n${snippet(latestAnalysis.result, 400)}` : "",
    nextDate ? `\nСледующая встреча: ${formatDate(nextDate)}` : "",
  ].filter(Boolean).join("\n");

  await sendTelegramMessage(
    chatId,
    lines,
    keyboardFromButtons([
      latest ? urlButton("Открыть последнюю консультацию", getConsultationUrl(latest.id)) : null,
      urlButton("Открыть клиента", getClientUrl(client.id)),
    ]),
  );
}

async function saveNotebookEntry(chatId: number, text: string | undefined, clientName?: string): Promise<void> {
  const noteText = text?.trim();
  if (!noteText) {
    await sendTelegramMessage(chatId, "Не понял, что записать. Напишите:\nЗапиши: текст заметки");
    return;
  }
  const client = clientName?.trim() ? (await findClientsByName(clientName))[0] ?? null : null;
  const entry = await addEntry({
    id: randomUUID(),
    text: noteText,
    clientId: client?.id,
  });
  await sendTelegramMessage(
    chatId,
    [
      "Заметка сохранена.",
      client ? `Клиент: ${client.name}` : "",
      `«${snippet(entry.text, 120)}»`,
    ].filter(Boolean).join("\n"),
    keyboardFromButtons([urlButton("Открыть блокнот", appUrl("/notebook"))]),
  );
}

async function dispatchSearchRequest(message: TelegramMessage, parsed: ParsedRequest): Promise<void> {
  const chatId = message.chat.id;
  const lower = normalize(message.text ?? "");

  if (parsed.mode === "general_conversation") return sendConversationalResponse(chatId, lower);
  if (parsed.mode === "product_help") return sendCapabilitiesOverview(chatId);
  if (parsed.mode === "clarification" || parsed.intent === "unknown") return sendUnknownResponse(chatId);
  if (parsed.intent === "list_clients") return sendClientList(chatId, parsed.clientStatus);
  if (parsed.intent === "find_client" || parsed.intent === "get_client_summary") return sendClientSummary(chatId, parsed.clientName || parsed.query);
  if (parsed.intent === "get_consultations") return sendClientConsultations(chatId, parsed.clientName);
  if (parsed.intent === "get_last_consultation") return sendLastConsultation(chatId, parsed.clientName);
  if (parsed.intent === "search_notebook") return sendSearch(chatId, parsed.query, true, parsed.clientName);
  if (parsed.intent === "search_consultations" || parsed.intent === "search_analyses") return sendSearch(chatId, parsed.query, false, parsed.clientName);
  if (parsed.intent === "get_upcoming_consultation") return sendUpcomingConsultation(chatId, parsed.clientName);
  if (parsed.intent === "get_consultation_count") return sendConsultationCount(chatId, parsed.period, parsed.clientName);
  if (parsed.intent === "get_payment_total") return sendPaymentTotal(chatId, parsed.period);
  if (parsed.intent === "get_top_payer") return sendTopPayer(chatId);
  if (parsed.intent === "get_notebook_count") return sendNotebookCount(chatId);
  if (parsed.intent === "get_session_brief") return sendSessionBrief(chatId, parsed.clientName);
  if (parsed.intent === "add_notebook_entry") return saveNotebookEntry(chatId, parsed.query, parsed.clientName);
  return sendUnknownResponse(chatId);
}

export async function handleTelegramReadOnlySearch(message: TelegramMessage, text: string): Promise<boolean> {
  if (!message.from?.id) return false;
  const account = await requireLinkedTelegramAccount(message.from.id);
  if (!isTelegramSearchCommand(text) && (!isTelegramNaturalLanguageEnabled() || !account.naturalLanguageEnabled)) {
    await sendTelegramMessage(
      message.chat.id,
      [
        account.naturalLanguageEnabled ? "Обычные фразы временно выключены на сервере." : "Обычные фразы выключены в настройках Telegram.",
        "",
        "Используйте команды:",
        "/client Имя",
        "/last Имя",
        "/consultations Имя",
        "/search запрос",
        "",
        "Включить обычные фразы можно через /settings.",
      ].join("\n"),
    );
    return true;
  }
  const chatId = message.chat.id;

  // Quick local check for obvious conversational patterns — skip LLM
  const lower = normalize(text);
  const earlyMode = !isTelegramSearchCommand(text) ? detectConversationMode(lower) : null;
  if (earlyMode === "general_conversation") {
    pushChatHistory(chatId, text);
    await sendConversationalResponse(chatId, lower);
    return true;
  }
  if (earlyMode === "product_help") {
    pushChatHistory(chatId, text);
    await sendCapabilitiesOverview(chatId);
    return true;
  }

  const prior = getChatHistory(chatId);
  pushChatHistory(chatId, text);

  let parsed: ParsedRequest;
  if (isTelegramSearchCommand(text)) {
    parsed = parseTextRequest(text);
  } else if (/^(найди|найдите|поищи|поиск)\s+.{2,}/i.test(text)) {
    // "найди..." is always a search — skip LLM to avoid misclassification as conversation
    const q = cleanupSearchQuery(text);
    parsed = { intent: "search_consultations", query: q || text };
  } else {
    const llmResult = await parseTelegramIntentWithLlm(text, prior.length ? prior : undefined);
    if (llmResult) {
      const isSearchIntent = ["search_consultations", "search_analyses", "search_notebook"].includes(llmResult.intent ?? "");
      parsed = {
        mode: llmResult.mode,
        intent: llmResult.intent ?? "unknown",
        clientName: llmResult.clientName,
        clientStatus: llmResult.clientStatus,
        // If LLM classified as search but forgot to set query, use original text
        query: llmResult.query ?? (isSearchIntent ? cleanupSearchQuery(text) || text : undefined),
        period: llmResult.period,
        dateFrom: llmResult.dateFrom,
        dateTo: llmResult.dateTo,
      };
    } else {
      parsed = parseTextRequest(text);
    }
  }
  await dispatchSearchRequest(message, parsed);
  return true;
}
