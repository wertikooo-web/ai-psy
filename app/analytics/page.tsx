"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3, CalendarDays, Check, ChevronDown, Clipboard, Download,
  FileSpreadsheet, Loader2, Printer, RefreshCw, Search, Users,
  UserPlus, CalendarClock, AlertTriangle, WalletCards, FileText,
} from "lucide-react";
import type { AnalyticsResponse } from "@/lib/data/analytics";

type PeriodPreset = "today" | "week" | "month" | "3m" | "6m" | "year" | "all" | "custom";
type ClientMode = "all" | "active" | "archived" | string;

const periodLabels: Record<PeriodPreset, string> = {
  today: "Сегодня",
  week: "Неделя",
  month: "Месяц",
  "3m": "3 месяца",
  "6m": "6 месяцев",
  year: "Год",
  all: "Всё время",
  custom: "Период",
};

const statusLabels: Record<string, string> = {
  active: "Активный",
  paused: "Пауза",
  archived: "Архив",
  completed: "Завершён",
};

const nf = new Intl.NumberFormat("ru-RU");
const money = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}

function formatDateTime(iso?: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function toTsv(rows: string[][]) {
  return rows.map((row) => row.map((cell) => String(cell).replace(/\t/g, " ").replace(/\r?\n/g, " ")).join("\t")).join("\n");
}

function downloadText(filename: string, content: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function SummaryCard({
  icon: Icon, title, value, note, tone,
}: {
  icon: React.ElementType;
  title: string;
  value: string | number;
  note: string;
  tone: "violet" | "blue" | "green" | "orange" | "red";
}) {
  const colors = {
    violet: ["#8B5CF6", "#F5F0FF"],
    blue: ["#3B82F6", "#EEF6FF"],
    green: ["#22A366", "#EFFAF3"],
    orange: ["#F28C28", "#FFF6EA"],
    red: ["#E66B6B", "#FFF1F1"],
  }[tone];
  return (
    <section className="rounded-xl border border-[#E6DDD0] bg-white px-3 py-3 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: colors[1], color: colors[0] }}>
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#4D4034]">{title}</p>
          <p className="mt-1 text-2xl font-bold leading-none text-[#111827]">{value}</p>
          <p className="mt-1 truncate text-xs leading-snug text-[#7B6F60]">{note}</p>
        </div>
      </div>
    </section>
  );
}

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`min-h-0 overflow-hidden rounded-xl border border-[#E6DDD0] bg-white p-3 shadow-sm ${className}`}>
      <h2 className="mb-2 text-sm font-bold text-[#2F261F]">{title}</h2>
      {children}
    </section>
  );
}

function StackedBars({ data }: { data: AnalyticsResponse["consultationsTimeline"] }) {
  const max = Math.max(1, ...data.map((item) => item.completed + item.planned + item.cancelled + item.noShow));
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 items-end gap-3 border-b border-[#ECE5DA] pl-2">
        {data.map((item) => {
          const total = item.completed + item.planned + item.cancelled + item.noShow;
          const barHeight = total ? Math.max(34, (total / max) * 150) : 8;
          return (
            <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex h-[clamp(112px,18vh,168px)] w-full flex-col items-center justify-end">
                <span className="mb-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-[#D9CDBE] bg-white px-1.5 text-[11px] font-bold text-[#6F6255] shadow-sm">
                  {total}
                </span>
                <div
                  className="flex w-full max-w-[34px] flex-col justify-end overflow-hidden rounded-t-md bg-[#F4EFE7]"
                  style={{ height: `${barHeight}px` }}
                  title={`${item.label}: ${total}`}
                >
                  {total > 0 && (
                    <>
                      <div style={{ height: `${(item.noShow / total) * 100}%`, background: "#AEB4BE" }} />
                      <div style={{ height: `${(item.cancelled / total) * 100}%`, background: "#F28C28" }} />
                      <div style={{ height: `${(item.planned / total) * 100}%`, background: "#7C8FF7" }} />
                      <div style={{ height: `${(item.completed / total) * 100}%`, background: "#8B5CF6" }} />
                    </>
                  )}
                </div>
              </div>
              <span className="text-center text-[11px] leading-tight text-[#7B6F60]">{item.label}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex shrink-0 flex-wrap gap-x-4 gap-y-1 text-xs text-[#6F6255]">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#8B5CF6]" />Проведённые</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#7C8FF7]" />Запланированные</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#F28C28]" />Отменённые</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#AEB4BE]" />Неявки</span>
      </div>
    </div>
  );
}

function WorkloadChart({ data }: { data: AnalyticsResponse["workloadByWeekday"] }) {
  const max = Math.max(1, ...data.map((item) => item.count));
  return (
    <div className="space-y-1.5 pb-1">
      {data.map((item) => (
        <div key={item.day} className="grid grid-cols-[95px_1fr_28px] items-center gap-3 text-xs">
          <span className="text-[#4D4034]">{item.day}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-[#F2EDE4]">
            <span className="block h-full rounded-full bg-[#8B5CF6]" style={{ width: `${(item.count / max) * 100}%` }} />
          </span>
          <b className="text-right text-[#2F261F]">{item.count}</b>
        </div>
      ))}
    </div>
  );
}

function AnalysisDonut({ data }: { data: AnalyticsResponse["analysisTypes"] }) {
  const colors = ["#8B5CF6", "#3B82F6", "#64B97A", "#F28C28", "#AEB4BE", "#D36A6A"];
  const total = Math.max(1, data.reduce((sum, item) => sum + item.count, 0));
  let offset = 0;
  const gradient = data.length
    ? data.map((item, index) => {
      const start = offset;
      offset += (item.count / total) * 100;
      return `${colors[index % colors.length]} ${start}% ${offset}%`;
    }).join(", ")
    : "#EDE7DA 0 100%";
  return (
    <div className="grid grid-cols-[112px_1fr] gap-4">
      <div className="relative h-28 w-28 rounded-full" style={{ background: `conic-gradient(${gradient})` }}>
        <div className="absolute inset-7 rounded-full bg-white" />
      </div>
      <div className="space-y-1.5">
        {data.length ? data.map((item, index) => (
          <div key={item.label} className="grid grid-cols-[10px_1fr_auto] items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[index % colors.length] }} />
            <span className="truncate text-[#4D4034]">{item.label}</span>
            <b className="text-[#2F261F]">{item.count} ({item.percent}%)</b>
          </div>
        )) : <p className="text-sm text-[#7B6F60]">Анализы за период отсутствуют</p>}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<PeriodPreset>("month");
  const [client, setClient] = useState<ClientMode>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [toast, setToast] = useState("");

  const params = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("period", period);
    sp.set("client", client);
    if (period === "custom") {
      if (from) sp.set("from", from);
      if (to) sp.set("to", to);
    }
    return sp;
  }, [period, client, from, to]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/analytics?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("load failed");
      const json = await res.json() as AnalyticsResponse;
      setData(json);
      window.history.replaceState(null, "", `/analytics?${params.toString()}`);
    } catch {
      setError("Не удалось загрузить аналитику");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [params]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const visibleClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    return data?.clients.filter((row) => !q || row.name.toLowerCase().includes(q)) ?? [];
  }, [data, clientSearch]);

  function copySummary() {
    if (!data) return;
    const text = [
      `Аналитика за ${data.filters.from} - ${data.filters.to}`,
      `Клиенты: ${data.summary.totalClients}`,
      `Активные: ${data.summary.activeClients}`,
      `Архив: ${data.summary.archivedClients}`,
      `Консультации: ${data.summary.consultations}`,
      `Новые клиенты: ${data.summary.newClients}`,
      `Начислено: ${money.format(data.finance.charged)} MDL`,
      `Получено: ${money.format(data.finance.received)} MDL`,
    ].join("\n");
    navigator.clipboard.writeText(text);
    setToast("Сводка скопирована");
  }

  function copyClients() {
    if (!data) return;
    const rows = [["Клиент", "Статус", "Консультаций", "Последняя встреча", "Следующая встреча", "Текущий запрос"]];
    for (const row of data.clients) rows.push([row.name, statusLabels[row.status] ?? row.status, String(row.consultations), formatDate(row.lastMeeting), formatDateTime(row.nextMeeting), row.currentRequest]);
    navigator.clipboard.writeText(toTsv(rows));
    setToast("Таблица клиентов скопирована");
  }

  function exportCsv() {
    if (!data) return;
    const rows = [["Клиент", "Статус", "Консультаций", "Последняя встреча", "Следующая встреча", "Текущий запрос"]];
    for (const row of data.clients) rows.push([row.name, statusLabels[row.status] ?? row.status, String(row.consultations), formatDate(row.lastMeeting), formatDateTime(row.nextMeeting), row.currentRequest]);
    downloadText("analytics-clients.csv", "\ufeff" + rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n"), "text/csv;charset=utf-8");
  }

  function exportJson() {
    if (!data) return;
    downloadText("analytics-report.json", JSON.stringify(data, null, 2), "application/json;charset=utf-8");
  }

  const maxIncome = Math.max(1, ...(data?.incomeTimeline.map((item) => item.received) ?? [0]));

  return (
    <div className="h-full overflow-hidden bg-[#F7F3EA] p-4 text-[#2F261F] print:bg-white">
      <div className="mx-auto flex h-full max-w-[1540px] flex-col gap-3">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Аналитика</h1>
            <div className="flex items-center gap-2 rounded-lg border border-[#E6DDD0] bg-white px-3 py-2 text-sm">
              <CalendarDays size={15} />
              <select value={period} onChange={(e) => setPeriod(e.target.value as PeriodPreset)} className="bg-transparent outline-none">
                {Object.entries(periodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            {period === "custom" && (
              <>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-[#E6DDD0] bg-white px-3 py-2 text-sm outline-none" />
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-[#E6DDD0] bg-white px-3 py-2 text-sm outline-none" />
              </>
            )}
            <div className="flex items-center gap-2 rounded-lg border border-[#E6DDD0] bg-white px-3 py-2 text-sm">
              <Users size={15} />
              <select value={client} onChange={(e) => setClient(e.target.value)} className="min-w-[150px] bg-transparent outline-none">
                <option value="all">Все клиенты</option>
                <option value="active">Активные</option>
                <option value="archived">Архивные</option>
                {data?.clients.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-[#E6DDD0] bg-white px-3 py-2 text-sm font-semibold hover:bg-[#FBF8F5]">
              <RefreshCw size={15} /> Обновить
            </button>
            <button onClick={copySummary} className="inline-flex items-center gap-2 rounded-lg border border-[#E6DDD0] bg-white px-3 py-2 text-sm font-semibold hover:bg-[#FBF8F5]">
              <Clipboard size={15} /> Копировать
            </button>
            <div className="group relative">
              <button className="inline-flex items-center gap-2 rounded-lg border border-[#E6DDD0] bg-white px-3 py-2 text-sm font-semibold hover:bg-[#FBF8F5]">
                <Download size={15} /> Экспорт <ChevronDown size={14} />
              </button>
              <div className="invisible absolute right-0 z-20 mt-1 w-44 rounded-lg border border-[#E6DDD0] bg-white p-1 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
                <button onClick={exportCsv} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-[#F7F3EA]"><FileSpreadsheet size={14} /> CSV</button>
                <button onClick={exportJson} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-[#F7F3EA]"><FileText size={14} /> JSON</button>
              </div>
            </div>
            <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-[#E6DDD0] bg-white px-3 py-2 text-sm font-semibold hover:bg-[#FBF8F5]">
              <Printer size={15} /> Печать
            </button>
          </div>
        </header>

        {loading && (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-[#E6DDD0] bg-white">
            <Loader2 className="animate-spin text-[#8B5CF6]" size={32} />
          </div>
        )}

        {error && !loading && (
          <div className="rounded-xl border border-[#E9B9B9] bg-[#FFF1F1] p-5 text-[#7A2F2F]">
            {error}
          </div>
        )}

        {data && !loading && !error && (
          <>
            <div className="grid shrink-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              <SummaryCard icon={Users} title="Всего клиентов" value={data.summary.totalClients} note={`${data.summary.activeClients} активных · ${data.summary.archivedClients} в архиве`} tone="violet" />
              <SummaryCard icon={CalendarDays} title="Консультаций за период" value={data.summary.consultations} note={`${data.filters.from} — ${data.filters.to}`} tone="blue" />
              <SummaryCard icon={UserPlus} title="Новых клиентов" value={data.summary.newClients} note="По дате создания клиента" tone="green" />
              <SummaryCard icon={CalendarClock} title="Предстоящих консультаций" value={data.summary.upcomingConsultations} note={data.summary.nearestUpcoming ? `Ближайшая ${formatDateTime(data.summary.nearestUpcoming)}` : "Будущих встреч нет"} tone="orange" />
              <SummaryCard icon={AlertTriangle} title="Незавершённые консультации" value={data.summary.incompleteConsultations} note="Без транскрипта, анализа или с ошибкой" tone="red" />
            </div>

            <div className="grid min-h-0 flex-[1.28] grid-cols-1 gap-3 xl:grid-cols-[1.02fr_1.55fr]">
              <Panel title="Консультации по неделям" className="h-full">
                <StackedBars data={data.consultationsTimeline} />
              </Panel>
              <Panel title="Клиенты" className="h-full">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="flex w-full max-w-[330px] items-center gap-2 rounded-lg border border-[#E6DDD0] bg-white px-3 py-2 text-sm">
                    <Search size={14} className="text-[#9A8A72]" />
                    <input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Поиск по имени клиента" className="w-full bg-transparent outline-none" />
                  </label>
                  <button onClick={copyClients} className="text-sm font-semibold text-[#6B4E2E] hover:underline">Скопировать таблицу</button>
                </div>
                <div className="max-h-[calc(100%-52px)] overflow-auto pb-1 pr-1">
                  <table className="w-full min-w-[760px] text-left text-[13px] [&_td]:py-1.5 [&_th]:py-1.5">
                    <thead className="text-xs text-[#8A7A66]">
                      <tr className="border-b border-[#ECE5DA]">
                        <th className="py-2 pr-3">Клиент</th>
                        <th className="py-2 pr-3">Статус</th>
                        <th className="py-2 pr-3">Консультаций</th>
                        <th className="py-2 pr-3">Последняя встреча</th>
                        <th className="py-2 pr-3">Следующая встреча</th>
                        <th className="py-2 pr-3">Текущий запрос</th>
                        <th className="py-2">Последняя активность</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleClients.map((row) => (
                        <tr key={row.id} className="border-b border-[#F0E8DC] hover:bg-[#FBF8F5]">
                          <td className="py-2 pr-3">
                            <Link href={`/client/${row.id}`} className="flex items-center gap-2 font-semibold text-[#2F261F]">
                              <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs text-white" style={{ background: row.color }}>{row.initials}</span>
                              {row.name}
                            </Link>
                          </td>
                          <td className="py-2 pr-3"><span className="rounded-full bg-[#EFFAF3] px-2 py-1 text-xs font-semibold text-[#2C7A4B]">{statusLabels[row.status] ?? row.status}</span></td>
                          <td className="py-2 pr-3 font-semibold">{row.consultations}</td>
                          <td className="py-2 pr-3">{formatDate(row.lastMeeting)}</td>
                          <td className="py-2 pr-3">{formatDateTime(row.nextMeeting)}</td>
                          <td className="max-w-[210px] truncate py-2 pr-3">{row.currentRequest}</td>
                          <td className="py-2">{formatDate(row.lastActivity)}</td>
                        </tr>
                      ))}
                      {!visibleClients.length && (
                        <tr><td colSpan={7} className="py-8 text-center text-[#7B6F60]">Клиенты не найдены</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>

            <div className="grid min-h-0 flex-[0.82] grid-cols-1 gap-3 xl:grid-cols-[1fr_1fr_1.08fr]">
              <Panel title="Нагрузка по дням недели" className="h-full">
                <WorkloadChart data={data.workloadByWeekday} />
              </Panel>
              <Panel title="Типы анализа" className="h-full">
                <AnalysisDonut data={data.analysisTypes} />
              </Panel>
              <Panel title="Оплата за период" className="h-full">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#E6DDD0] bg-[#F8FBFF] p-3">
                    <p className="text-xs font-semibold text-[#4D4034]">Начислено</p>
                    <p className="mt-1 text-xl font-bold">{money.format(data.finance.charged)} <span className="text-sm">MDL</span></p>
                  </div>
                  <div className="rounded-xl border border-[#E6DDD0] bg-[#F4FBF6] p-3">
                    <p className="text-xs font-semibold text-[#4D4034]">Получено</p>
                    <p className="mt-1 text-xl font-bold">{money.format(data.finance.received)} <span className="text-sm">MDL</span></p>
                  </div>
                </div>
                {!data.finance.paymentsConfigured && (
                  <p className="mt-3 rounded-lg bg-[#FFF8EA] p-2 text-xs leading-snug text-[#8A6432]">
                    Поля оплаты в текущей схеме не настроены, поэтому суммы не выдумываются.
                  </p>
                )}
              </Panel>
            </div>

            <div className="grid min-h-0 flex-[0.56] grid-cols-1 gap-3 xl:grid-cols-[1.5fr_1fr]">
              <Panel title="Оплаты по консультациям" className="h-full">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="text-xs text-[#8A7A66]">
                      <tr className="border-b border-[#ECE5DA]">
                        <th className="py-2 pr-3">Дата консультации</th>
                        <th className="py-2 pr-3">Клиент</th>
                        <th className="py-2 pr-3">Консультация</th>
                        <th className="py-2 pr-3">Стоимость</th>
                        <th className="py-2 pr-3">Оплачено</th>
                        <th className="py-2 pr-3">Статус</th>
                        <th className="py-2">Комментарий</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.payments.map((row) => (
                        <tr key={row.id} className="border-b border-[#F0E8DC]">
                          <td className="py-2 pr-3">{formatDate(row.consultationDate)}</td>
                          <td className="py-2 pr-3">{row.client}</td>
                          <td className="py-2 pr-3">{row.consultation}</td>
                          <td className="py-2 pr-3">{money.format(row.charged)}</td>
                          <td className="py-2 pr-3">{money.format(row.paid)}</td>
                          <td className="py-2 pr-3">{row.status}</td>
                          <td className="py-2">{row.comment ?? "—"}</td>
                        </tr>
                      ))}
                      {!data.payments.length && (
                        <tr><td colSpan={7} className="py-6 text-center text-[#7B6F60]">Оплаты за выбранный период отсутствуют</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel title="Доход по месяцам (получено)" className="h-full">
                <div className="flex h-[calc(100%-44px)] min-h-[96px] items-end gap-3 border-b border-[#ECE5DA] px-3">
                  {data.incomeTimeline.map((item) => (
                    <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                      <div className="w-full max-w-[42px] rounded-t-md bg-[#8B5CF6]" style={{ height: `${Math.max(4, (item.received / maxIncome) * 110)}px` }} title={`${item.label}: ${nf.format(item.received)} MDL`} />
                      <span className="text-xs text-[#7B6F60]">{item.label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-[#7B6F60]">
                  <WalletCards size={14} />
                  Реальные платежи появятся после добавления полей оплаты.
                </div>
              </Panel>
            </div>
          </>
        )}
      </div>
      {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#3D3228] px-4 py-2 text-sm font-semibold text-white shadow-lg">{toast}</div>}
    </div>
  );
}
