import { getClients } from "@/lib/data/clients";
import { getConsultations, getConsultationsForClient } from "@/lib/data/consultations";
import { getEntries } from "@/lib/data/notebook";
import { getPayments } from "@/lib/data/payments";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { requireLinkedTelegramAccount } from "@/lib/telegram/auth";
import { sendTelegramMessage, type TelegramInlineKeyboardButton, type TelegramMessage } from "@/lib/telegram/bot";
import { parseTelegramIntentWithLlm } from "@/lib/telegram/intent";
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
  | "unknown";

type ParsedRequest = {
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

const UNKNOWN_TEXT = [
  "Не смог точно понять запрос.",
  "",
  "Можно написать, например:",
  "— Покажи всех клиентов",
  "— Последняя консультация Кирилла",
  "— Сколько консультаций было в июне?",
  "— Оплаты за июль",
  "— Найди заметки про тревогу",
  "— Что обсуждали с Анной про маму",
].join("\n");

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

  // 2. Payment / money patterns (check before "list clients" to avoid "сколько оплатили")
  if (lower.includes("оплат") || lower.includes("доход") || lower.includes("получен") || lower.includes("деньг") || lower.includes("начислен")) {
    return { intent: "get_payment_total", period: periodFromText(lower) };
  }

  // 3. Client list — "кто наши клиенты", "список всех клиентов", etc.
  const clientList = parseClientListRequest(lower);
  if (clientList) return clientList;

  // 4. Consultation count — "сколько консультаций было в июне"
  if (lower.includes("сколько") && (lower.includes("консультац") || lower.includes("встреч") || lower.includes("сессий"))) {
    return { intent: "get_consultation_count", period: periodFromText(lower) };
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
    consultation.analyses?.map((analysis) => analysis.result).join(" "),
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
  await sendTelegramMessage(
    chatId,
    [
      `Последняя консультация: ${formatDate(latest.createdAt)}`,
      `Клиент: ${client.name}`,
      latest.title ? `Тема: ${latest.title}` : "",
      `Фрагмент: ${snippet(consultationText(latest), 220)}`,
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
    .filter((item) => normalize(consultationText(item)).includes(q))
    .slice(0, 5)
    .map((item) => ({
      type: item.analyses?.length ? "analysis" : "consultation",
      title: item.analyses?.length ? `Анализ от ${formatDate(item.createdAt)}` : `Консультация от ${formatDate(item.createdAt)}`,
      clientName: item.clientName,
      date: item.createdAt,
      snippet: snippet(consultationText(item)),
      url: getConsultationUrl(item.id),
    }));
}

async function searchNotebook(query: string): Promise<SearchResult[]> {
  const page = await getEntries({
    page: 1,
    pageSize: 5,
    search: query,
    sort: "newest",
    group: "none",
    date: "all",
    status: "all",
  });
  return page.entries.map((entry) => ({
    type: "notebook",
    title: entry.title ? `Заметка: ${entry.title}` : `Заметка от ${formatDate(entry.createdAt)}`,
    clientName: entry.clientName,
    date: entry.createdAt,
    snippet: snippet([entry.title, entry.text, entry.topic, ...(entry.tags ?? [])].filter(Boolean).join(" ")),
    url: getNotebookUrl(query),
  }));
}

async function searchSupabaseTextTables(query: string): Promise<SearchResult[]> {
  if (!isSupabaseConfigured()) return [];
  const safeQuery = sanitizeSupabaseSearch(query);
  if (!safeQuery) return [];
  const q = `%${safeQuery}%`;
  const [requests, history, materials, calendar] = await Promise.all([
    supabaseServer!.from("client_requests").select("id,client_id,text,created_at").ilike("text", q).is("deleted_at", null).order("created_at", { ascending: false }).limit(5),
    supabaseServer!.from("client_history").select("id,client_id,section,text,created_at").ilike("text", q).order("created_at", { ascending: false }).limit(5),
    supabaseServer!.from("client_materials").select("id,client_id,title,content,created_at").or(`title.ilike.${q},content.ilike.${q}`).order("created_at", { ascending: false }).limit(5),
    supabaseServer!.from("calendar_events").select("id,client_name,title,notes,starts_at").or(`title.ilike.${q},notes.ilike.${q},client_name.ilike.${q}`).is("deleted_at", null).order("starts_at", { ascending: false }).limit(5),
  ]);
  const clients = await getClients();
  const clientName = (id?: string) => clients.find((client) => client.id === id)?.name;
  const rows: SearchResult[] = [];
  for (const row of requests.data ?? []) {
    rows.push({ type: "client_request", title: "Запрос клиента", clientName: clientName(row.client_id as string), date: row.created_at as string, snippet: snippet(row.text), url: row.client_id ? getClientUrl(row.client_id as string) : undefined });
  }
  for (const row of history.data ?? []) {
    rows.push({ type: "client_history", title: `История: ${row.section}`, clientName: clientName(row.client_id as string), date: row.created_at as string, snippet: snippet(row.text), url: row.client_id ? getClientUrl(row.client_id as string) : undefined });
  }
  for (const row of materials.data ?? []) {
    rows.push({ type: "client_material", title: (row.title as string) || "Материал клиента", clientName: clientName(row.client_id as string), date: row.created_at as string, snippet: snippet(row.content), url: row.client_id ? getClientUrl(row.client_id as string) : undefined });
  }
  for (const row of calendar.data ?? []) {
    rows.push({ type: "calendar", title: (row.title as string) || "Событие календаря", clientName: row.client_name as string, date: row.starts_at as string, snippet: snippet(row.notes || row.title), url: appUrl("/calendar") });
  }
  return rows.slice(0, 5);
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
  const results = onlyNotebook
    ? await searchNotebook(cleaned)
    : [
      ...(await searchConsultations(cleaned, client?.id)),
      ...(await searchNotebook(cleaned)),
      ...(await searchSupabaseTextTables(cleaned)),
    ].slice(0, 5);
  await sendTelegramMessage(
    chatId,
    renderSearchResults(cleaned, results),
    keyboardFromButtons([
      ...results.slice(0, 5).map((item, index) => urlButton(`Открыть ${index + 1}`, item.url)),
      urlButton("Открыть поиск в блокноте", getNotebookUrl(cleaned)),
    ]),
  );
}

async function sendConsultationCount(chatId: number, period: ParsedRequest["period"]): Promise<void> {
  const range = currentPeriodRange(period);
  const consultations = (await getConsultations()).filter((item) => !range.from || inRange(item.createdAt, range));
  await sendTelegramMessage(chatId, `Консультаций ${range.label}: ${consultations.length}.`, keyboardFromButtons([urlButton("Открыть аналитику", appUrl("/analytics"))]));
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

async function dispatchSearchRequest(message: TelegramMessage, parsed: ParsedRequest): Promise<void> {
  const chatId = message.chat.id;
  if (parsed.intent === "unknown") return sendTelegramMessage(chatId, UNKNOWN_TEXT);
  if (parsed.intent === "list_clients") return sendClientList(chatId, parsed.clientStatus);
  if (parsed.intent === "find_client" || parsed.intent === "get_client_summary") return sendClientSummary(chatId, parsed.clientName || parsed.query);
  if (parsed.intent === "get_consultations") return sendClientConsultations(chatId, parsed.clientName);
  if (parsed.intent === "get_last_consultation") return sendLastConsultation(chatId, parsed.clientName);
  if (parsed.intent === "search_notebook") return sendSearch(chatId, parsed.query, true, parsed.clientName);
  if (parsed.intent === "search_consultations" || parsed.intent === "search_analyses") return sendSearch(chatId, parsed.query, false, parsed.clientName);
  if (parsed.intent === "get_upcoming_consultation") return sendUpcomingConsultation(chatId, parsed.clientName);
  if (parsed.intent === "get_consultation_count") return sendConsultationCount(chatId, parsed.period);
  if (parsed.intent === "get_payment_total") return sendPaymentTotal(chatId, parsed.period);
  return sendTelegramMessage(chatId, UNKNOWN_TEXT);
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
  const prior = getChatHistory(chatId);
  pushChatHistory(chatId, text);

  const parsed = isTelegramSearchCommand(text)
    ? parseTextRequest(text)
    : (await parseTelegramIntentWithLlm(text, prior.length ? prior : undefined)) ?? parseTextRequest(text);
  await dispatchSearchRequest(message, parsed);
  return true;
}
