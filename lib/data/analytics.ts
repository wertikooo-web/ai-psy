import { getCalendarEvents } from "@/lib/data/calendarEvents";
import { getAllCurrentRequests } from "@/lib/data/clientRequests";
import { getClients } from "@/lib/data/clients";
import { getConsultations } from "@/lib/data/consultations";
import { getPayments, type ConsultationPayment } from "@/lib/data/payments";
import type { CalendarEvent } from "@/lib/data/calendarEvents";
import type { StoredClient } from "@/lib/clientStore";
import type { StoredConsultation } from "@/lib/consultationStore";

export type AnalyticsPeriodPreset = "today" | "week" | "month" | "3m" | "6m" | "year" | "all" | "custom";
export type AnalyticsClientFilter = "all" | "active" | "archived" | string;

export interface AnalyticsFilters {
  preset: AnalyticsPeriodPreset;
  from?: string;
  to?: string;
  client: AnalyticsClientFilter;
}

export interface AnalyticsSummary {
  totalClients: number;
  activeClients: number;
  archivedClients: number;
  consultations: number;
  newClients: number;
  upcomingConsultations: number;
  incompleteConsultations: number;
  nearestUpcoming?: string;
}

export interface AnalyticsTimelineItem {
  label: string;
  completed: number;
  planned: number;
  cancelled: number;
  noShow: number;
}

export interface AnalyticsClientRow {
  id: string;
  name: string;
  initials: string;
  color: string;
  status: string;
  consultations: number;
  lastMeeting?: string;
  nextMeeting?: string;
  currentRequest: string;
  lastActivity?: string;
}

export interface AnalyticsWorkloadItem {
  day: string;
  count: number;
}

export interface AnalyticsAnalysisType {
  label: string;
  count: number;
  percent: number;
}

export interface AnalyticsPaymentRow {
  id: string;
  consultationDate: string;
  client: string;
  consultation: string;
  charged: number;
  paid: number;
  status: string;
  paymentDate?: string;
  comment?: string;
}

export interface AnalyticsIncomeItem {
  label: string;
  received: number;
}

export interface AnalyticsResponse {
  filters: AnalyticsFilters & { from: string; to: string };
  summary: AnalyticsSummary;
  consultationsTimeline: AnalyticsTimelineItem[];
  yearTimeline: AnalyticsTimelineItem[];
  clients: AnalyticsClientRow[];
  workloadByWeekday: AnalyticsWorkloadItem[];
  analysisTypes: AnalyticsAnalysisType[];
  finance: {
    charged: number;
    received: number;
    paymentsConfigured: boolean;
  };
  payments: AnalyticsPaymentRow[];
  incomeTimeline: AnalyticsIncomeItem[];
  yearIncomeTimeline: AnalyticsIncomeItem[];
  generatedAt: string;
}

const MS_DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value: string | undefined, fallback: Date) {
  if (!value) return fallback;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function resolvePeriod(filters: AnalyticsFilters) {
  const now = new Date();
  let from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  let to = endOfDay(now);

  if (filters.preset === "today") from = startOfDay(now);
  if (filters.preset === "week") from = startOfDay(new Date(now.getTime() - 6 * MS_DAY));
  if (filters.preset === "3m") from = startOfDay(new Date(now.getFullYear(), now.getMonth() - 2, 1));
  if (filters.preset === "6m") from = startOfDay(new Date(now.getFullYear(), now.getMonth() - 5, 1));
  if (filters.preset === "year") from = startOfDay(new Date(now.getFullYear(), 0, 1));
  if (filters.preset === "all") from = new Date(0);
  if (filters.preset === "custom") {
    from = parseDate(filters.from, from);
    to = endOfDay(parseDate(filters.to, now));
  }

  return { from, to };
}

function inPeriod(iso: string | undefined, from: Date, to: Date) {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return time >= from.getTime() && time <= to.getTime();
}

function formatShortDate(iso: string | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}

function formatEventDate(iso: string | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", { month: "short" }).format(date).replace(".", "");
}

function clientMatchesFilter(client: StoredClient, filter: AnalyticsClientFilter) {
  if (filter === "all") return true;
  if (filter === "active") return client.status === "active" || client.status === "paused";
  if (filter === "archived") return client.status === "archived" || client.status === "completed";
  return client.id === filter;
}

function consultationClientId(consultation: StoredConsultation) {
  return consultation.clientId || "";
}

function consultationMatchesClient(consultation: StoredConsultation, clientIds: Set<string>) {
  if (!clientIds.size) return false;
  return clientIds.has(consultationClientId(consultation));
}

function eventMatchesClient(event: CalendarEvent, clientIds: Set<string>) {
  if (!clientIds.size) return false;
  return event.clientId ? clientIds.has(event.clientId) : false;
}

function bucketTimeline(consultations: StoredConsultation[], events: CalendarEvent[], from: Date, to: Date): AnalyticsTimelineItem[] {
  const spanDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / MS_DAY));
  const bucketCount = Math.min(8, Math.max(1, Math.ceil(spanDays / 7)));
  const bucketSize = Math.max(1, Math.ceil(spanDays / bucketCount));
  const buckets: AnalyticsTimelineItem[] = Array.from({ length: bucketCount }, (_, index) => {
    const start = new Date(from.getTime() + index * bucketSize * MS_DAY);
    const end = new Date(Math.min(to.getTime(), start.getTime() + (bucketSize - 1) * MS_DAY));
    const label = bucketSize > 20
      ? monthLabel(start)
      : `${start.getDate()}–${end.getDate()} ${monthLabel(end)}`;
    return { label, completed: 0, planned: 0, cancelled: 0, noShow: 0 };
  });

  function bucketIndex(iso: string) {
    return Math.min(bucketCount - 1, Math.max(0, Math.floor((new Date(iso).getTime() - from.getTime()) / (bucketSize * MS_DAY))));
  }

  for (const consultation of consultations) {
    if (!inPeriod(consultation.createdAt, from, to)) continue;
    const bucket = buckets[bucketIndex(consultation.createdAt)];
    if (consultation.status === "error") bucket.cancelled += 1;
    else bucket.completed += 1;
  }

  for (const event of events) {
    if (!inPeriod(event.startsAt, from, to)) continue;
    const bucket = buckets[bucketIndex(event.startsAt)];
    if (event.status === "planned") bucket.planned += 1;
    if (event.status === "cancelled") bucket.cancelled += 1;
    if (event.status === "no_show") bucket.noShow += 1;
    if (event.status === "completed") bucket.completed += 1;
  }

  return buckets;
}

function workload(consultations: StoredConsultation[], from: Date, to: Date): AnalyticsWorkloadItem[] {
  const counts = new Array(7).fill(0) as number[];
  for (const consultation of consultations) {
    if (!inPeriod(consultation.createdAt, from, to)) continue;
    const day = new Date(consultation.createdAt).getDay();
    counts[day === 0 ? 6 : day - 1] += 1;
  }
  return WEEKDAYS.map((day, index) => ({ day, count: counts[index] }));
}

function analysisTypes(consultations: StoredConsultation[]): AnalyticsAnalysisType[] {
  const counts = new Map<string, number>();
  let total = 0;
  for (const consultation of consultations) {
    const analyses = consultation.analyses ?? [];
    if (!analyses.length) {
      counts.set("Без анализа", (counts.get("Без анализа") ?? 0) + 1);
      total += 1;
      continue;
    }
    for (const analysis of analyses) {
      const label = analysis.mode || "Анализ";
      counts.set(label, (counts.get(label) ?? 0) + 1);
      total += 1;
    }
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, percent: total ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);
}

function incomeTimeline(from: Date, to: Date, payments: ConsultationPayment[] = []): AnalyticsIncomeItem[] {
  const months: AnalyticsIncomeItem[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const last = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cursor <= last && months.length < 12) {
    months.push({ label: monthLabel(cursor), received: 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const timeline = months.length ? months : [{ label: monthLabel(new Date()), received: 0 }];
  for (const payment of payments) {
    const date = new Date(payment.paymentDate ?? payment.updatedAt);
    const label = monthLabel(date);
    const bucket = timeline.find((item) => item.label === label);
    if (bucket) bucket.received += payment.paidAmount;
  }
  return timeline;
}

async function safeCurrentRequests() {
  try {
    return await getAllCurrentRequests();
  } catch {
    return {};
  }
}

async function safeClients() {
  try {
    return await getClients();
  } catch (error) {
    console.error("[analytics] clients source failed", error);
    return [];
  }
}

async function safeConsultations() {
  try {
    return await getConsultations();
  } catch (error) {
    console.error("[analytics] consultations source failed", error);
    return [];
  }
}

async function safeCalendarEvents(from: Date, to: Date) {
  try {
    return await getCalendarEvents(from.toISOString(), to.toISOString());
  } catch (error) {
    console.error("[analytics] calendar source failed", error);
    return [];
  }
}

async function safePayments(): Promise<{ rows: ConsultationPayment[]; configured: boolean }> {
  try {
    return { rows: await getPayments(), configured: true };
  } catch (error) {
    console.error("[analytics] payments source failed", error);
    return { rows: [], configured: false };
  }
}

export async function getAnalytics(filters: AnalyticsFilters): Promise<AnalyticsResponse> {
  const { from, to } = resolvePeriod(filters);
  const now = new Date();
  const futureTo = new Date(now.getTime() + 180 * MS_DAY);
  const [clients, consultations, periodEvents, futureEvents, currentRequests, paymentsResult] = await Promise.all([
    safeClients(),
    safeConsultations(),
    safeCalendarEvents(from, to),
    safeCalendarEvents(now, futureTo),
    safeCurrentRequests(),
    safePayments(),
  ]);

  const filteredClients = clients.filter((client) => clientMatchesFilter(client, filters.client));
  const clientIds = new Set(filteredClients.map((client) => client.id));
  const filteredConsultations = consultations
    .filter((consultation) => consultationMatchesClient(consultation, clientIds))
    .filter((consultation) => inPeriod(consultation.createdAt, from, to));
  const filteredPeriodEvents = periodEvents.filter((event) => eventMatchesClient(event, clientIds));
  const filteredFutureEvents = futureEvents
    .filter((event) => event.status === "planned" && new Date(event.startsAt) >= now)
    .filter((event) => eventMatchesClient(event, clientIds))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const consultationsByClient = new Map<string, StoredConsultation[]>();
  for (const consultation of consultations) {
    if (!consultation.clientId) continue;
    if (!consultationsByClient.has(consultation.clientId)) consultationsByClient.set(consultation.clientId, []);
    consultationsByClient.get(consultation.clientId)!.push(consultation);
  }

  const eventsByClient = new Map<string, CalendarEvent[]>();
  for (const event of [...periodEvents, ...futureEvents]) {
    if (!event.clientId) continue;
    if (!eventsByClient.has(event.clientId)) eventsByClient.set(event.clientId, []);
    eventsByClient.get(event.clientId)!.push(event);
  }

  const rows = filteredClients.map((client) => {
    const clientConsultations = (consultationsByClient.get(client.id) ?? [])
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const clientEvents = (eventsByClient.get(client.id) ?? [])
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    const last = clientConsultations[0];
    const next = clientEvents.find((event) => event.status === "planned" && new Date(event.startsAt) >= now);
    const lastActivity = [last?.createdAt, currentRequests[client.id] ? client.createdAt : undefined]
      .filter(Boolean)
      .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0];
    return {
      id: client.id,
      name: client.name,
      initials: client.initials,
      color: client.color,
      status: client.status,
      consultations: clientConsultations.length,
      lastMeeting: last?.createdAt,
      nextMeeting: next?.startsAt,
      currentRequest: currentRequests[client.id] || client.currentFocus || client.concern || "—",
      lastActivity,
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "ru"));

  const incomplete = filteredConsultations.filter((consultation) => {
    const hasTranscript = Boolean(consultation.transcript?.text);
    const hasAnalysis = Boolean(consultation.analyses?.length);
    return consultation.status === "error" || consultation.status !== "done" || !hasTranscript || !hasAnalysis;
  }).length;

  const consultationMap = new Map(consultations.map((item) => [item.id, item]));
  const filteredPayments = paymentsResult.rows
    .filter((payment) => !payment.clientId || clientIds.has(payment.clientId))
    .filter((payment) => {
      const consultation = consultationMap.get(payment.consultationId);
      return inPeriod(consultation?.createdAt ?? payment.createdAt, from, to)
        || inPeriod(payment.paymentDate ?? payment.updatedAt, from, to);
    });
  const paymentRows: AnalyticsPaymentRow[] = filteredPayments.map((payment) => {
    const consultation = consultationMap.get(payment.consultationId);
    return {
      id: payment.id,
      consultationDate: consultation?.createdAt ?? payment.createdAt,
      client: rows.find((row) => row.id === payment.clientId)?.name ?? consultation?.clientName ?? "Без клиента",
      consultation: consultation?.title || "Консультация",
      charged: payment.chargedAmount,
      paid: payment.paidAmount,
      status: payment.paymentStatus,
      paymentDate: payment.paymentDate,
      comment: payment.comment,
    };
  });
  const charged = filteredPayments.reduce((sum, payment) => sum + payment.chargedAmount, 0);
  const received = filteredPayments.reduce((sum, payment) => sum + payment.paidAmount, 0);

  return {
    filters: { ...filters, from: isoDate(from), to: isoDate(to) },
    summary: {
      totalClients: filteredClients.length,
      activeClients: filteredClients.filter((client) => client.status === "active" || client.status === "paused").length,
      archivedClients: filteredClients.filter((client) => client.status === "archived" || client.status === "completed").length,
      consultations: filteredConsultations.length,
      newClients: filteredClients.filter((client) => inPeriod(client.createdAt, from, to)).length,
      upcomingConsultations: filteredFutureEvents.length,
      incompleteConsultations: incomplete,
      nearestUpcoming: filteredFutureEvents[0]?.startsAt,
    },
    consultationsTimeline: bucketTimeline(filteredConsultations, filteredPeriodEvents, from, to),
    yearTimeline: bucketTimeline(
      consultations.filter(c => consultationMatchesClient(c, clientIds)),
      await safeCalendarEvents(new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear(), 11, 31)),
      new Date(now.getFullYear(), 0, 1),
      new Date(now.getFullYear(), 11, 31),
    ),
    clients: rows,
    workloadByWeekday: workload(filteredConsultations, from, to),
    analysisTypes: analysisTypes(filteredConsultations),
    finance: {
      charged,
      received,
      paymentsConfigured: paymentsResult.configured,
    },
    payments: paymentRows,
    incomeTimeline: incomeTimeline(from, to, filteredPayments),
    yearIncomeTimeline: incomeTimeline(
      new Date(now.getFullYear(), 0, 1),
      new Date(now.getFullYear(), 11, 31),
      paymentsResult.rows,
    ),
    generatedAt: new Date().toISOString(),
  };
}

export const analyticsFormatters = {
  formatShortDate,
  formatEventDate,
};
