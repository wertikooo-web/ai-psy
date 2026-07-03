"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X, CalendarDays, Target, FileText, BookOpen, Users,
  ChevronRight, AlertCircle, Sparkles, ArrowRight, Info,
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

const MONTHS_SHORT = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
const PALETTE = ["#E87B4B","#7C6DC5","#4DB6AC","#E8874B","#90A4AE","#5C9BD5"];

const CAT_LABELS: Record<string, string> = {
  long_program:"Долгосрочная", qualification:"Повышение квалиф.",
  specialization:"Специализация", intensive:"Интенсив", webinar:"Вебинар",
  seminar:"Семинар", conference:"Конференция", masterclass:"Мастер-класс",
  online_course:"Онлайн-курс", other:"Другое",
};

const EVENT_COLOR: Record<string, string> = {
  calendar:"#5C9BD5", goal:"#4DB6AC", document:"#E87B4B",
  course:"#E87B4B", supervision:"#7C6DC5",
};
const EVENT_ICON: Record<string, React.ElementType> = {
  calendar:CalendarDays, goal:Target, document:FileText,
  course:BookOpen, supervision:Users,
};

// ── Focus message ──────────────────────────────────────────────────────────────

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
      return "Профессиональное развитие идёт стабильно. Сосредоточьтесь на ближайших целях месяца.";
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
  const r = 38; const c = 48; const circ = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center" style={{ gap: 10 }}>
      <div className="relative" style={{ width: 96, height: 96 }}>
        <svg viewBox="0 0 96 96" className="w-full h-full">
          <circle cx={c} cy={c} r={r} fill="none" strokeWidth="8" stroke="#F0EDE8"
            style={{ transform: "rotate(-90deg)", transformOrigin: `${c}px ${c}px` }} />
          {(pct > 0 || max === 0) && (
            <circle cx={c} cy={c} r={r} fill="none" strokeWidth="8" stroke={color}
              strokeLinecap="round"
              strokeDasharray={`${Math.max(pct * circ, max === 0 ? circ : 0)} ${circ}`}
              style={{ transform: "rotate(-90deg)", transformOrigin: `${c}px ${c}px`,
                transition: "stroke-dasharray 0.6s ease" }} />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span style={{ fontSize: 18, fontWeight: 700, color: "#2D2A26", lineHeight: 1 }}>
            {max > 0 ? `${Math.round(pct * 100)}%` : `${value}`}
          </span>
        </div>
      </div>
      <div className="text-center" style={{ lineHeight: 1.3 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#3D3228" }}>{label}:</div>
        <div style={{ fontSize: 10, color: "#9C8E80", marginTop: 1 }}>{sub}</div>
      </div>
    </div>
  );
}

// ── SVG Donut ──────────────────────────────────────────────────────────────────

function Donut({ slices }: { slices: { pct: number; color: string }[] }) {
  const r = 42; const cx = 52; const cy = 52; const sw = 16; const circ = 2 * Math.PI * r;
  let off = 0;
  const total = slices.reduce((a, s) => a + s.pct, 0);
  return (
    <svg viewBox="0 0 104 104" style={{ width: 88, height: 88, flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={sw} stroke="#F0EDE8" />
      {total > 0 && slices.map((s, i) => {
        const dash = (s.pct / 100) * circ;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            strokeWidth={sw} stroke={s.color}
            strokeDasharray={`${Math.max(dash - 2, 0)} ${circ}`}
            strokeDashoffset={-off}
            style={{ transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px` }} />
        );
        off += dash;
        return el;
      })}
    </svg>
  );
}

// ── SVG Bar Chart (stacked) ────────────────────────────────────────────────────

function BarChart({ data }: { data: VizData["monthly_activity"] }) {
  const maxVal = Math.max(...data.map(d => d.learning + d.supervision), 1);
  const step   = maxVal <= 10 ? 5 : maxVal <= 20 ? 10 : maxVal <= 30 ? 10 : 20;
  const yMax   = Math.ceil(maxVal / step) * step;
  const yLines = Array.from({ length: Math.floor(yMax / step) + 1 }, (_, i) => i * step);

  const CH = 90; const LM = 30; const TW = 240;
  const slot = (TW - LM) / 12;
  const barW = slot * 0.55;

  return (
    <svg viewBox={`0 0 ${TW + 2} ${CH + 22}`} className="w-full">
      {/* Y-axis label "Часы" rotated */}
      <text
        transform={`rotate(-90, 8, ${CH / 2})`}
        x={8} y={CH / 2}
        fontSize="7" fill="#B0A89C" textAnchor="middle">
        Часы
      </text>

      {/* Y-grid + labels */}
      {yLines.map(v => {
        const y = CH - (v / yMax) * CH;
        return (
          <g key={v}>
            <line x1={LM} x2={TW} y1={y} y2={y} stroke="#EDE8E2" strokeWidth="0.6" />
            <text x={LM - 4} y={y + 3} fontSize="7" fill="#B0A89C" textAnchor="end">{v}</text>
          </g>
        );
      })}

      {/* X axis */}
      <line x1={LM} x2={TW} y1={CH} y2={CH} stroke="#DDD8D0" strokeWidth="0.8" />

      {/* Stacked bars + X labels */}
      {data.map((d, i) => {
        const x  = LM + i * slot + (slot - barW) / 2;
        const lh = (d.learning    / yMax) * CH;
        const sh = (d.supervision / yMax) * CH;
        const total = lh + sh;
        return (
          <g key={i}>
            <title>{`${MONTHS_SHORT[i]}: ${d.learning}ч обуч, ${d.supervision}ч супервиз`}</title>
            {/* Blue bar (learning) — bottom */}
            {lh > 0 && (
              <rect x={x} y={CH - total} width={barW} height={lh}
                fill="#5C9BD5" rx={total <= lh ? "2" : "0"} />
            )}
            {/* Purple bar (supervision) — top */}
            {sh > 0 && (
              <rect x={x} y={CH - total} width={barW} height={sh}
                fill="#7C6DC5" rx="2" />
            )}
            {/* Fix bottom radius when both bars stacked */}
            {lh > 0 && sh > 0 && (
              <rect x={x} y={CH - lh} width={barW} height={Math.min(lh, 3)} fill="#5C9BD5" />
            )}
            {/* X label every 2 months */}
            {i % 2 === 0 && (
              <text x={x + barW / 2} y={CH + 11} fontSize="7" fill="#B0A89C" textAnchor="middle">
                {MONTHS_SHORT[i]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Card shell ─────────────────────────────────────────────────────────────────

function VCard({ title, onMore, info, children }: {
  title: string; onMore?: () => void; info?: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: "#FFFFFF", border: "1px solid #EAE6E0" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 12, fontWeight: 600, color: "#3D3228" }}>{title}</span>
          {info && <span title={info}><Info size={11} style={{ color: "#C0B8AD", flexShrink: 0 }} /></span>}
        </div>
        {onMore && (
          <button onClick={onMore}
            style={{ fontSize: 11, color: "#5C9BD5", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = "#3a5ff8")}
            onMouseLeave={e => (e.currentTarget.style.color = "#5C9BD5")}>
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
    <p style={{ fontSize: 10, color: "#9C8E80", textAlign: "center", padding: "12px 0", lineHeight: 1.5 }}>{text}</p>
  );
}

function Skeleton() {
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[168, 168, 150, 150].map((h, i) => (
          <div key={i} className="rounded-2xl animate-pulse" style={{ height: h, background: "#EDE8E2" }} />
        ))}
      </div>
      <div className="rounded-2xl animate-pulse" style={{ height: 60, background: "#EDE8E2" }} />
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
    <aside className="flex flex-col min-h-0 w-full xl:w-[560px] xl:flex-shrink-0"
      style={{ borderLeft: "1px solid #E5E5E5", background: "#F7F4F0" }}>

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3"
        style={{ background: "#F7F4F0", borderBottom: "1px solid #E5E5E5" }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#3D3228" }}>Статистика</span>
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
            <p style={{ fontSize: 12, color: "#9C8E80" }}>Не удалось загрузить данные</p>
            <button onClick={load} style={{ fontSize: 12, color: "#5C9BD5", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}>Повторить</button>
          </div>
        )}

        {!loading && !error && data && (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>

            {/* ── Row 1 ──────────────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

              {/* 1. Прогресс года */}
              <VCard title="Прогресс года"
                info="Выполнение годовых норм по обучению и супервизии"
                onMore={() => onNavigate("associations")}>
                <div style={{ display: "flex", justifyContent: "space-around", paddingBottom: 4 }}>
                  <Ring value={data.actual_hours.learning}
                    max={data.year_targets?.learning ?? 0} color="#5C9BD5"
                    label="Обучение"
                    sub={data.year_targets
                      ? `${data.actual_hours.learning} / ${data.year_targets.learning} ч`
                      : `${data.actual_hours.learning} ч`} />
                  <Ring value={data.actual_hours.supervision}
                    max={data.year_targets?.supervision ?? 0} color="#7C6DC5"
                    label="Супервизии"
                    sub={data.year_targets
                      ? `${data.actual_hours.supervision} / ${data.year_targets.supervision} ч`
                      : `${data.actual_hours.supervision} ч`} />
                </div>
                {!data.year_targets && (
                  <p style={{ fontSize: 10, color: "#9C8E80", textAlign: "center", lineHeight: 1.4 }}>
                    Укажите нормы часов в разделе Ассоциации
                  </p>
                )}
              </VCard>

              {/* 2. Темы развития — легенда СЛЕВА, donut СПРАВА */}
              <VCard title="Темы развития" onMore={() => onNavigate("courses")}>
                {data.topics.length > 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {/* Legend LEFT */}
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                      {data.topics.map((t, i) => (
                        <div key={t.category} style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: PALETTE[i % PALETTE.length] }} />
                          <span style={{ fontSize: 10, color: "#6B7280", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {CAT_LABELS[t.category] ?? t.category}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 600, color: "#3D3228", flexShrink: 0 }}>
                            {t.percent}%
                          </span>
                        </div>
                      ))}
                    </div>
                    {/* Donut RIGHT */}
                    <Donut slices={data.topics.map((t, i) => ({
                      pct: t.percent, color: PALETTE[i % PALETTE.length],
                    }))} />
                  </div>
                ) : (
                  <Empty text="Темы появятся после добавления обучения" />
                )}
              </VCard>
            </div>

            {/* ── Row 2 ──────────────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

              {/* 3. Активность по месяцам */}
              <VCard title="Активность по месяцам"
                info="Количество часов обучения и супервизий по месяцам"
                onMore={() => onNavigate("supervisions")}>
                <BarChart data={data.monthly_activity} />
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 2 }}>
                  {[["#5C9BD5","Обучение"],["#7C6DC5","Супервизии"]].map(([c, l]) => (
                    <span key={l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#9C8E80" }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: "inline-block" }} />
                      {l}
                    </span>
                  ))}
                </div>
              </VCard>

              {/* 4. Ближайшие события */}
              <VCard title="Ближайшие события" onMore={() => onNavigate("calendar")}>
                {data.upcoming_events.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {data.upcoming_events.map((ev, i) => {
                      const Icon  = EVENT_ICON[ev.type]  ?? CalendarDays;
                      const color = EVENT_COLOR[ev.type] ?? "#5C9BD5";
                      const d     = new Date(ev.date);
                      const hasTime = d.getHours() > 0 || d.getMinutes() > 0;
                      const dateShort = d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
                      const rawWeekday = d.toLocaleDateString("ru-RU", { weekday: "long" });
                      const weekday = rawWeekday.charAt(0).toUpperCase() + rawWeekday.slice(1);
                      const timeStr = hasTime
                        ? d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "";
                      return (
                        <div key={i}
                          style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
                            borderRadius: 12, background: "#F7F4F0", cursor: "pointer" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#EDE8E2")}
                          onMouseLeave={e => (e.currentTarget.style.background = "#F7F4F0")}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: `${color}20` }}>
                            <Icon size={13} style={{ color }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: "#3D3228",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              lineHeight: 1.3 }}>
                              {dateShort} — {ev.title}
                            </div>
                            <div style={{ fontSize: 9, color: "#9C8E80", marginTop: 1, lineHeight: 1.3 }}>
                              {weekday}, {dateShort}{timeStr ? ` • ${timeStr}` : ""}
                            </div>
                          </div>
                          <ChevronRight size={10} style={{ color: "#CFC0A9", flexShrink: 0 }} />
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
            <div style={{ background: "#FFFFFF", border: "1px solid #EAE6E0", borderRadius: 16,
              padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "#FEF3C7" }}>
                <Sparkles size={18} style={{ color: "#D97706" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#3D3228", marginBottom: 3 }}>
                  Фокус месяца
                </div>
                <div style={{ fontSize: 10, color: "#6B7280", lineHeight: 1.5 }}>
                  {focusMsg(data)}
                </div>
              </div>
              <button onClick={() => onNavigate("goals")}
                style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10,
                  fontWeight: 600, color: "#5C9BD5", background: "#EEF4FB",
                  border: "1px solid #BEDBF4", borderRadius: 10, padding: "6px 10px",
                  cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
                onMouseEnter={e => (e.currentTarget.style.background = "#DCECf8")}
                onMouseLeave={e => (e.currentTarget.style.background = "#EEF4FB")}>
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
