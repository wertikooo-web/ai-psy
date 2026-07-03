"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X, CalendarDays, Target, FileText, BookOpen, Users,
  ChevronRight, AlertCircle, Sparkles, ArrowRight,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface VizData {
  actual_hours:     { learning: number; supervision: number };
  monthly_activity: { month: number; learning: number; supervision: number }[];
  topics:           { category: string; hours: number; percent: number }[];
  year_targets:     { learning: number; supervision: number } | null;
  upcoming_events:  { type: string; title: string; date: string; subtitle?: string }[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const MONTHS = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
const PALETTE = ["#3a5ff8","#7C3AED","#D97706","#16A34A","#EF4444","#9C8E80"];

const CAT_LABELS: Record<string, string> = {
  long_program:"Долгосрочная", qualification:"Квалификация", specialization:"Специализация",
  intensive:"Интенсив", webinar:"Вебинар", seminar:"Семинар", conference:"Конференция",
  masterclass:"Мастер-класс", online_course:"Онлайн-курс", other:"Другое",
};

const EVENT_COLOR: Record<string, string> = {
  calendar:"#3a5ff8", goal:"#16A34A", document:"#D97706",
  course:"#D97706", supervision:"#7C3AED",
};
const EVENT_ICON: Record<string, React.ElementType> = {
  calendar:CalendarDays, goal:Target, document:FileText,
  course:BookOpen, supervision:Users,
};

// ── Focus message (rule-based) ─────────────────────────────────────────────────

function focusMsg(data: VizData): string {
  const { actual_hours: { learning, supervision }, year_targets, monthly_activity, upcoming_events } = data;
  if (learning === 0 && supervision === 0)
    return "Добавьте обучение, супервизию или цель, чтобы получить обзор профессионального развития.";
  if (year_targets) {
    const lP = year_targets.learning    > 0 ? learning    / year_targets.learning    : null;
    const sP = year_targets.supervision > 0 ? supervision / year_targets.supervision : null;
    if (lP !== null && lP >= 0.8 && sP !== null && sP < 0.5)
      return `Вы закрыли ${Math.round(lP*100)}% годовой цели по обучению, но супервизии пока идут медленнее.`;
    if (lP !== null && lP < 0.5 && sP !== null && sP >= 0.8)
      return "Супервизии идут по плану, а обучение требует большего темпа.";
    if (lP !== null && lP >= 0.8 && sP !== null && sP >= 0.8)
      return "Профессиональное развитие идёт стабильно. Можно сосредоточиться на ближайших целях месяца.";
    if (year_targets.learning > 0) {
      const rem = Math.round(year_targets.learning - learning);
      if (rem > 0) return `До выполнения годовой цели по обучению осталось ${rem} ч.`;
    }
  }
  const m = new Date().getMonth();
  if (!monthly_activity.slice(0, m + 1).some(x => x.supervision > 0))
    return "В этом месяце нет записей о супервизии — рекомендуем запланировать.";
  if (upcoming_events.length > 0) {
    const days = Math.ceil((new Date(upcoming_events[0].date).getTime() - Date.now()) / 86400000);
    if (days <= 7) return `Через ${days} дн. — ${upcoming_events[0].title}`;
  }
  return `Обучение: ${learning} ч, супервизии: ${supervision} ч за год. Хороший темп!`;
}

// ── SVG Progress Ring ──────────────────────────────────────────────────────────

function Ring({ value, max, color, label, sub }: {
  value: number; max: number; color: string; label: string; sub: string;
}) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const r = 36; const c = 46; const circ = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: 92, height: 92 }}>
        <svg viewBox="0 0 92 92" className="w-full h-full">
          <circle cx={c} cy={c} r={r} fill="none" strokeWidth="7" stroke="#EDE8E2"
            style={{ transform: `rotate(-90deg)`, transformOrigin: `${c}px ${c}px` }} />
          <circle cx={c} cy={c} r={r} fill="none" strokeWidth="7" stroke={color}
            strokeLinecap="round"
            strokeDasharray={`${pct * circ} ${circ}`}
            style={{ transform: `rotate(-90deg)`, transformOrigin: `${c}px ${c}px`,
              transition: "stroke-dasharray 0.5s ease" }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-base font-bold" style={{ color: "#2D2A26" }}>
            {max > 0 ? `${Math.round(pct * 100)}%` : `${value}`}
          </span>
        </div>
      </div>
      <div className="text-center leading-tight">
        <div className="text-[11px] font-semibold" style={{ color: "#3D3228" }}>{label}:</div>
        <div className="text-[10px]" style={{ color: "#9C8E80" }}>{sub}</div>
      </div>
    </div>
  );
}

// ── SVG Donut ──────────────────────────────────────────────────────────────────

function Donut({ slices }: { slices: { pct: number; color: string }[] }) {
  const r = 40; const cx = 50; const cy = 50; const sw = 14; const circ = 2 * Math.PI * r;
  let off = 0;
  return (
    <svg viewBox="0 0 100 100" style={{ width: 90, height: 90, flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={sw} stroke="#EDE8E2" />
      {slices.map((s, i) => {
        const dash = (s.pct / 100) * circ;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            strokeWidth={sw} stroke={s.color}
            strokeDasharray={`${Math.max(dash - 1.5, 0)} ${circ}`}
            strokeDashoffset={-off}
            style={{ transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px` }} />
        );
        off += dash;
        return el;
      })}
    </svg>
  );
}

// ── SVG Bar Chart ──────────────────────────────────────────────────────────────

function BarChart({ data }: { data: VizData["monthly_activity"] }) {
  const hasData = data.some(d => d.learning > 0 || d.supervision > 0);
  const maxVal  = Math.max(...data.map(d => d.learning + d.supervision), 1);
  const step    = maxVal <= 10 ? 5 : maxVal <= 20 ? 10 : 20;
  const yMax    = Math.ceil(maxVal / step) * step;
  const yLines  = Array.from({ length: Math.floor(yMax / step) + 1 }, (_, i) => i * step);

  const CH = 85; const TW = 260; const LM = 24;
  const barW = (TW - LM) / 12 * 0.6;
  const slot  = (TW - LM) / 12;

  return (
    <div>
      <svg viewBox={`0 0 ${TW} ${CH + 18}`} className="w-full">
        {/* Y-grid + labels */}
        {yLines.map(v => {
          const y = CH - (v / yMax) * CH;
          return (
            <g key={v}>
              <line x1={LM} x2={TW} y1={y} y2={y} stroke="#EDE8E2" strokeWidth="0.5" />
              <text x={LM - 4} y={y + 3} fontSize="6.5" fill="#B0A89C" textAnchor="end">{v}</text>
            </g>
          );
        })}
        {/* X-axis */}
        <line x1={LM} x2={TW} y1={CH} y2={CH} stroke="#DDD8D0" strokeWidth="0.8" />
        {/* Bars */}
        {data.map((d, i) => {
          const x  = LM + i * slot + (slot - barW) / 2;
          const lh = hasData ? (d.learning    / yMax) * CH : 0;
          const sh = hasData ? (d.supervision / yMax) * CH : 0;
          return (
            <g key={i}>
              <title>{`${MONTHS[i]}: ${d.learning}ч обуч, ${d.supervision}ч супервиз`}</title>
              {sh > 0 && <rect x={x} y={CH - lh - sh} width={barW} height={sh}
                fill="#7C3AED" rx="1.5" opacity="0.9" />}
              {lh > 0 && <rect x={x} y={CH - lh} width={barW} height={lh}
                fill="#3a5ff8" rx="1.5" opacity="0.9" />}
              {i % 2 === 0 && (
                <text x={x + barW / 2} y={CH + 11} fontSize="6.5" fill="#B0A89C" textAnchor="middle">
                  {MONTHS[i]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {!hasData && (
        <div className="text-[10px] text-center -mt-6 mb-2" style={{ color: "#9C8E80" }}>
          Пока нет активности за выбранный год
        </div>
      )}
    </div>
  );
}

// ── Card shell ─────────────────────────────────────────────────────────────────

function VCard({ title, onMore, children }: {
  title: string; onMore?: () => void; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: "#FFFFFF", border: "1px solid #EAE6E0" }}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold" style={{ color: "#3D3228" }}>{title}</span>
        {onMore && (
          <button onClick={onMore} className="text-[10px] transition-colors"
            style={{ color: "#B0A89C" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#3a5ff8")}
            onMouseLeave={e => (e.currentTarget.style.color = "#B0A89C")}>
            Подробнее
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="text-[10px] text-center py-4 leading-relaxed" style={{ color: "#9C8E80" }}>{text}</p>
  );
}

function Skeleton() {
  return (
    <div className="p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {[170, 170, 155, 155].map((h, i) => (
          <div key={i} className="rounded-2xl animate-pulse" style={{ height: h, background: "#EDE8E2" }} />
        ))}
      </div>
      <div className="rounded-2xl animate-pulse" style={{ height: 64, background: "#EDE8E2" }} />
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export function VisualizationPanel({ year, onClose, onNavigate }: {
  year: number;
  onClose: () => void;
  onNavigate: (tab: string) => void;
}) {
  const [data, setData]       = useState<VizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const load = useCallback(() => {
    setLoading(true); setError("");
    fetch(`/api/professional-development/visualization?year=${year}`)
      .then(r => { if (!r.ok) throw new Error("Ошибка загрузки"); return r.json(); })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [year]);

  useEffect(() => { load(); }, [load]);

  return (
    <aside
      className="flex flex-col min-h-0 w-full xl:w-[560px] xl:flex-shrink-0"
      style={{ borderLeft: "1px solid #E5E5E5", background: "#F7F4F0" }}>

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b"
        style={{ background: "#F7F4F0", borderColor: "#E5E5E5" }}>
        <span className="text-sm font-semibold" style={{ color: "#3D3228" }}>Статистика</span>
        <button onClick={onClose} title="Скрыть визуализацию" aria-label="Скрыть визуализацию"
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors outline-none"
          style={{ color: "#9C8E80" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#E8E0D4")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto pb-16 xl:pb-4">
        {loading && <Skeleton />}

        {!loading && error && (
          <div className="p-8 flex flex-col items-center gap-3 text-center">
            <AlertCircle size={20} style={{ color: "#EF4444" }} />
            <p className="text-xs" style={{ color: "#9C8E80" }}>Не удалось загрузить данные</p>
            <button onClick={load} className="text-xs underline" style={{ color: "#3a5ff8" }}>Повторить</button>
          </div>
        )}

        {!loading && !error && data && (
          <div className="p-4 space-y-3">

            {/* ── 2 × 2 grid ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">

              {/* 1. Прогресс года */}
              <VCard title="Прогресс года" onMore={() => onNavigate("associations")}>
                <div className="flex justify-around">
                  <Ring value={data.actual_hours.learning}
                    max={data.year_targets?.learning ?? 0} color="#3a5ff8"
                    label="Обучение"
                    sub={data.year_targets
                      ? `${data.actual_hours.learning} / ${data.year_targets.learning} ч`
                      : `${data.actual_hours.learning} ч`} />
                  <Ring value={data.actual_hours.supervision}
                    max={data.year_targets?.supervision ?? 0} color="#7C3AED"
                    label="Супервизии"
                    sub={data.year_targets
                      ? `${data.actual_hours.supervision} / ${data.year_targets.supervision} ч`
                      : `${data.actual_hours.supervision} ч`} />
                </div>
                {!data.year_targets && (
                  <p className="text-[10px] text-center leading-tight" style={{ color: "#9C8E80" }}>
                    Укажите требования по часам в разделе Ассоциации
                  </p>
                )}
              </VCard>

              {/* 2. Форматы / Темы */}
              <VCard title="Форматы обучения" onMore={() => onNavigate("courses")}>
                {data.topics.length > 0 ? (
                  <div className="flex items-center gap-3">
                    <Donut slices={data.topics.map((t, i) => ({
                      pct: t.percent, color: PALETTE[i % PALETTE.length],
                    }))} />
                    <div className="flex-1 min-w-0 space-y-1">
                      {data.topics.map((t, i) => (
                        <div key={t.category} className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: PALETTE[i % PALETTE.length] }} />
                          <span className="text-[10px] truncate flex-1" style={{ color: "#6B7280" }}>
                            {CAT_LABELS[t.category] ?? t.category}
                          </span>
                          <span className="text-[10px] font-semibold flex-shrink-0"
                            style={{ color: "#3D3228" }}>{t.percent}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Empty text="Темы появятся после добавления обучения и супервизий" />
                )}
              </VCard>

              {/* 3. Активность по месяцам */}
              <VCard title="Активность по месяцам" onMore={() => onNavigate("supervisions")}>
                <BarChart data={data.monthly_activity} />
                <div className="flex items-center gap-4">
                  {[["#3a5ff8","Обучение"],["#7C3AED","Супервизии"]].map(([c, l]) => (
                    <span key={l} className="flex items-center gap-1 text-[10px]"
                      style={{ color: "#9C8E80" }}>
                      <span className="w-2 h-2 rounded-sm inline-block" style={{ background: c }} />
                      {l}
                    </span>
                  ))}
                </div>
              </VCard>

              {/* 4. Ближайшие события */}
              <VCard title="Ближайшие события" onMore={() => onNavigate("calendar")}>
                {data.upcoming_events.length > 0 ? (
                  <div className="space-y-1.5">
                    {data.upcoming_events.map((ev, i) => {
                      const Icon  = EVENT_ICON[ev.type]  ?? CalendarDays;
                      const color = EVENT_COLOR[ev.type] ?? "#3a5ff8";
                      const d = new Date(ev.date);
                      const dateStr = d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
                      const timeStr = d.getHours() > 0
                        ? d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "";
                      return (
                        <div key={i}
                          className="flex items-start gap-2 px-2 py-1.5 rounded-xl transition-colors cursor-pointer"
                          style={{ background: "#F7F4F0" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#EDE8E2")}
                          onMouseLeave={e => (e.currentTarget.style.background = "#F7F4F0")}>
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ background: `${color}1A` }}>
                            <Icon size={11} style={{ color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-semibold leading-tight truncate"
                              style={{ color: "#3D3228" }}>{ev.title}</div>
                            <div className="text-[9px] mt-0.5" style={{ color: "#9C8E80" }}>
                              {dateStr}{timeStr ? ` · ${timeStr}` : ""}
                            </div>
                          </div>
                          <ChevronRight size={9} className="flex-shrink-0 mt-1.5"
                            style={{ color: "#CFC0A9" }} />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <Empty text="Ближайших событий пока нет" />
                )}
              </VCard>
            </div>

            {/* ── 5. Фокус месяца — full width ─────────────────────────── */}
            <div className="rounded-2xl px-4 py-3 flex items-center gap-3"
              style={{ background: "#FFFFFF", border: "1px solid #EAE6E0" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "#FEF3C7" }}>
                <Sparkles size={18} style={{ color: "#D97706" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold mb-0.5" style={{ color: "#3D3228" }}>
                  Фокус месяца
                </div>
                <div className="text-[10px] leading-relaxed" style={{ color: "#6B7280" }}>
                  {focusMsg(data)}
                </div>
              </div>
              <button onClick={() => onNavigate("goals")}
                className="flex items-center gap-1 text-[10px] font-semibold flex-shrink-0 px-2.5 py-1.5 rounded-xl transition-colors whitespace-nowrap"
                style={{ color: "#3a5ff8", background: "#EEF2FF", border: "1px solid #C7D2FE" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#E0E7FF")}
                onMouseLeave={e => (e.currentTarget.style.background = "#EEF2FF")}>
                Посмотреть план
                <ArrowRight size={10} />
              </button>
            </div>

          </div>
        )}
      </div>
    </aside>
  );
}
