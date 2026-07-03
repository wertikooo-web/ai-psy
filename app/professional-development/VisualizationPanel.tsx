"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X, CalendarDays, Target, FileText, BookOpen, Users,
  ChevronRight, AlertCircle, Sparkles, ArrowRight, Info, Plus,
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

function focusMsg(d: VizData): string {
  const { actual_hours: { learning, supervision }, year_targets, monthly_activity, upcoming_events } = d;
  if (learning === 0 && supervision === 0)
    return "Добавьте обучение, супервизию или цель, чтобы начать отслеживать профессиональное развитие.";
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
  const pctLabel = `${max > 0 ? Math.round(pct * 100) : 0}%`;
  return (
    <div className="flex flex-col items-center" style={{ gap: 8 }}>
      <div className="relative" style={{ width: 88, height: 88 }}>
        <svg viewBox="0 0 96 96" className="w-full h-full"
          role="img" aria-label={`${label}: ${pctLabel}, ${sub}`}>
          <title>{`${label}: ${pctLabel} — ${sub}`}</title>
          <circle cx={c} cy={c} r={r} fill="none" strokeWidth="8" stroke="#D8E4F5"
            style={{ transform: "rotate(-90deg)", transformOrigin: `${c}px ${c}px` }} />
          <circle cx={c} cy={c} r={r} fill="none" strokeWidth="8" stroke={color}
            strokeLinecap="round"
            strokeDasharray={`${pct * circ} ${circ}`}
            style={{ transform: "rotate(-90deg)", transformOrigin: `${c}px ${c}px`,
              transition: "stroke-dasharray 0.6s ease" }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span style={{ fontSize: 16, fontWeight: 700, color: "#2D2A26", lineHeight: 1 }}>
            {pctLabel}
          </span>
        </div>
      </div>
      <div className="text-center" style={{ lineHeight: 1.35 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#3D3228" }}>{label}</div>
        <div style={{ fontSize: 11, color: "#7A6A52", marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

// ── SVG Donut ──────────────────────────────────────────────────────────────────

function Donut({ slices, ariaLabel }: { slices: { pct: number; color: string }[]; ariaLabel: string }) {
  const r = 42; const cx = 52; const cy = 52; const sw = 16; const circ = 2 * Math.PI * r;
  let off = 0;
  const total = slices.reduce((a, s) => a + s.pct, 0);
  return (
    <svg viewBox="0 0 104 104" style={{ width: 80, height: 80, flexShrink: 0 }}
      role="img" aria-label={ariaLabel}>
      <title>{ariaLabel}</title>
      <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={sw} stroke="#D8E4F5" />
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

// ── SVG Bar Chart — supervision on top, learning on bottom (fixed stacking) ────

function BarChart({ data }: { data: VizData["monthly_activity"] }) {
  const maxVal = Math.max(...data.map(d => d.learning + d.supervision), 1);
  const step   = maxVal <= 10 ? 5 : maxVal <= 20 ? 10 : maxVal <= 30 ? 10 : 20;
  const yMax   = Math.ceil(maxVal / step) * step;
  const yLines = Array.from({ length: Math.floor(yMax / step) + 1 }, (_, i) => i * step);

  const CH = 86; const LM = 6; const TW = 242;
  const slot = (TW - LM) / 12;
  const barW = slot * 0.55;

  return (
    <svg viewBox={`0 0 ${TW} ${CH + 16}`} className="w-full"
      role="img" aria-label="График активности по месяцам: часы обучения и супервизий">
      <title>Активность по месяцам: обучение и супервизии</title>

      {/* Gridlines only — no number labels */}
      {yLines.map(v => (
        <line key={v} x1={LM} x2={TW} y1={CH - (v / yMax) * CH} y2={CH - (v / yMax) * CH}
          stroke={v === 0 ? "#BDD0F0" : "#D8E4F5"}
          strokeWidth={v === 0 ? "0.8" : "0.5"} />
      ))}

      {data.map((d, i) => {
        const x     = LM + i * slot + (slot - barW) / 2;
        const lh    = (d.learning    / yMax) * CH;
        const sh    = (d.supervision / yMax) * CH;
        const total = lh + sh;
        return (
          <g key={i}>
            <title>{`${MONTHS_SHORT[i]}: ${d.learning}ч обуч, ${d.supervision}ч супервиз`}</title>
            {/* Supervision on top */}
            {sh > 0 && (
              <rect x={x} y={CH - total} width={barW} height={sh} fill="#7C6DC5" rx="2" />
            )}
            {/* Learning on bottom */}
            {lh > 0 && (
              <rect x={x} y={CH - lh} width={barW} height={lh} fill="#5C9BD5" rx="2" />
            )}
            <text x={x + barW / 2} y={CH + 12} fontSize="8" fill="#7A6A52" textAnchor="middle">
              {MONTHS_SHORT[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Card shell ─────────────────────────────────────────────────────────────────

function VCard({ title, onMore, moreAriaLabel, info, children }: {
  title: string; onMore?: () => void; moreAriaLabel?: string;
  info?: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl flex flex-col gap-3"
      style={{ background: "#FFFFFF", border: "1px solid #D8E4F5", padding: "14px 16px" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 12, fontWeight: 600, color: "#3D3228" }}>{title}</span>
          {info && (
            <span title={info} aria-label={info}>
              <Info size={11} style={{ color: "#9BAECF", flexShrink: 0 }} />
            </span>
          )}
        </div>
        {onMore && (
          <button onClick={onMore}
            aria-label={moreAriaLabel ?? `Подробнее — ${title}`}
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

// ── Empty card with CTA ────────────────────────────────────────────────────────

function CardCTA({ icon: Icon, text, btnLabel, onClick }: {
  icon: React.ElementType; text: string; btnLabel: string; onClick: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
      gap: 8, padding: "4px 0 8px" }}>
      <div style={{ width: 32, height: 32, borderRadius: 10, background: "#EEF4FB",
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={15} style={{ color: "#5C9BD5" }} />
      </div>
      <p style={{ fontSize: 12, color: "#7A6A52", textAlign: "center", lineHeight: 1.5, margin: 0 }}>
        {text}
      </p>
      <button onClick={onClick}
        style={{ fontSize: 12, fontWeight: 600, color: "#3a5ff8", background: "none",
          border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: 0 }}>
        <Plus size={12} /> {btnLabel}
      </button>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[168, 168, 150, 150].map((h, i) => (
          <div key={i} className="rounded-2xl animate-pulse" style={{ height: h, background: "#D8E4F5" }} />
        ))}
      </div>
      <div className="rounded-2xl animate-pulse" style={{ height: 60, background: "#D8E4F5" }} />
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export function VisualizationPanel({ year, onClose, onNavigate, panelWidth = 360 }: {
  year: number;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  panelWidth?: number;
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
    <aside className="flex flex-col min-h-0 w-full xl:flex-shrink-0"
      style={{ borderLeft: "1px solid #D8E4F5", background: "#F0F4FD", width: panelWidth }}>

      {/* Header — neutral, not blue */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5"
        style={{ background: "#EAF0FB", borderBottom: "1px solid #D0DEFA" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#7A6A52", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Статистика
        </span>
        <button onClick={onClose} title="Скрыть статистику" aria-label="Скрыть статистику"
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors outline-none"
          style={{ color: "#7A6A52" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#D0DEFA")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
          <X size={13} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto pb-16 xl:pb-4">
        {loading && <Skeleton />}

        {!loading && error && (
          <div className="p-8 flex flex-col items-center gap-3 text-center">
            <AlertCircle size={20} style={{ color: "#EF4444" }} />
            <p style={{ fontSize: 13, color: "#7A6A52" }}>Не удалось загрузить данные</p>
            <button onClick={load}
              style={{ fontSize: 13, fontWeight: 600, color: "#3a5ff8",
                background: "none", border: "none", cursor: "pointer" }}>
              Повторить
            </button>
          </div>
        )}

        {!loading && !error && data && <VizContent data={data} onNavigate={onNavigate} />}
      </div>
    </aside>
  );
}

// ── Content ────────────────────────────────────────────────────────────────────

function VizContent({ data, onNavigate }: { data: VizData; onNavigate: (tab: string) => void }) {
  const d = data;
  const hasData = d.actual_hours.learning > 0 || d.actual_hours.supervision > 0;

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>

      {/* ── Row 1 ────────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

        {/* Прогресс года */}
        <VCard title="Прогресс года"
          info="Прогресс выполнения годовых норм по часам">
          {!hasData ? (
            <CardCTA icon={BookOpen}
              text="Добавьте курс или супервизию, чтобы начать отслеживать прогресс"
              btnLabel="Добавить обучение"
              onClick={() => onNavigate("courses")} />
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-around", paddingBottom: 2 }}>
                <Ring value={d.actual_hours.learning}
                  max={d.year_targets?.learning ?? 0} color="#5C9BD5"
                  label="Обучение"
                  sub={d.year_targets
                    ? `${d.actual_hours.learning} / ${d.year_targets.learning} ч`
                    : `${d.actual_hours.learning} ч`} />
                <Ring value={d.actual_hours.supervision}
                  max={d.year_targets?.supervision ?? 0} color="#7C6DC5"
                  label="Супервизии"
                  sub={d.year_targets
                    ? `${d.actual_hours.supervision} / ${d.year_targets.supervision} ч`
                    : `${d.actual_hours.supervision} ч`} />
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 16, paddingTop: 2 }}>
                <button onClick={() => onNavigate("courses")}
                  style={{ fontSize: 11, color: "#5C9BD5", background: "none", border: "none",
                    cursor: "pointer", padding: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#3a5ff8")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#5C9BD5")}>
                  → Курсы
                </button>
                <button onClick={() => onNavigate("supervisions")}
                  style={{ fontSize: 11, color: "#7C6DC5", background: "none", border: "none",
                    cursor: "pointer", padding: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#5C4FA8")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#7C6DC5")}>
                  → Супервизии
                </button>
              </div>
              {!d.year_targets && (
                <button onClick={() => onNavigate("associations")}
                  style={{ fontSize: 11, color: "#7A6A52", textAlign: "center", background: "none",
                    border: "none", cursor: "pointer", lineHeight: 1.4, width: "100%", padding: "2px 0 0" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#3a5ff8")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#7A6A52")}>
                  Установите нормы в Ассоциациях →
                </button>
              )}
            </>
          )}
        </VCard>

        {/* Темы развития */}
        <VCard title="Темы развития"
          onMore={() => onNavigate("courses")}
          moreAriaLabel="Подробнее — перейти к разделу Обучение">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {d.topics.length > 0 ? (
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                {d.topics.map((t, i) => (
                  <div key={t.category} style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                      background: PALETTE[i % PALETTE.length] }} />
                    <span style={{ fontSize: 11, color: "#4A4455", flex: 1, overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {CAT_LABELS[t.category] ?? t.category}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#3D3228", flexShrink: 0 }}>
                      {t.percent}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, color: "#7A6A52", lineHeight: 1.5, margin: 0 }}>
                  Темы появятся после добавления обучения
                </p>
              </div>
            )}
            <Donut
              ariaLabel={d.topics.length > 0
                ? `Доля тем: ${d.topics.map(t => `${CAT_LABELS[t.category] ?? t.category} ${t.percent}%`).join(", ")}`
                : "Нет данных о темах"}
              slices={d.topics.length > 0
                ? d.topics.map((t, i) => ({ pct: t.percent, color: PALETTE[i % PALETTE.length] }))
                : [{ pct: 100, color: "#D8E4F5" }]
              }
            />
          </div>
        </VCard>
      </div>

      {/* ── Row 2 ────────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

        {/* Активность */}
        <VCard title="Активность"
          onMore={() => onNavigate("supervisions")}
          moreAriaLabel="Подробнее — перейти к разделу Супервизии"
          info="Часы обучения и супервизий по месяцам">
          <BarChart data={d.monthly_activity} />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {([ ["#5C9BD5","Обучение"], ["#7C6DC5","Супервизии"] ] as [string,string][]).map(([c, l]) => (
              <span key={l} style={{ display: "flex", alignItems: "center", gap: 4,
                fontSize: 11, color: "#7A6A52" }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: c,
                  display: "inline-block" }} />
                {l}
              </span>
            ))}
          </div>
        </VCard>

        {/* Ближайшие события */}
        <VCard title="Ближайшие события"
          onMore={() => onNavigate("calendar")}
          moreAriaLabel="Подробнее — перейти к разделу Календарь">
          {d.upcoming_events.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {d.upcoming_events.map((ev, i) => {
                const Icon  = EVENT_ICON[ev.type]  ?? CalendarDays;
                const color = EVENT_COLOR[ev.type] ?? "#5C9BD5";
                const dt    = new Date(ev.date);
                const dateShort = dt.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
                const days  = Math.ceil((dt.getTime() - Date.now()) / 86400000);
                const daysLabel = days <= 0 ? "сегодня" : days === 1 ? "завтра" : `через ${days} дн.`;
                return (
                  <div key={i}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 7px",
                      borderRadius: 10, background: "#EEF4FB", cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#DDE8F8")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#EEF4FB")}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: `${color}22` }}>
                      <Icon size={13} style={{ color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#3D3228",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {ev.title}
                      </div>
                      <div style={{ fontSize: 11, color: "#7A6A52", marginTop: 1 }}>
                        {dateShort} · {daysLabel}
                      </div>
                    </div>
                    <ChevronRight size={10} style={{ color: "#9BAECF", flexShrink: 0 }} />
                  </div>
                );
              })}
            </div>
          ) : (
            <CardCTA icon={CalendarDays}
              text="Нет предстоящих событий"
              btnLabel="Открыть календарь"
              onClick={() => onNavigate("calendar")} />
          )}
        </VCard>
      </div>

      {/* ── Фокус месяца — full width ─────────────────────────────────── */}
      <div style={{ background: "#FFFFFF", border: "1px solid #D8E4F5", borderRadius: 16,
        padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "#FEF3C7" }}>
          <Sparkles size={18} style={{ color: "#D97706" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#3D3228", marginBottom: 3 }}>
            Фокус месяца
          </div>
          <div style={{ fontSize: 12, color: "#4A4455", lineHeight: 1.5 }}>
            {focusMsg(d)}
          </div>
        </div>
        {hasData && (
          <button onClick={() => onNavigate("goals")}
            aria-label="Посмотреть план развития"
            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11,
              fontWeight: 600, color: "#3a5ff8", background: "#EEF4FB",
              border: "1px solid #B8CCF0", borderRadius: 10, padding: "6px 10px",
              cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.background = "#DCE8F8")}
            onMouseLeave={e => (e.currentTarget.style.background = "#EEF4FB")}>
            Посмотреть план
            <ArrowRight size={10} />
          </button>
        )}
      </div>

    </div>
  );
}
