"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X, BarChart2, CalendarDays, Target, FileText,
  BookOpen, Users, ChevronRight, Loader2, AlertCircle, Sparkles,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface VizData {
  actual_hours:    { learning: number; supervision: number };
  monthly_activity:{ month: number; learning: number; supervision: number }[];
  topics:          { category: string; hours: number; percent: number }[];
  year_targets:    { learning: number; supervision: number } | null;
  upcoming_events: { type: string; title: string; date: string; subtitle?: string }[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const MONTH_SHORT = ["", "янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];

const CAT_LABELS: Record<string, string> = {
  long_program: "Долгосрочная", qualification: "Квалификация",
  specialization: "Специализация", intensive: "Интенсив",
  webinar: "Вебинар", seminar: "Семинар", conference: "Конференция",
  masterclass: "Мастер-класс", online_course: "Онлайн-курс", other: "Другое",
};

const PALETTE = ["#3a5ff8","#7C3AED","#D97706","#16A34A","#EF4444","#9C8E80"];

const EVENT_ICONS: Record<string, React.ElementType> = {
  calendar: CalendarDays, goal: Target, document: FileText,
  course: BookOpen, supervision: Users,
};

// ── Focus message (rule-based, no AI) ─────────────────────────────────────────

function getFocusMessage(data: VizData): string {
  const { actual_hours, year_targets, monthly_activity, upcoming_events } = data;
  const { learning, supervision } = actual_hours;

  if (learning === 0 && supervision === 0) {
    return "Добавьте курс, супервизию или цель, чтобы получить краткий обзор";
  }

  if (year_targets) {
    const lPct  = year_targets.learning    > 0 ? learning    / year_targets.learning    : null;
    const sPct  = year_targets.supervision > 0 ? supervision / year_targets.supervision : null;

    if (lPct !== null && lPct >= 0.8 && sPct !== null && sPct < 0.5) {
      return `Вы выполнили ${Math.round(lPct * 100)}% плана по обучению, но супервизионных часов пока недостаточно (${Math.round(sPct * 100)}%)`;
    }
    if (lPct !== null && lPct >= 1) {
      return "Годовой план по обучению выполнен! Продолжайте в том же духе";
    }
    if (year_targets.learning > 0 && learning > 0) {
      const rem = Math.round(year_targets.learning - learning);
      if (rem > 0) return `До выполнения годового плана по обучению осталось ${rem} ч`;
    }
  }

  const curMonth = new Date().getMonth(); // 0-11
  const hasSup = monthly_activity.slice(0, curMonth + 1).some(m => m.supervision > 0);
  if (!hasSup) return "В этом году нет записей о супервизии — рекомендуем запланировать";

  if (upcoming_events.length > 0) {
    const next = upcoming_events[0];
    const days = Math.ceil((new Date(next.date).getTime() - Date.now()) / 86400000);
    if (days <= 7) return `Через ${days} дн. — ${next.title}`;
  }

  return `${learning} ч обучения и ${supervision} ч супервизий за год`;
}

// ── SVG Progress Ring ──────────────────────────────────────────────────────────

function ProgressRing({
  value, max, color, label, sub,
}: { value: number; max: number; color: string; label: string; sub: string }) {
  const pct  = max > 0 ? Math.min(value / max, 1) : 0;
  const r    = 32; const cx = 40; const cy = 40;
  const circ = 2 * Math.PI * r;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-[80px] h-[80px]">
        <svg viewBox="0 0 80 80" className="w-full h-full">
          <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth="7" stroke="#E8E0D4"
            style={{ transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px` }} />
          <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth="7" stroke={color}
            strokeLinecap="round"
            strokeDasharray={`${pct * circ} ${circ}`}
            style={{ transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px`,
              transition: "stroke-dasharray 0.4s ease" }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold" style={{ color: "#3D3228" }}>
            {max > 0 ? `${Math.round(pct * 100)}%` : `${value}`}
          </span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-xs font-semibold" style={{ color: "#3D3228" }}>{label}</div>
        <div className="text-[11px]" style={{ color: "#9C8E80" }}>{sub}</div>
      </div>
    </div>
  );
}

// ── SVG Donut Chart ────────────────────────────────────────────────────────────

function DonutChart({ slices }: { slices: { pct: number; color: string }[] }) {
  const r = 44; const cx = 56; const cy = 56; const sw = 18;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg viewBox="0 0 112 112" className="w-full max-w-[96px] flex-shrink-0">
      <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={sw} stroke="#E8E0D4" />
      {slices.map((s, i) => {
        const dash = (s.pct / 100) * circ;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            strokeWidth={sw} stroke={s.color}
            strokeDasharray={`${Math.max(dash - 1.5, 0)} ${circ}`}
            strokeDashoffset={-offset}
            style={{ transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px` }} />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}

// ── Monthly Bar Chart (CSS) ────────────────────────────────────────────────────

function MonthlyBars({ data }: { data: VizData["monthly_activity"] }) {
  const maxH = Math.max(...data.map(d => d.learning + d.supervision), 0.1);
  const hasData = data.some(d => d.learning > 0 || d.supervision > 0);

  if (!hasData) {
    return (
      <div className="h-20 flex items-center justify-center text-xs"
        style={{ color: "#9C8E80" }}>
        Пока нет активности за выбранный год
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end gap-[2px] h-20">
        {data.map(d => {
          const lH = (d.learning    / maxH) * 100;
          const sH = (d.supervision / maxH) * 100;
          return (
            <div key={d.month} className="flex-1 flex flex-col justify-end h-full cursor-default"
              title={`${MONTH_SHORT[d.month]}: ${d.learning}ч обуч., ${d.supervision}ч супервиз.`}>
              {sH > 0 && (
                <div style={{ height: `${sH}%`, background: "#7C3AED",
                  borderRadius: lH > 0 ? "0" : "2px 2px 0 0" }} />
              )}
              {lH > 0 && (
                <div style={{ height: `${lH}%`, background: "#3a5ff8",
                  borderRadius: "2px 2px 0 0" }} />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-[2px] mt-1">
        {data.map(d => (
          <div key={d.month} className="flex-1 text-center" style={{ fontSize: "8px", color: "#9C8E80" }}>
            {d.month % 3 === 1 ? MONTH_SHORT[d.month] : ""}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-1.5">
        <span className="flex items-center gap-1 text-[10px]" style={{ color: "#9C8E80" }}>
          <span className="inline-block w-2 h-2 rounded-sm" style={{ background: "#3a5ff8" }} />
          Обучение
        </span>
        <span className="flex items-center gap-1 text-[10px]" style={{ color: "#9C8E80" }}>
          <span className="inline-block w-2 h-2 rounded-sm" style={{ background: "#7C3AED" }} />
          Супервизии
        </span>
      </div>
    </div>
  );
}

// ── Card shell ─────────────────────────────────────────────────────────────────

function VizCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "#F3EBDD", border: "1px solid #CFC0A9" }}>
      <div className="text-xs font-semibold mb-3" style={{ color: "#3D3228" }}>{title}</div>
      {children}
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="text-xs py-2 text-center" style={{ color: "#9C8E80" }}>{text}</p>;
}

// ── Panel skeleton ─────────────────────────────────────────────────────────────

function PanelSkeleton() {
  return (
    <div className="p-4 space-y-3">
      {[100, 80, 120, 96].map((h, i) => (
        <div key={i} className="rounded-2xl animate-pulse" style={{ height: h, background: "#F3EBDD" }} />
      ))}
    </div>
  );
}

// ── Main VisualizationPanel ────────────────────────────────────────────────────

export function VisualizationPanel({
  year,
  onClose,
}: {
  year: number;
  onClose: () => void;
}) {
  const [data, setData]       = useState<VizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetch(`/api/professional-development/visualization?year=${year}`)
      .then(r => { if (!r.ok) throw new Error("Ошибка загрузки"); return r.json(); })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [year]);

  useEffect(() => { load(); }, [load]);

  return (
    <aside
      className="w-full xl:w-[390px] xl:flex-shrink-0 flex flex-col min-h-0"
      style={{ borderLeft: "1px solid #E5E5E5", background: "#FBF8F5" }}>

      {/* Sticky header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b"
        style={{ background: "#FBF8F5", borderColor: "#E5E5E5" }}>
        <span className="text-sm font-semibold" style={{ color: "#3D3228" }}>Статистика</span>
        <button
          onClick={onClose}
          title="Скрыть визуализацию"
          aria-label="Скрыть визуализацию"
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2"
          style={{ color: "#9C8E80" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#E8E0D4")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
          <X size={14} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto pb-16 xl:pb-4">
        {loading && <PanelSkeleton />}

        {!loading && error && (
          <div className="p-6 flex flex-col items-center gap-2 text-center">
            <AlertCircle size={20} style={{ color: "#EF4444" }} />
            <p className="text-xs" style={{ color: "#9C8E80" }}>Не удалось загрузить данные</p>
            <button onClick={load} className="text-xs underline" style={{ color: "#3a5ff8" }}>
              Повторить
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <div className="p-4 space-y-3">

            {/* 1 · Прогресс года */}
            <VizCard title="Прогресс года">
              {data.year_targets ? (
                <div className="flex justify-around">
                  <ProgressRing
                    value={data.actual_hours.learning}
                    max={data.year_targets.learning}
                    color="#3a5ff8"
                    label="Обучение"
                    sub={`${data.actual_hours.learning} / ${data.year_targets.learning} ч`}
                  />
                  <ProgressRing
                    value={data.actual_hours.supervision}
                    max={data.year_targets.supervision}
                    color="#7C3AED"
                    label="Супервизии"
                    sub={`${data.actual_hours.supervision} / ${data.year_targets.supervision} ч`}
                  />
                </div>
              ) : (
                <EmptyNote text="Укажите требования по часам в разделе Ассоциации, чтобы увидеть прогресс года" />
              )}
            </VizCard>

            {/* 2 · Форматы обучения (donut) */}
            <VizCard title="Форматы обучения">
              {data.topics.length > 0 ? (
                <div className="flex items-center gap-3">
                  <DonutChart slices={data.topics.map((t, i) => ({
                    pct: t.percent, color: PALETTE[i % PALETTE.length],
                  }))} />
                  <div className="flex-1 min-w-0 space-y-1">
                    {data.topics.map((t, i) => (
                      <div key={t.category} className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: PALETTE[i % PALETTE.length] }} />
                        <span className="text-[11px] truncate flex-1" style={{ color: "#6B7280" }}>
                          {CAT_LABELS[t.category] ?? t.category}
                        </span>
                        <span className="text-[11px] font-semibold flex-shrink-0"
                          style={{ color: "#3D3228" }}>
                          {t.percent}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyNote text="После добавления курсов здесь появится распределение по форматам" />
              )}
            </VizCard>

            {/* 3 · Активность по месяцам */}
            <VizCard title="Активность по месяцам">
              <MonthlyBars data={data.monthly_activity} />
            </VizCard>

            {/* 4 · Ближайшие события */}
            <VizCard title="Ближайшие события">
              {data.upcoming_events.length > 0 ? (
                <div className="space-y-2">
                  {data.upcoming_events.map((ev, i) => {
                    const Icon = EVENT_ICONS[ev.type] ?? CalendarDays;
                    const d = new Date(ev.date);
                    const dateStr = d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
                    const timeStr = d.getHours() > 0
                      ? d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
                      : "";
                    return (
                      <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                        style={{ background: "#EAE0D0", border: "1px solid #CFC0A9" }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: "#DDD4C6" }}>
                          <Icon size={13} style={{ color: "#3a5ff8" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate" style={{ color: "#3D3228" }}>
                            {ev.title}
                          </div>
                          <div className="text-[11px]" style={{ color: "#9C8E80" }}>
                            {dateStr}{timeStr ? ` · ${timeStr}` : ""}
                            {ev.subtitle ? ` · ${ev.subtitle}` : ""}
                          </div>
                        </div>
                        <ChevronRight size={12} className="flex-shrink-0" style={{ color: "#CFC0A9" }} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyNote text="Ближайшие профессиональные события не запланированы" />
              )}
            </VizCard>

            {/* 5 · Фокус месяца */}
            <div className="rounded-2xl p-4 flex items-start gap-3"
              style={{ background: "#F3EBDD", border: "1px solid #CFC0A9" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "#E8E0D4" }}>
                <Sparkles size={16} style={{ color: "#D97706" }} />
              </div>
              <div>
                <div className="text-xs font-semibold mb-1" style={{ color: "#3D3228" }}>
                  Фокус месяца
                </div>
                <div className="text-xs leading-relaxed" style={{ color: "#6B7280" }}>
                  {getFocusMessage(data)}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </aside>
  );
}
