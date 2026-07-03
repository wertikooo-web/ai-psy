"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BarChart3, CalendarDays, Check, ChevronDown, Clipboard, Download,
  FileSpreadsheet, Loader2, Printer, RefreshCw, Search, Users,
  UserPlus, CalendarClock, AlertTriangle, WalletCards, FileText,
  ImageDown,
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

function escapeHtml(value: string | number | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function copyFormatted(html: string, plainText: string) {
  if ("ClipboardItem" in window && navigator.clipboard.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plainText], { type: "text/plain" }),
      }),
    ]);
    return;
  }
  await navigator.clipboard.writeText(plainText);
}

function inlineComputedStyles(source: HTMLElement, target: HTMLElement) {
  const style = window.getComputedStyle(source);
  target.setAttribute("style", Array.from(style).map((name) => `${name}:${style.getPropertyValue(name)};`).join(""));
  const sourceChildren = Array.from(source.children) as HTMLElement[];
  const targetChildren = Array.from(target.children) as HTMLElement[];
  sourceChildren.forEach((child, index) => inlineComputedStyles(child, targetChildren[index]));
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
    <section className="rounded-xl border border-[#E6DDD0] bg-white px-4 py-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: colors[1], color: colors[0] }}>
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#4D4034]">{title}</p>
          <p className="mt-1 text-2xl font-bold leading-none text-[#111827]">{value}</p>
          <p className="mt-1 text-xs leading-snug text-[#7B6F60]">{note}</p>
        </div>
      </div>
    </section>
  );
}

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#E6DDD0] bg-white p-4 shadow-sm ${className}`}>
      <h2 className="mb-3 text-sm font-bold text-[#2F261F]">{title}</h2>
      {children}
    </section>
  );
}

function StackedBars({ data }: { data: AnalyticsResponse["consultationsTimeline"] }) {
  const max = Math.max(1, ...data.map((item) => item.completed + item.planned + item.cancelled + item.noShow));
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid min-h-0 flex-1 auto-cols-[72px] grid-flow-col items-end gap-3 overflow-x-auto border-b border-[#ECE5DA] px-1 pb-1">
        {data.map((item) => {
          const total = item.completed + item.planned + item.cancelled + item.noShow;
          const barHeight = total ? Math.max(34, (total / max) * 150) : 8;
          return (
            <div key={item.label} className="flex min-w-0 flex-col items-center gap-2">
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
    <div className="flex h-full min-h-0 flex-col justify-between gap-1 pr-1">
      {data.map((item) => (
        <div key={item.day} className="grid grid-cols-[95px_1fr_28px] items-center gap-3 text-xs leading-none">
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
    <div className="grid h-full min-h-0 grid-cols-[112px_1fr] items-start gap-4">
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
  const dashboardRef = useRef<HTMLDivElement>(null);
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

  async function copySummary() {
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
    const cards = [
      ["Всего клиентов", data.summary.totalClients, `${data.summary.activeClients} активных · ${data.summary.archivedClients} в архиве`, "#F5F0FF"],
      ["Консультаций за период", data.summary.consultations, `${data.filters.from} — ${data.filters.to}`, "#EEF6FF"],
      ["Новых клиентов", data.summary.newClients, "По дате создания клиента", "#EFFAF3"],
      ["Предстоящих консультаций", data.summary.upcomingConsultations, data.summary.nearestUpcoming ? `Ближайшая ${formatDateTime(data.summary.nearestUpcoming)}` : "Будущих встреч нет", "#FFF6EA"],
      ["Незавершённые консультации", data.summary.incompleteConsultations, "Без транскрипта, анализов либо материалов", "#FFF1F1"],
    ];
    const html = `
      <div style="font-family:Arial,sans-serif;color:#2F261F;background:#F7F3EA;padding:16px;border-radius:14px;">
        <h2 style="margin:0 0 12px;font-size:22px;">Аналитика</h2>
        <table style="border-collapse:separate;border-spacing:10px;width:100%;">
          <tr>
            ${cards.map(([title, value, note, bg]) => `
              <td style="background:#fff;border:1px solid #E6DDD0;border-radius:12px;padding:12px;vertical-align:top;">
                <div style="display:inline-block;background:${bg};border-radius:9px;padding:8px 10px;margin-bottom:8px;font-weight:700;">${escapeHtml(value)}</div>
                <div style="font-size:13px;font-weight:700;">${escapeHtml(title)}</div>
                <div style="font-size:12px;color:#7B6F60;margin-top:4px;">${escapeHtml(note)}</div>
              </td>
            `).join("")}
          </tr>
        </table>
      </div>
    `;
    try {
      await copyFormatted(html, text);
      setToast("Сводка скопирована с форматированием");
    } catch {
      setToast("Не удалось скопировать");
    }
  }

  async function copyClients() {
    if (!data) return;
    const rows = [["Клиент", "Статус", "Консультаций", "Последняя встреча", "Следующая встреча", "Текущий запрос", "Последняя активность"]];
    for (const row of data.clients) rows.push([row.name, statusLabels[row.status] ?? row.status, String(row.consultations), formatDate(row.lastMeeting), formatDateTime(row.nextMeeting), row.currentRequest, formatDate(row.lastActivity)]);
    const html = `
      <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;color:#2F261F;min-width:760px;">
        <thead>
          <tr style="background:#F7F3EA;color:#8A7A66;">
            ${rows[0].map((cell) => `<th style="border:1px solid #E6DDD0;padding:8px;text-align:left;">${escapeHtml(cell)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${data.clients.map((row) => `
            <tr>
              <td style="border:1px solid #E6DDD0;padding:8px;font-weight:700;">
                <span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:50%;background:${row.color};color:#fff;font-size:11px;margin-right:8px;">${escapeHtml(row.initials)}</span>
                ${escapeHtml(row.name)}
              </td>
              <td style="border:1px solid #E6DDD0;padding:8px;"><span style="background:#EFFAF3;color:#2C7A4B;border-radius:999px;padding:4px 8px;font-weight:700;font-size:12px;">${escapeHtml(statusLabels[row.status] ?? row.status)}</span></td>
              <td style="border:1px solid #E6DDD0;padding:8px;font-weight:700;">${escapeHtml(row.consultations)}</td>
              <td style="border:1px solid #E6DDD0;padding:8px;">${escapeHtml(formatDate(row.lastMeeting))}</td>
              <td style="border:1px solid #E6DDD0;padding:8px;">${escapeHtml(formatDateTime(row.nextMeeting))}</td>
              <td style="border:1px solid #E6DDD0;padding:8px;">${escapeHtml(row.currentRequest)}</td>
              <td style="border:1px solid #E6DDD0;padding:8px;">${escapeHtml(formatDate(row.lastActivity))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
    try {
      await copyFormatted(html, toTsv(rows));
      setToast("Таблица скопирована с форматированием");
    } catch {
      setToast("Не удалось скопировать таблицу");
    }
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

  async function exportJpg() {
    const source = dashboardRef.current;
    if (!source) return;
    try {
      const rect = source.getBoundingClientRect();
      const width = Math.ceil(rect.width);
      const height = Math.ceil(rect.height);
      const clone = source.cloneNode(true) as HTMLElement;
      inlineComputedStyles(source, clone);
      clone.style.width = `${width}px`;
      clone.style.height = `${height}px`;
      clone.style.background = "#F7F3EA";
      const html = new XMLSerializer().serializeToString(clone);
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml">${html}</div>
          </foreignObject>
        </svg>
      `;
      const image = new Image();
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("image export failed"));
        image.src = url;
      });
      const canvas = document.createElement("canvas");
      const scale = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas unavailable");
      ctx.fillStyle = "#F7F3EA";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/jpeg", 0.92);
      a.download = `analytics-${data?.filters.from ?? "report"}-${data?.filters.to ?? "today"}.jpg`;
      a.click();
      setToast("JPG сохранён");
    } catch {
      setToast("Не удалось сохранить JPG");
    }
  }

  const maxIncome = Math.max(1, ...(data?.incomeTimeline.map((item) => item.received) ?? [0]));

  // Last 6 months of income for mobile bar chart
  const mobileBarData = data?.incomeTimeline.slice(-6) ?? [];
  const mobileBarMax = Math.max(1, ...mobileBarData.map((item) => item.received));

  return (
    <>
    {/* ── MOBILE LAYOUT ── */}
    <div className="lg:hidden flex-1 min-h-0 flex flex-col overflow-hidden pb-16" style={{ background: "#FBF8F5" }}>
      {/* Header */}
      <div className="flex-shrink-0" style={{ background: "#FBF8F5", borderBottom: "1px solid #CFC0A9", padding: "12px 16px" }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: "#3D3228" }}>Аналитика</span>
      </div>

      <div className="flex-1 min-h-0 flex flex-col" style={{ padding: "12px 16px", gap: 10, overflow: "hidden" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
            <Loader2 className="animate-spin" style={{ color: "#A8997F" }} size={28} />
          </div>
        ) : data ? (
          <>
            {/* 2×2 KPI grid */}
            <div className="flex-shrink-0" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={{ background: "#F3EBDD", border: "1px solid #CFC0A9", borderRadius: 14, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: "#A8997F", marginBottom: 2 }}>Клиентов</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#8B5CF6" }}>{data.summary.totalClients}</div>
                <div style={{ fontSize: 10, color: "#C9BBAA" }}>{data.summary.activeClients} активных</div>
              </div>
              <div style={{ background: "#F3EBDD", border: "1px solid #CFC0A9", borderRadius: 14, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: "#A8997F", marginBottom: 2 }}>Консультаций</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#3a5ff8" }}>{data.summary.consultations}</div>
                <div style={{ fontSize: 10, color: "#C9BBAA" }}>за период</div>
              </div>
              <div style={{ background: "#F3EBDD", border: "1px solid #CFC0A9", borderRadius: 14, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: "#A8997F", marginBottom: 2 }}>Получено</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#16a34a" }}>{money.format(data.finance.received)}</div>
                <div style={{ fontSize: 10, color: "#C9BBAA" }}>MDL</div>
              </div>
              <div style={{ background: "#F3EBDD", border: "1px solid #CFC0A9", borderRadius: 14, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: "#A8997F", marginBottom: 2 }}>Новых клиентов</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#d97706" }}>{data.summary.newClients}</div>
                <div style={{ fontSize: 10, color: "#C9BBAA" }}>за период</div>
              </div>
            </div>

            {/* Bar chart — takes remaining space */}
            <div className="flex-1 min-h-0 flex flex-col" style={{ background: "#F3EBDD", border: "1px solid #CFC0A9", borderRadius: 14, padding: "12px 14px", overflow: "hidden" }}>
              <div className="flex-shrink-0" style={{ fontSize: 13, fontWeight: 700, color: "#3D3228", marginBottom: 8 }}>Доход по месяцам</div>
              {mobileBarData.length === 0 ? (
                <div style={{ fontSize: 13, color: "#A8997F", textAlign: "center", padding: "16px 0" }}>Нет данных</div>
              ) : (
                <div className="flex-1 min-h-0 flex items-end" style={{ gap: 6, overflow: "hidden" }}>
                  {mobileBarData.map((item) => (
                    <div key={item.label} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, height: "100%" }}>
                      <div style={{ flex: 1, minHeight: 4, width: "100%", display: "flex", alignItems: "flex-end" }}>
                        <div style={{ width: "100%", background: "#8B5CF6", borderRadius: "4px 4px 0 0", height: `${Math.max(4, (item.received / mobileBarMax) * 100)}%` }} title={`${item.label}: ${money.format(item.received)}`} />
                      </div>
                      <span className="flex-shrink-0" style={{ fontSize: 10, color: "#A8997F" }}>{item.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : error ? (
          <div style={{ color: "#B42318", fontSize: 13, padding: "16px 0" }}>{error}</div>
        ) : null}
      </div>
    </div>

    {/* ── DESKTOP LAYOUT ── */}
    <div className="hidden lg:block flex-1 min-h-0 overflow-y-auto">
    <div ref={dashboardRef} className="h-full overflow-hidden bg-[#F7F3EA] p-4 text-[#2F261F] print:bg-white">
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
                <button onClick={exportJpg} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-[#F7F3EA]"><ImageDown size={14} /> JPG</button>
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
              <SummaryCard icon={AlertTriangle} title="Незавершённые консультации" value={data.summary.incompleteConsultations} note="Без транскрипта, анализов либо материалов" tone="red" />
            </div>

            <div className="grid min-h-0 flex-[1.28] grid-cols-1 gap-3">
              <Panel title="Консультации по месяцам" className="h-full">
                <StackedBars data={data.yearTimeline} />
              </Panel>
            </div>

            <div className="grid min-h-0 flex-[0.82] grid-cols-1 gap-3 xl:grid-cols-[1fr_1.08fr]">
              <Panel title="Нагрузка по дням недели" className="h-full">
                <WorkloadChart data={data.workloadByWeekday} />
              </Panel>
              <Panel title="Оплата за период" className="h-full">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#E6DDD0] bg-[#F8FBFF] p-4">
                    <p className="text-xs font-semibold text-[#4D4034]">Начислено</p>
                    <p className="mt-1 text-xl font-bold">{money.format(data.finance.charged)} <span className="text-sm">MDL</span></p>
                  </div>
                  <div className="rounded-xl border border-[#E6DDD0] bg-[#F4FBF6] p-4">
                    <p className="text-xs font-semibold text-[#4D4034]">Получено</p>
                    <p className="mt-1 text-xl font-bold">{money.format(data.finance.received)} <span className="text-sm">MDL</span></p>
                  </div>
                </div>
              </Panel>
            </div>

            <div className="grid min-h-0 flex-[0.56] grid-cols-1 gap-3 xl:grid-cols-[1.5fr_1fr]">
              <Panel title="Оплаты по консультациям" className="h-full">
                <div className="h-[calc(100%-34px)] min-h-0 overflow-auto pr-1">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="text-xs text-[#8A7A66]">
                      <tr className="border-b border-[#ECE5DA]">
                        <th className="py-2.5 pr-4">Дата консультации</th>
                        <th className="py-2.5 pr-4">Клиент</th>
                        <th className="py-2.5 pr-4">Консультация</th>
                        <th className="py-2.5 pr-4">Стоимость</th>
                        <th className="py-2.5 pr-4">Оплачено</th>
                        <th className="py-2.5 pr-4">Статус</th>
                        <th className="py-2.5">Комментарий</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.payments.map((row) => (
                        <tr key={row.id} className="border-b border-[#F0E8DC]">
                          <td className="py-2.5 pr-4">{formatDate(row.consultationDate)}</td>
                          <td className="py-2.5 pr-4">{row.client}</td>
                          <td className="py-2.5 pr-4">{row.consultation}</td>
                          <td className="py-2.5 pr-4">{money.format(row.charged)}</td>
                          <td className="py-2.5 pr-4">{money.format(row.paid)}</td>
                          <td className="py-2.5 pr-4">{row.status}</td>
                          <td className="py-2.5">{row.comment ?? "—"}</td>
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
                <div className="flex h-[calc(100%-44px)] min-h-[96px] items-end gap-1.5 overflow-x-auto border-b border-[#ECE5DA] px-2 pb-1">
                  {data.incomeTimeline.map((item) => (
                    <div key={item.label} className="flex flex-col items-center gap-1 flex-shrink-0" style={{ width: `${Math.max(28, Math.floor(100 / Math.max(data.incomeTimeline.length, 6)))}%`, maxWidth: 48 }}>
                      <div className="w-full rounded-t-md bg-[#8B5CF6]" style={{ height: `${Math.max(4, (item.received / maxIncome) * 110)}px` }} title={`${item.label}: ${nf.format(item.received)} MDL`} />
                      <span className="text-[10px] text-[#7B6F60] truncate w-full text-center">{item.label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-[#7B6F60]">
                  <WalletCards size={14} />
                  Доход считается по сохранённым оплатам консультаций.
                </div>
              </Panel>
            </div>
          </>
        )}
      </div>
      {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#3D3228] px-4 py-2 text-sm font-semibold text-white shadow-lg">{toast}</div>}
    </div>
    </div>{/* end hidden lg:block */}
    </>
  );
}
