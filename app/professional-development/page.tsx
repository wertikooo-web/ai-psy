"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GraduationCap, BookOpen, Users, CalendarDays, FileText, Target,
  Plus, ChevronRight, Clock, Award, TrendingUp, Loader2,
  AlertCircle, X, Check, Pencil, Download, BarChart2,
  HeartHandshake, Building2, Wallet, BookMarked, ChevronDown, ChevronUp, Sparkles,
} from "lucide-react";
import { AssociationsTab, FinancesTab, LibraryTab } from "./tabs-extended";
import { VisualizationPanel } from "./VisualizationPanel";

const LS_PANEL = "professionalDevelopment.visualPanelCollapsed";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "overview" | "courses" | "supervisions" | "calendar" | "documents" | "goals" | "associations" | "finances" | "library" | "reflection";

interface OverviewData {
  learning_hours_this_year:    number;
  supervision_hours_this_year: number;
  therapy_hours_this_year:     number;
  courses_in_progress:         number;
  certificates_total:          number;
  next_event:                  { title: string; date: string } | null;
  recent_courses:              RawCourse[];
  recent_sessions:             RawSession[];
  recent_documents:            RawDoc[];
  active_goals:                RawGoal[];
  last_supervision_date:       string | null;
  expiring_associations:       { id: string; name: string; acronym?: string; membership_expires: string }[];
  hours_by_category:           Record<string, number>;
}

interface RawCourse {
  id: string; title: string; status: string; category: string;
  total_hours?: number; completed_hours?: number; certificate_received: boolean;
  start_date?: string; end_date?: string; provider?: string; format?: string;
  notes?: string;
}
interface RawSession {
  id: string; session_type: string; session_date: string;
  duration_minutes?: number; supervisor_name?: string; topic?: string;
  main_insights?: string; confidentiality_mode: string; format?: string;
  group_or_individual?: string;
}
interface RawTherapy {
  id: string; session_date: string; duration_minutes?: number;
  therapist_name?: string; topic?: string; notes?: string;
  format: string; confidentiality_mode: string;
}
interface RawDoc {
  id: string; title: string; document_type: string; organization?: string;
  issued_date?: string; expires_at?: string;
}
interface RawGoal {
  id: string; title: string; status: string; progress: number;
  target_date?: string; description?: string; motivation?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "overview",      label: "Обзор",          icon: TrendingUp   },
  { key: "courses",       label: "Обучение",        icon: BookOpen     },
  { key: "supervisions",  label: "Супервизии",      icon: Users        },
  { key: "documents",     label: "Документы",       icon: FileText     },
  { key: "calendar",      label: "Календарь",       icon: CalendarDays },
  { key: "goals",         label: "План развития",   icon: Target       },
  { key: "finances",      label: "Финансы",         icon: Wallet       },
  { key: "library",       label: "Библиотека",      icon: BookMarked   },
  { key: "reflection",    label: "Рефлексия",       icon: Sparkles     },
  { key: "associations",  label: "Ассоциации",      icon: Building2    },
];

const PRIMARY_TABS   = TABS.slice(0, 4);
const SECONDARY_TABS = TABS.slice(4);

const STATUS_LABELS: Record<string, string> = {
  planned: "Запланирован", in_progress: "В процессе", completed: "Завершён",
  paused: "Приостановлен", not_completed: "Не завершён", postponed: "Отложено",
  supervision: "Супервизия", intervision: "Интервизия",
  balint_group: "Балинт. группа", clinical_case: "Клин. разбор",
  methodology_group: "Метод. группа", other: "Другое",
};
const STATUS_COLORS: Record<string, string> = {
  planned: "#6B7280", in_progress: "#3a5ff8", completed: "#16A34A",
  paused: "#D97706", not_completed: "#EF4444", postponed: "#9CA3AF",
};
const CAT_LABELS: Record<string, string> = {
  long_program: "Долгосрочная программа", qualification: "Повышение квалификации",
  specialization: "Специализация", intensive: "Интенсив", webinar: "Вебинар",
  seminar: "Семинар", conference: "Конференция", masterclass: "Мастер-класс",
  online_course: "Онлайн-курс", other: "Другое",
};
const DOC_TYPE_LABELS: Record<string, string> = {
  certificate: "Сертификат", diploma: "Диплом",
  qualification: "Свидетельство о квалификации",
  supervision_confirmation: "Подтверждение супервизии",
  receipt: "Чек / квитанция", other: "Другое",
};
const SESSION_TYPE_LABELS: Record<string, string> = {
  supervision: "Супервизия", intervision: "Интервизия",
  balint_group: "Балинт. группа", clinical_case: "Клин. разбор",
  methodology_group: "Метод. группа", other: "Другое",
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [0, CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3];

// ── Toast ─────────────────────────────────────────────────────────────────────

interface ToastItem { id: number; msg: string; type: "ok" | "err" }

function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const show = useCallback((msg: string, type: ToastItem["type"] = "ok") => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);
  return { toasts, show };
}

// ── api helper ────────────────────────────────────────────────────────────────

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`/api/professional-development${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

// ── PDF export ────────────────────────────────────────────────────────────────

async function generatePDF(year: number) {
  const [hoursData, allCourses] = await Promise.all([
    apiFetch(`/hours?year=${year}`),
    apiFetch(`/courses`),
  ]);
  const certCourses = (allCourses as RawCourse[]).filter(c => c.certificate_received);
  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
<title>Проф. развитие ${year}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:12px;color:#222;margin:32px 40px}
  h1{font-size:20px;margin:0 0 4px}
  .sub{color:#666;font-size:11px;margin-bottom:28px}
  h2{font-size:13px;font-weight:700;margin:24px 0 8px;padding-bottom:4px;border-bottom:2px solid #3a5ff8;color:#3a5ff8}
  table{width:100%;border-collapse:collapse;margin-bottom:4px}
  th{text-align:left;padding:5px 8px;background:#f0f0f0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
  td{padding:5px 8px;border-bottom:1px solid #eee}
  .total td{font-weight:700;background:#f9f9f9}
  .cert{display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;background:#dcfce7;color:#166534}
  @media print{body{margin:16px}button{display:none}}
</style>
</head><body>
<h1>Отчёт о профессиональном развитии</h1>
<div class="sub">Год: ${year} &nbsp;·&nbsp; Дата формирования: ${new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</div>

<h2>Часы профессиональной деятельности</h2>
<table>
<tr><th>Вид деятельности</th><th>Часов</th></tr>
<tr><td>Обучение (курсы, программы)</td><td>${hoursData.total_learning} ч</td></tr>
<tr><td>Супервизия / Балинтовские группы</td><td>${hoursData.total_supervision} ч</td></tr>
<tr><td>Интервизия</td><td>${hoursData.total_intervision} ч</td></tr>
<tr><td>Конференции / Семинары / Вебинары</td><td>${hoursData.total_conference} ч</td></tr>
<tr><td>Личная терапия</td><td>${hoursData.total_therapy} ч</td></tr>
<tr class="total"><td>ИТОГО</td><td>${hoursData.total_all} ч</td></tr>
</table>

${certCourses.length > 0 ? `
<h2>Курсы и программы с сертификатами</h2>
<table>
<tr><th>Название</th><th>Организация</th><th>Часов</th><th></th></tr>
${certCourses.map(c => `<tr>
  <td>${c.title}</td>
  <td>${c.provider ?? "—"}</td>
  <td>${c.total_hours ?? "—"}</td>
  <td><span class="cert">✓ Сертификат</span></td>
</tr>`).join("")}
</table>` : ""}

<br><br>
<button onclick="window.print()" style="padding:8px 20px;background:#3a5ff8;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">Печать / Сохранить PDF</button>
</body></html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfDevPage() {
  return <Suspense><ProfDevInner /></Suspense>;
}

function ProfDevInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const activeTab    = (searchParams.get("tab") ?? "overview") as Tab;
  const { toasts, show } = useToast();

  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [pdfLoading, setPdfLoading]     = useState(false);
  const [pdfOpen, setPdfOpen]           = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(LS_PANEL) === "true";
  });
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (!moreOpen) return;
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setMoreOpen(false); setPdfOpen(false); }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [moreOpen]);

  function setTab(t: Tab) {
    router.push(`/professional-development?tab=${t}`, { scroll: false });
  }

  function togglePanel(collapsed: boolean) {
    setPanelCollapsed(collapsed);
    localStorage.setItem(LS_PANEL, String(collapsed));
  }

  async function handleExport() {
    setPdfLoading(true);
    try { await generatePDF(selectedYear); }
    catch { show("Ошибка экспорта", "err"); }
    finally { setPdfLoading(false); setPdfOpen(false); }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden lg:pl-10" style={{ background: "#FBF8F5" }}>

      {/* Header */}
      <header className="flex-shrink-0 px-4 lg:px-6 pt-4 pb-0" style={{ background: "#FBF8F5" }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "#E8EEF9", border: "1px solid #B8CCF0" }}>
            <GraduationCap size={18} style={{ color: "#3a5ff8" }} />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight" style={{ color: "#3D3228" }}>Профессиональное развитие</h1>
            <p className="text-xs" style={{ color: "#7A6A52" }}>Обучение, супервизии, документы и цели</p>
          </div>

          {/* Right header buttons */}
          <div className="ml-auto flex items-center gap-2">
            {/* Show panel button (when collapsed) */}
            {panelCollapsed && (
              <button
                onClick={() => togglePanel(false)}
                title="Показать статистику"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                style={{ background: "#F3EBDD", border: "1px solid #CFC0A9", color: "#3D3228" }}>
                <BarChart2 size={13} style={{ color: "#3a5ff8" }} />
                Статистика
              </button>
            )}

          </div>
        </div>

        {/* Tabs — primary row + "Ещё" dropdown for secondary */}
        {(() => {
          const secondaryActive = SECONDARY_TABS.find(t => t.key === activeTab);
          return (
            <div className="flex border-b" style={{ borderColor: "#E5E5E5" }}>
              {PRIMARY_TABS.map(({ key, label, icon: Icon }) => {
                const active = key === activeTab;
                return (
                  <button key={key} onClick={() => setTab(key)}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors flex-shrink-0"
                    style={{
                      color: active ? "#3a5ff8" : "#6B7280",
                      borderBottom: active ? "2px solid #3a5ff8" : "2px solid transparent",
                      marginBottom: "-1px",
                    }}>
                    <Icon size={14} strokeWidth={active ? 2.3 : 1.8} />
                    <span>{label}</span>
                  </button>
                );
              })}

              {/* "Ещё" dropdown */}
              <div ref={moreRef} className="relative flex-shrink-0">
                <button onClick={() => setMoreOpen(p => !p)}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors"
                  style={{
                    color: secondaryActive ? "#3a5ff8" : "#6B7280",
                    borderBottom: secondaryActive ? "2px solid #3a5ff8" : "2px solid transparent",
                    marginBottom: "-1px",
                  }}>
                  {secondaryActive
                    ? <><secondaryActive.icon size={14} strokeWidth={2.3} /><span>{secondaryActive.label}</span></>
                    : <span>Ещё</span>
                  }
                  <ChevronDown size={12} style={{ transform: moreOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                </button>
                {moreOpen && (
                  <div className="absolute left-0 top-full mt-1 z-30 rounded-xl shadow-xl py-1 w-48"
                    style={{ background: "#FFFFFF", border: "1px solid #E5E5E5" }}>
                    {SECONDARY_TABS.map(({ key, label, icon: Icon }) => (
                      <button key={key} onClick={() => { setTab(key); setMoreOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium"
                        style={{ color: key === activeTab ? "#3a5ff8" : "#3D3228",
                          background: key === activeTab ? "#EEF4FB" : "transparent" }}
                        onMouseEnter={e => { if (key !== activeTab) e.currentTarget.style.background = "#F7F4F0"; }}
                        onMouseLeave={e => { if (key !== activeTab) e.currentTarget.style.background = "transparent"; }}>
                        <Icon size={14} />
                        {label}
                      </button>
                    ))}
                    <div style={{ height: 1, background: "#E5E5E5", margin: "4px 12px" }} />
                    <button onClick={() => { setMoreOpen(false); setPdfOpen(true); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium"
                      style={{ color: "#3D3228" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#F7F4F0"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                      <Download size={14} />
                      Отчёт PDF
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </header>

      {/* PDF export modal */}
      {pdfOpen && (
        <Modal title="Экспорт отчёта" onClose={() => setPdfOpen(false)}>
          <div className="flex flex-col gap-4">
            <p className="text-sm" style={{ color: "#7A6A52" }}>Выберите год для формирования отчёта об аккредитации.</p>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#6B7280" }}>Год</label>
              <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ background: "#F3EBDD", borderColor: "#CFC0A9", color: "#3D3228" }}>
                {YEAR_OPTIONS.filter(y => y > 0).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button onClick={handleExport} disabled={pdfLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
              style={{ background: "#3a5ff8", color: "#fff" }}>
              {pdfLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Скачать PDF
            </button>
          </div>
        </Modal>
      )}

      {/* Content — 2-column on xl+ */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col xl:flex-row">

        {/* Left: main tab content */}
        <div className="flex-1 min-h-0 overflow-y-auto pb-16 lg:pb-4">
          {activeTab === "overview"      && <OverviewTab      onNavigate={setTab} year={selectedYear} />}
          {activeTab === "courses"       && <CoursesTab       onToast={show} />}
          {activeTab === "supervisions"  && <SupervisionsTab  onToast={show} />}
          {activeTab === "calendar"      && <CalendarTab />}
          {activeTab === "documents"     && <DocumentsTab     onToast={show} />}
          {activeTab === "goals"         && <GoalsTab         onToast={show} year={selectedYear} />}
          {activeTab === "associations"  && <AssociationsTab  onToast={show} />}
          {activeTab === "finances"      && <FinancesTab      onToast={show} />}
          {activeTab === "library"       && <LibraryTab       onToast={show} />}
          {activeTab === "reflection"    && <ReflectionTab    onToast={show} year={selectedYear} />}
        </div>

        {/* Right panel */}
        {!panelCollapsed && (
          <VisualizationPanel
            year={selectedYear}
            onClose={() => togglePanel(true)}
            onNavigate={(tab) => setTab(tab as Tab)}
          />
        )}
      </div>

      {/* Toasts */}
      <div className="fixed bottom-20 lg:bottom-6 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium"
            style={{ background: t.type === "ok" ? "#16A34A" : "#DC2626", color: "#fff", pointerEvents: "auto" }}>
            {t.type === "ok" ? <Check size={14} /> : <AlertCircle size={14} />}
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════

function OverviewTab({ onNavigate, year }: { onNavigate: (t: Tab) => void; year: number; onToast?: (m: string, t?: "ok"|"err") => void }) {
  const [data, setData]       = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  useEffect(() => {
    setLoading(true);
    apiFetch(`/overview?year=${year}`).then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [year]);

  if (loading) return <TabSkeleton rows={6} />;
  if (error)   return <TabError msg={error} />;
  if (!data)   return null;

  // Reminders
  const reminders: { text: string; color: string; icon: React.ElementType }[] = [];
  if (data.last_supervision_date) {
    const days = Math.floor((Date.now() - new Date(data.last_supervision_date).getTime()) / 86400000);
    if (days >= 21) reminders.push({ text: `Последняя супервизия — ${days} дн. назад`, color: days >= 35 ? "#EF4444" : "#D97706", icon: AlertCircle });
  }
  for (const a of data.expiring_associations) {
    const days = Math.ceil((new Date(a.membership_expires).getTime() - Date.now()) / 86400000);
    reminders.push({ text: `Членство ${a.acronym ?? a.name} истекает через ${days} дн.`, color: days < 30 ? "#EF4444" : "#D97706", icon: Building2 });
  }

  const kpis = [
    { label: "Часы обучения",    num: data.learning_hours_this_year,    unit: "ч", icon: BookOpen,   color: "#3a5ff8", tab: "courses"      as Tab, cta: "+ Добавить курс"        },
    { label: "Часы супервизий",  num: data.supervision_hours_this_year, unit: "ч", icon: Users,      color: "#7C3AED", tab: "supervisions"  as Tab, cta: "+ Добавить супервизию"  },
    { label: "Курсов в процессе",num: data.courses_in_progress,         unit: "",  icon: TrendingUp, color: "#D97706", tab: "courses"      as Tab, cta: "+ Начать курс"          },
    { label: "Сертификатов",     num: data.certificates_total,          unit: "",  icon: Award,      color: "#16A34A", tab: "documents"    as Tab, cta: "+ Загрузить документ"   },
  ];

  const CAT_LABELS_SHORT: Record<string, string> = {
    long_program: "Долгосрочные", qualification: "Повышение квалиф.", specialization: "Специализация",
    intensive: "Интенсив", webinar: "Вебинар", seminar: "Семинар",
    conference: "Конференция", masterclass: "Мастер-класс", online_course: "Онлайн-курс", other: "Другое",
  };
  const catEntries = Object.entries(data.hours_by_category).filter(([,h]) => h > 0).sort(([,a],[,b]) => b - a);
  const maxCatH = catEntries[0]?.[1] ?? 1;

  const allEmpty = kpis.every(k => k.num === 0) &&
    data.recent_courses.length === 0 && data.recent_sessions.length === 0 && data.active_goals.length === 0;

  return (
    <div className="px-4 lg:px-6 py-4 space-y-5 max-w-2xl">

      {/* Reminders */}
      {reminders.length > 0 && (
        <div className="space-y-2">
          {reminders.map((r, i) => (
            <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm"
              style={{ background: `${r.color}12`, border: `1px solid ${r.color}40`, color: r.color }}>
              <r.icon size={14} className="flex-shrink-0" />
              {r.text}
            </div>
          ))}
        </div>
      )}

      {/* KPI — always show number; colour-tinted bg when active */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
        {kpis.map(k => {
          const active = k.num > 0;
          return (
            <button key={k.label} onClick={() => onNavigate(k.tab)}
              className="rounded-2xl p-3 text-left flex flex-col gap-0.5 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2"
              style={{
                background: active ? `${k.color}0D` : "#F3EBDD",
                border: `1px solid ${active ? k.color + "28" : "#CFC0A9"}`,
              }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-1"
                style={{ background: `${k.color}18` }}>
                <k.icon size={13} style={{ color: k.color }} />
              </div>
              <div className="text-xl font-bold leading-none" style={{ color: "#3D3228" }}>
                {k.num}
                {k.unit && <span className="text-sm font-medium ml-0.5" style={{ color: "#7A6A52" }}>{k.unit}</span>}
              </div>
              <div className="text-xs leading-tight" style={{ color: "#7A6A52" }}>{k.label}</div>
              {!active && (
                <span className="text-xs font-semibold mt-1" style={{ color: k.color }}>{k.cta} →</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Hours breakdown */}
      {catEntries.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "#F3EBDD", border: "1px solid #CFC0A9" }}>
          <div className="text-sm font-semibold mb-3" style={{ color: "#3D3228" }}>Часы по категориям</div>
          <div className="space-y-2.5">
            {catEntries.map(([cat, h]) => (
              <div key={cat}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs" style={{ color: "#5C5047" }}>{CAT_LABELS_SHORT[cat] ?? cat}</span>
                  <span className="text-xs font-semibold" style={{ color: "#3D3228" }}>{h} ч</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "#DDD4C6" }}>
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${(h / maxCatH) * 100}%`, background: "#3a5ff8" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next event */}
      {data.next_event && (
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: "#E8EEF9", border: "1px solid #B8CCF0" }}>
          <CalendarDays size={18} style={{ color: "#3a5ff8" }} />
          <div>
            <div className="text-sm font-semibold" style={{ color: "#3D3228" }}>{data.next_event.title}</div>
            <div className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
              {new Date(data.next_event.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>
      )}

      {data.recent_courses.length > 0 && (
        <Section title="Курсы в процессе" onMore={() => onNavigate("courses")}>
          {data.recent_courses.map(c => <CourseRow key={c.id} course={c} />)}
        </Section>
      )}
      {data.recent_sessions.length > 0 && (
        <Section title="Последние супервизии" onMore={() => onNavigate("supervisions")}>
          {data.recent_sessions.map(s => <SessionRow key={s.id} session={s} />)}
        </Section>
      )}
      {data.active_goals.length > 0 && (
        <Section title="Активные цели" onMore={() => onNavigate("goals")}>
          {data.active_goals.map(g => <GoalRow key={g.id} goal={g} />)}
        </Section>
      )}

      {/* Getting-started panel — shown only when profile is truly empty */}
      {allEmpty && (
        <div className="rounded-2xl p-5" style={{ background: "#F3EBDD", border: "1px solid #CFC0A9" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "#E8EEF9", border: "1px solid #B8CCF0" }}>
              <GraduationCap size={20} style={{ color: "#3a5ff8" }} />
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: "#3D3228" }}>С чего начать</div>
              <div className="text-xs mt-0.5" style={{ color: "#7A6A52" }}>Добавьте первые записи — они появятся здесь</div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={() => onNavigate("courses")}
              className="w-full py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "#3a5ff8", color: "#fff" }}>
              + Добавить обучение
            </button>
            <div className="grid grid-cols-3 gap-2">
              {([["Супервизию", "supervisions"], ["Документ", "documents"], ["Цель", "goals"]] as [string, Tab][]).map(([label, tab]) => (
                <button key={tab} onClick={() => onNavigate(tab)}
                  className="py-2 rounded-xl text-xs font-medium"
                  style={{ background: "#EDE4D8", color: "#3D3228", border: "1px solid #CFC0A9" }}>
                  + {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: COURSES
// ── Confirm delete hook ────────────────────────────────────────────────────────

function useConfirmDelete() {
  const [pending, setPending] = useState<{ msg: string; resolve: (v: boolean) => void } | null>(null);

  function confirmDelete(msg: string): Promise<boolean> {
    return new Promise(resolve => setPending({ msg, resolve }));
  }

  const dialog = pending ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.25)" }}
      onClick={() => { pending.resolve(false); setPending(null); }}>
      <div className="rounded-2xl p-5 shadow-xl max-w-xs w-full"
        style={{ background: "#FBF8F5", border: "1px solid #CFC0A9" }}
        onClick={e => e.stopPropagation()}>
        <p className="text-sm font-medium mb-4 text-center" style={{ color: "#3D3228" }}>
          {pending.msg}
        </p>
        <div className="flex gap-2">
          <button onClick={() => { pending.resolve(false); setPending(null); }}
            className="flex-1 py-2 rounded-xl text-sm font-medium"
            style={{ background: "#F3EBDD", color: "#3D3228" }}>
            Отмена
          </button>
          <button onClick={() => { pending.resolve(true); setPending(null); }}
            className="flex-1 py-2 rounded-xl text-sm font-medium"
            style={{ background: "#EF4444", color: "#fff" }}>
            Удалить
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirmDelete, dialog };
}

// ═══════════════════════════════════════════════════════════════════════════════

function CoursesTab({ onToast }: { onToast: (m: string, t?: "ok"|"err") => void }) {
  const { confirmDelete, dialog: confirmDialog } = useConfirmDelete();
  const [courses, setCourses]     = useState<RawCourse[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [editing, setEditing]     = useState<RawCourse | null>(null);
  const [formOpen, setFormOpen]   = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterYear, setFilterYear]     = useState(0);
  const [search, setSearch]       = useState("");

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/courses").then(setCourses).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = courses.filter(c => {
    if (filterStatus && c.status !== filterStatus) return false;
    if (filterYear) {
      const y = c.start_date ? new Date(c.start_date).getFullYear() : (c.end_date ? new Date(c.end_date).getFullYear() : 0);
      if (y !== filterYear) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (!c.title.toLowerCase().includes(q) && !(c.provider ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  async function deleteCourse(id: string) {
    if (!await confirmDelete("Удалить курс?")) return;
    try {
      await apiFetch(`/courses/${id}`, { method: "DELETE" });
      setCourses(p => p.filter(c => c.id !== id));
      onToast("Курс удалён");
    } catch (e: unknown) { onToast(e instanceof Error ? e.message : "Ошибка", "err"); }
  }

  function openEdit(c: RawCourse) { setEditing(c); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditing(null); }

  if (loading) return <TabSkeleton rows={4} />;
  if (error)   return <TabError msg={error} />;

  return (
    <div className="px-4 lg:px-6 py-4 max-w-3xl">
      {confirmDialog}
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Поиск..." className="flex-1 min-w-32 rounded-xl border px-3 py-1.5 text-sm outline-none"
          style={{ background: "#F3EBDD", borderColor: "#CFC0A9", color: "#3D3228" }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="rounded-xl border px-2.5 py-1.5 text-sm outline-none"
          style={{ background: "#F3EBDD", borderColor: "#CFC0A9", color: "#3D3228" }}>
          <option value="">Все статусы</option>
          <option value="planned">Запланирован</option>
          <option value="in_progress">В процессе</option>
          <option value="completed">Завершён</option>
          <option value="paused">Приостановлен</option>
          <option value="not_completed">Не завершён</option>
        </select>
        <YearSelect value={filterYear} onChange={setFilterYear} />
        <button onClick={() => { setEditing(null); setFormOpen(true); }}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-semibold"
          style={{ background: "#3a5ff8", color: "#fff" }}>
          <Plus size={14} /> Добавить
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={BookOpen} title="Курсов нет" desc="Добавьте первый курс или программу обучения"
          action={{ label: "Добавить курс", onClick: () => { setEditing(null); setFormOpen(true); } }} />
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <div key={c.id} className="rounded-2xl p-4" style={{ background: "#F3EBDD", border: "1px solid #CFC0A9" }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate" style={{ color: "#3D3228" }}>{c.title}</div>
                  {c.provider && <div className="text-xs mt-0.5" style={{ color: "#7A6A52" }}>{c.provider}</div>}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <StatusBadge status={c.status} />
                    <span className="text-xs" style={{ color: "#7A6A52" }}>{CAT_LABELS[c.category] ?? c.category}</span>
                    {c.total_hours && (
                      <span className="text-xs flex items-center gap-0.5" style={{ color: "#7A6A52" }}>
                        <Clock size={11} /> {c.completed_hours ?? 0}/{c.total_hours} ч
                      </span>
                    )}
                    {c.certificate_received && (
                      <span className="text-xs flex items-center gap-0.5" style={{ color: "#16A34A" }}>
                        <Award size={11} /> Сертификат
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <IconBtn icon={Pencil} onClick={() => openEdit(c)} title="Редактировать" />
                  <IconBtn icon={X} onClick={() => deleteCourse(c.id)} title="Удалить" />
                </div>
              </div>
              {c.total_hours && c.completed_hours !== undefined && (
                <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "#DDD4C6" }}>
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, (c.completed_hours / c.total_hours) * 100)}%`, background: "#3a5ff8" }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <CourseForm initial={editing} onClose={closeForm}
          onSaved={() => { closeForm(); load(); onToast(editing ? "Курс обновлён" : "Курс сохранён"); }}
          onToast={onToast} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: SUPERVISIONS + ЛИЧНАЯ ТЕРАПИЯ
// ═══════════════════════════════════════════════════════════════════════════════

function SupervisionsTab({ onToast }: { onToast: (m: string, t?: "ok"|"err") => void }) {
  const [inner, setInner] = useState<"supervision" | "therapy">("supervision");

  return (
    <div className="px-4 lg:px-6 py-4 max-w-3xl">
      {/* Inner toggle */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl w-fit" style={{ background: "#EDE8DF" }}>
        {(["supervision", "therapy"] as const).map(k => (
          <button key={k} onClick={() => setInner(k)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: inner === k ? "#fff" : "transparent",
              color: inner === k ? "#3D3228" : "#7A6A52",
              boxShadow: inner === k ? "0 1px 3px rgba(0,0,0,.1)" : "none",
            }}>
            {k === "supervision" ? <><Users size={13} /> Супервизии</> : <><HeartHandshake size={13} /> Личная терапия</>}
          </button>
        ))}
      </div>

      {inner === "supervision" ? <SessionsList onToast={onToast} /> : <TherapyList onToast={onToast} />}
    </div>
  );
}

function SessionsList({ onToast }: { onToast: (m: string, t?: "ok"|"err") => void }) {
  const { confirmDelete, dialog: confirmDialog } = useConfirmDelete();
  const [sessions, setSessions] = useState<RawSession[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [editing, setEditing]   = useState<RawSession | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [filterYear, setFilterYear] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/sessions").then(setSessions).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = sessions.filter(s => {
    if (filterType && s.session_type !== filterType) return false;
    if (filterYear && new Date(s.session_date).getFullYear() !== filterYear) return false;
    return true;
  });

  async function del(id: string) {
    if (!await confirmDelete("Удалить запись?")) return;
    try {
      await apiFetch(`/sessions/${id}`, { method: "DELETE" });
      setSessions(p => p.filter(s => s.id !== id));
      onToast("Запись удалена");
    } catch (e: unknown) { onToast(e instanceof Error ? e.message : "Ошибка", "err"); }
  }

  if (loading) return <TabSkeleton rows={4} />;
  if (error)   return <TabError msg={error} />;

  return (
    <>
      {confirmDialog}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="text-xs px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 flex-1"
          style={{ background: "#FEF3C7", border: "1px solid #FCD34D", color: "#92400E" }}>
          <AlertCircle size={12} className="flex-shrink-0" />
          Не указывайте полные имена клиентов в заметках
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="rounded-xl border px-2.5 py-1.5 text-sm outline-none"
          style={{ background: "#F3EBDD", borderColor: "#CFC0A9", color: "#3D3228" }}>
          <option value="">Все типы</option>
          {Object.entries(SESSION_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <YearSelect value={filterYear} onChange={setFilterYear} />
        <button onClick={() => { setEditing(null); setFormOpen(true); }}
          className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-semibold"
          style={{ background: "#3a5ff8", color: "#fff" }}>
          <Plus size={14} /> Добавить
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="Супервизий пока нет" desc="Здесь будет история ваших супервизий и интервизий"
          action={{ label: "Добавить", onClick: () => { setEditing(null); setFormOpen(true); } }} />
      ) : (
        <div className="space-y-3">
          {filtered.map(s => (
            <div key={s.id} className="rounded-2xl p-4" style={{ background: "#F3EBDD", border: "1px solid #CFC0A9" }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-lg" style={{ background: "#E8EEF9", color: "#355E9C" }}>
                      {SESSION_TYPE_LABELS[s.session_type] ?? s.session_type}
                    </span>
                    <span className="text-xs" style={{ color: "#7A6A52" }}>
                      {new Date(s.session_date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                    {s.duration_minutes && (
                      <span className="text-xs flex items-center gap-0.5" style={{ color: "#7A6A52" }}>
                        <Clock size={11} /> {s.duration_minutes} мин
                      </span>
                    )}
                  </div>
                  {s.supervisor_name && <div className="text-sm font-medium mt-1" style={{ color: "#3D3228" }}>{s.supervisor_name}</div>}
                  {s.topic && s.confidentiality_mode !== "linked_client" && (
                    <div className="text-sm mt-1 line-clamp-2" style={{ color: "#6B7280" }}>{s.topic}</div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <IconBtn icon={Pencil} onClick={() => { setEditing(s); setFormOpen(true); }} title="Редактировать" />
                  <IconBtn icon={X} onClick={() => del(s.id)} title="Удалить" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <SessionForm initial={editing} onClose={() => { setFormOpen(false); setEditing(null); }}
          onSaved={() => { setFormOpen(false); setEditing(null); load(); onToast(editing ? "Запись обновлена" : "Запись сохранена"); }}
          onToast={onToast} />
      )}
    </>
  );
}

function TherapyList({ onToast }: { onToast: (m: string, t?: "ok"|"err") => void }) {
  const { confirmDelete, dialog: confirmDialog } = useConfirmDelete();
  const [items, setItems]       = useState<RawTherapy[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [editing, setEditing]   = useState<RawTherapy | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [filterYear, setFilterYear] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/therapy").then(setItems).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(t =>
    !filterYear || new Date(t.session_date).getFullYear() === filterYear
  );

  async function del(id: string) {
    if (!await confirmDelete("Удалить запись?")) return;
    try {
      await apiFetch(`/therapy/${id}`, { method: "DELETE" });
      setItems(p => p.filter(t => t.id !== id));
      onToast("Запись удалена");
    } catch (e: unknown) { onToast(e instanceof Error ? e.message : "Ошибка", "err"); }
  }

  if (loading) return <TabSkeleton rows={3} />;
  if (error)   return <TabError msg={error} />;

  return (
    <>
      {confirmDialog}
      <div className="flex flex-wrap gap-2 mb-4">
        <YearSelect value={filterYear} onChange={setFilterYear} />
        <button onClick={() => { setEditing(null); setFormOpen(true); }}
          className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-semibold"
          style={{ background: "#3a5ff8", color: "#fff" }}>
          <Plus size={14} /> Добавить
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={HeartHandshake} title="Записей личной терапии нет"
          desc="Фиксируйте сессии личной терапии для учёта часов аккредитации"
          action={{ label: "Добавить", onClick: () => { setEditing(null); setFormOpen(true); } }} />
      ) : (
        <div className="space-y-3">
          {filtered.map(t => (
            <div key={t.id} className="rounded-2xl p-4" style={{ background: "#F3EBDD", border: "1px solid #CFC0A9" }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-lg" style={{ background: "#FCE7F3", color: "#9D174D" }}>
                      Личная терапия
                    </span>
                    <span className="text-xs" style={{ color: "#7A6A52" }}>
                      {new Date(t.session_date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                    {t.duration_minutes && (
                      <span className="text-xs flex items-center gap-0.5" style={{ color: "#7A6A52" }}>
                        <Clock size={11} /> {t.duration_minutes} мин
                      </span>
                    )}
                  </div>
                  {t.therapist_name && <div className="text-sm font-medium mt-1" style={{ color: "#3D3228" }}>{t.therapist_name}</div>}
                  {t.topic && <div className="text-sm mt-1 line-clamp-2" style={{ color: "#6B7280" }}>{t.topic}</div>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <IconBtn icon={Pencil} onClick={() => { setEditing(t); setFormOpen(true); }} title="Редактировать" />
                  <IconBtn icon={X} onClick={() => del(t.id)} title="Удалить" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <TherapyForm initial={editing} onClose={() => { setFormOpen(false); setEditing(null); }}
          onSaved={() => { setFormOpen(false); setEditing(null); load(); onToast(editing ? "Запись обновлена" : "Запись сохранена"); }}
          onToast={onToast} />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: CALENDAR
// ═══════════════════════════════════════════════════════════════════════════════

type ProfDevEvent = { id: string; title: string; starts_at: string; ends_at?: string; event_category: "course" | "supervision" | "therapy" | "goal" };

const CATEGORY_META: Record<ProfDevEvent["event_category"], { label: string; color: string }> = {
  course:      { label: "Обучение",       color: "#3a5ff8" },
  supervision: { label: "Супервизия",     color: "#7c3aed" },
  therapy:     { label: "Личная терапия", color: "#059669" },
  goal:        { label: "Дедлайн цели",   color: "#d97706" },
};

function CalendarTab() {
  const [events, setEvents] = useState<ProfDevEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    const from = new Date().toISOString().slice(0, 10);
    const to   = new Date(Date.now() + 180 * 86_400_000).toISOString().slice(0, 10);
    fetch(`/api/professional-development/calendar?from=${from}&to=${to}`)
      .then(r => r.json())
      .then((data: ProfDevEvent[] | { error: string }) => {
        if ("error" in data) { setError(data.error); return; }
        setEvents(data);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <TabSkeleton rows={3} />;

  return (
    <div className="px-4 lg:px-6 py-4 max-w-3xl">
      {error && (
        <p className="text-xs mb-4 text-red-500">{error}</p>
      )}
      {events.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Предстоящих событий нет"
          desc="Запланируйте курс, супервизию или личную терапию — они появятся здесь." />
      ) : (
        <div className="space-y-2">
          {events.map(e => {
            const meta = CATEGORY_META[e.event_category];
            const dateStr = new Date(e.starts_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
            return (
              <div key={e.id} className="rounded-2xl px-4 py-3 flex items-center gap-3"
                style={{ background: "#F3EBDD", border: "1px solid #CFC0A9" }}>
                <CalendarDays size={15} style={{ color: meta.color, flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: "#3D3228" }}>{e.title}</div>
                  <div className="text-xs" style={{ color: "#7A6A52" }}>{dateStr}</div>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: `${meta.color}14`, color: meta.color }}>
                  {meta.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: DOCUMENTS
// ═══════════════════════════════════════════════════════════════════════════════

function DocumentsTab({ onToast }: { onToast: (m: string, t?: "ok"|"err") => void }) {
  const { confirmDelete, dialog: confirmDialog } = useConfirmDelete();
  const [docs, setDocs]         = useState<RawDoc[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [uploading, setUploading] = useState(false);
  const [editingMeta, setEditingMeta] = useState<RawDoc | null>(null);
  const fileRef                 = useRef<HTMLInputElement>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType]   = useState("certificate");
  const [formOrg, setFormOrg]     = useState("");
  const [formDate, setFormDate]   = useState("");
  const [formFile, setFormFile]   = useState<File | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [filterType, setFilterType] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/documents").then(setDocs).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = docs.filter(d => !filterType || d.document_type === filterType);

  async function openDoc(id: string) {
    try {
      const data = await apiFetch(`/documents/${id}`);
      if (data.signed_url) window.open(data.signed_url, "_blank");
    } catch (e: unknown) { onToast(e instanceof Error ? e.message : "Ошибка открытия", "err"); }
  }

  async function deleteDoc(id: string) {
    if (!await confirmDelete("Удалить документ и файл?")) return;
    try {
      await apiFetch(`/documents/${id}`, { method: "DELETE" });
      setDocs(p => p.filter(d => d.id !== id));
      onToast("Документ удалён");
    } catch (e: unknown) { onToast(e instanceof Error ? e.message : "Ошибка", "err"); }
  }

  async function upload() {
    if (!formFile || !formTitle.trim()) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", formFile);
      fd.append("title", formTitle.trim());
      fd.append("document_type", formType);
      if (formOrg.trim()) fd.append("organization", formOrg.trim());
      if (formDate) fd.append("issued_date", formDate);
      await apiFetch("/documents", { method: "POST", body: fd });
      setUploadOpen(false); setFormTitle(""); setFormFile(null); setFormOrg(""); setFormDate("");
      load(); onToast("Документ загружен");
    } catch (e: unknown) { onToast(e instanceof Error ? e.message : "Ошибка загрузки", "err"); }
    finally { setUploading(false); }
  }

  async function saveMeta() {
    if (!editingMeta) return;
    try {
      await apiFetch(`/documents/${editingMeta.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editingMeta.title, document_type: editingMeta.document_type, organization: editingMeta.organization, issued_date: editingMeta.issued_date }),
      });
      setDocs(p => p.map(d => d.id === editingMeta.id ? editingMeta : d));
      setEditingMeta(null);
      onToast("Документ обновлён");
    } catch (e: unknown) { onToast(e instanceof Error ? e.message : "Ошибка", "err"); }
  }

  if (loading) return <TabSkeleton rows={3} />;
  if (error)   return <TabError msg={error} />;

  return (
    <div className="px-4 lg:px-6 py-4 max-w-3xl">
      {confirmDialog}
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="rounded-xl border px-2.5 py-1.5 text-sm outline-none"
          style={{ background: "#F3EBDD", borderColor: "#CFC0A9", color: "#3D3228" }}>
          <option value="">Все типы</option>
          {Object.entries(DOC_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button onClick={() => setUploadOpen(true)}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-semibold"
          style={{ background: "#3a5ff8", color: "#fff" }}>
          <Plus size={14} /> Загрузить
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={FileText} title="Документов пока нет"
          desc="Добавьте сертификаты, дипломы и подтверждения обучения"
          action={{ label: "Загрузить", onClick: () => setUploadOpen(true) }} />
      ) : (
        <div className="space-y-3">
          {filtered.map(d => (
            <div key={d.id} className="rounded-2xl p-4" style={{ background: "#F3EBDD", border: "1px solid #CFC0A9" }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm" style={{ color: "#3D3228" }}>{d.title}</div>
                  <div className="text-xs mt-0.5" style={{ color: "#7A6A52" }}>{DOC_TYPE_LABELS[d.document_type] ?? d.document_type}</div>
                  {d.organization && <div className="text-xs mt-0.5" style={{ color: "#7A6A52" }}>{d.organization}</div>}
                  {d.issued_date && (
                    <div className="text-xs mt-1" style={{ color: "#7A6A52" }}>
                      {new Date(d.issued_date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => openDoc(d.id)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: "#E8EEF9", color: "#3a5ff8" }}>Открыть</button>
                  <IconBtn icon={Pencil} onClick={() => setEditingMeta({ ...d })} title="Редактировать" />
                  <IconBtn icon={X} onClick={() => deleteDoc(d.id)} title="Удалить" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload modal */}
      {uploadOpen && (
        <Modal title="Загрузить документ" onClose={() => setUploadOpen(false)}>
          <div className="space-y-3">
            <Field label="Название *">
              <input value={formTitle} onChange={e => setFormTitle(e.target.value)} className={INPUT} placeholder="Сертификат по КПТ" />
            </Field>
            <Field label="Тип документа">
              <select value={formType} onChange={e => setFormType(e.target.value)} className={INPUT}>
                {Object.entries(DOC_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Организация">
              <input value={formOrg} onChange={e => setFormOrg(e.target.value)} className={INPUT} placeholder="Институт психотерапии" />
            </Field>
            <Field label="Дата выдачи">
              <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className={INPUT} />
            </Field>
            <Field label="Файл * (PDF, JPG, PNG, до 20 МБ)">
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx"
                onChange={e => setFormFile(e.target.files?.[0] ?? null)} className="w-full text-sm" style={{ color: "#3D3228" }} />
            </Field>
            <button onClick={upload} disabled={uploading || !formFile || !formTitle.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ background: "#3a5ff8", color: "#fff" }}>
              {uploading ? "Загружаю..." : "Загрузить"}
            </button>
          </div>
        </Modal>
      )}

      {/* Edit meta modal */}
      {editingMeta && (
        <Modal title="Редактировать документ" onClose={() => setEditingMeta(null)}>
          <div className="space-y-3">
            <Field label="Название">
              <input value={editingMeta.title} onChange={e => setEditingMeta(p => p ? { ...p, title: e.target.value } : p)}
                className={INPUT} />
            </Field>
            <Field label="Тип документа">
              <select value={editingMeta.document_type} onChange={e => setEditingMeta(p => p ? { ...p, document_type: e.target.value } : p)} className={INPUT}>
                {Object.entries(DOC_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Организация">
              <input value={editingMeta.organization ?? ""} onChange={e => setEditingMeta(p => p ? { ...p, organization: e.target.value } : p)} className={INPUT} />
            </Field>
            <Field label="Дата выдачи">
              <input type="date" value={editingMeta.issued_date?.slice(0, 10) ?? ""} onChange={e => setEditingMeta(p => p ? { ...p, issued_date: e.target.value } : p)} className={INPUT} />
            </Field>
            <button onClick={saveMeta} className="w-full py-2.5 rounded-xl text-sm font-semibold" style={{ background: "#3a5ff8", color: "#fff" }}>
              Сохранить
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: GOALS
// ═══════════════════════════════════════════════════════════════════════════════

function GoalsTab({ onToast, year }: { onToast: (m: string, t?: "ok"|"err") => void; year: number }) {
  const { confirmDelete, dialog: confirmDialog } = useConfirmDelete();
  const [goals, setGoals]       = useState<RawGoal[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [editing, setEditing]   = useState<RawGoal | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/goals").then(setGoals).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = goals.filter(g => !filterStatus || g.status === filterStatus);

  async function updateProgress(id: string, progress: number) {
    try {
      await apiFetch(`/goals/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ progress }) });
      setGoals(p => p.map(g => g.id === id ? { ...g, progress } : g));
    } catch (e: unknown) { onToast(e instanceof Error ? e.message : "Ошибка", "err"); }
  }

  async function deleteGoal(id: string) {
    if (!await confirmDelete("Удалить цель?")) return;
    try {
      await apiFetch(`/goals/${id}`, { method: "DELETE" });
      setGoals(p => p.filter(g => g.id !== id));
      onToast("Цель удалена");
    } catch (e: unknown) { onToast(e instanceof Error ? e.message : "Ошибка", "err"); }
  }

  if (loading) return <TabSkeleton rows={4} />;
  if (error)   return <TabError msg={error} />;

  const groups: { status: string; label: string }[] = [
    { status: "in_progress", label: "В работе" },
    { status: "planned",     label: "Запланировано" },
    { status: "completed",   label: "Достигнуто" },
    { status: "postponed",   label: "Отложено" },
  ];

  const visibleGroups = filterStatus
    ? [{ status: filterStatus, label: groups.find(g => g.status === filterStatus)?.label ?? filterStatus }]
    : groups;

  return (
    <div className="px-4 lg:px-6 py-4 max-w-3xl">
      {confirmDialog}
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="rounded-xl border px-2.5 py-1.5 text-sm outline-none"
          style={{ background: "#F3EBDD", borderColor: "#CFC0A9", color: "#3D3228" }}>
          <option value="">Все статусы</option>
          <option value="in_progress">В работе</option>
          <option value="planned">Запланировано</option>
          <option value="completed">Достигнуто</option>
          <option value="postponed">Отложено</option>
        </select>
        <button onClick={() => { setEditing(null); setFormOpen(true); }}
          className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-semibold"
          style={{ background: "#3a5ff8", color: "#fff" }}>
          <Plus size={14} /> Добавить цель
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Target} title="Целей пока нет" desc="Создайте первую профессиональную цель"
          action={{ label: "Добавить цель", onClick: () => { setEditing(null); setFormOpen(true); } }} />
      ) : (
        <div className="space-y-6">
          {visibleGroups.map(g => {
            const items = filtered.filter(goal => goal.status === g.status);
            if (items.length === 0) return null;
            return (
              <div key={g.status}>
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#7A6A52" }}>{g.label}</h3>
                <div className="space-y-3">
                  {items.map(goal => (
                    <div key={goal.id} className="rounded-2xl p-4" style={{ background: "#F3EBDD", border: "1px solid #CFC0A9" }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm" style={{ color: "#3D3228" }}>{goal.title}</div>
                          {goal.motivation && <div className="text-xs mt-0.5 line-clamp-1" style={{ color: "#7A6A52" }}>{goal.motivation}</div>}
                          {goal.target_date && (
                            <div className="text-xs mt-0.5" style={{ color: "#7A6A52" }}>
                              Срок: {new Date(goal.target_date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                            </div>
                          )}
                          <div className="mt-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs" style={{ color: "#7A6A52" }}>Прогресс</span>
                              <span className="text-xs font-semibold" style={{ color: "#3D3228" }}>{goal.progress}%</span>
                            </div>
                            <input type="range" min={0} max={100} value={goal.progress}
                              onChange={e => updateProgress(goal.id, Number(e.target.value))}
                              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                              style={{ accentColor: "#3a5ff8" }} />
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <IconBtn icon={Pencil} onClick={() => { setEditing(goal); setFormOpen(true); }} title="Редактировать" />
                          <IconBtn icon={X} onClick={() => deleteGoal(goal.id)} title="Удалить" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formOpen && (
        <GoalForm initial={editing} onClose={() => { setFormOpen(false); setEditing(null); }}
          onSaved={() => { setFormOpen(false); setEditing(null); load(); onToast(editing ? "Цель обновлена" : "Цель добавлена"); }}
          onToast={onToast} />
      )}

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: REFLECTION
// ═══════════════════════════════════════════════════════════════════════════════

function ReflectionTab({ year, onToast }: { year: number; onToast: (m: string, t?: "ok"|"err") => void }) {
  return (
    <div className="px-4 lg:px-6 py-4 max-w-3xl">
      <AnnualReflection year={year} onToast={onToast} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORMS
// ═══════════════════════════════════════════════════════════════════════════════

function CourseForm({ initial, onClose, onSaved, onToast }: {
  initial?: RawCourse | null; onClose: () => void;
  onSaved: () => void; onToast: (m: string, t?: "ok"|"err") => void;
}) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    title:             initial?.title             ?? "",
    provider:          initial?.provider          ?? "",
    category:          initial?.category          ?? "other",
    format:            initial?.format            ?? "online",
    status:            initial?.status            ?? "planned",
    total_hours:       initial?.total_hours       != null ? String(initial.total_hours) : "",
    completed_hours:   initial?.completed_hours   != null ? String(initial.completed_hours) : "",
    start_date:        initial?.start_date?.slice(0, 10) ?? "",
    end_date:          initial?.end_date?.slice(0, 10)   ?? "",
    certificate_received: initial?.certificate_received ?? false,
    notes:             initial?.notes ?? "",
  });

  async function save() {
    if (!f.title.trim()) { onToast("Укажите название", "err"); return; }
    setSaving(true);
    try {
      const body = {
        ...f,
        total_hours:     f.total_hours     ? Number(f.total_hours)     : undefined,
        completed_hours: f.completed_hours ? Number(f.completed_hours) : undefined,
      };
      if (initial) {
        await apiFetch(`/courses/${initial.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        await apiFetch("/courses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      onSaved();
    } catch (e: unknown) { onToast(e instanceof Error ? e.message : "Ошибка", "err"); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={initial ? "Редактировать курс" : "Добавить обучение"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Название *">
          <input value={f.title} onChange={e => setF(p => ({ ...p, title: e.target.value }))} className={INPUT} placeholder="КПТ для работы с тревогой" />
        </Field>
        <Field label="Организация / Школа">
          <input value={f.provider} onChange={e => setF(p => ({ ...p, provider: e.target.value }))} className={INPUT} placeholder="Институт психотерапии" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Категория">
            <select value={f.category} onChange={e => setF(p => ({ ...p, category: e.target.value }))} className={INPUT}>
              {Object.entries(CAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Формат">
            <select value={f.format} onChange={e => setF(p => ({ ...p, format: e.target.value }))} className={INPUT}>
              <option value="online">Онлайн</option>
              <option value="offline">Очно</option>
              <option value="hybrid">Гибрид</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Статус">
            <select value={f.status} onChange={e => setF(p => ({ ...p, status: e.target.value }))} className={INPUT}>
              <option value="planned">Запланирован</option>
              <option value="in_progress">В процессе</option>
              <option value="completed">Завершён</option>
              <option value="paused">Приостановлен</option>
              <option value="not_completed">Не завершён</option>
            </select>
          </Field>
          <Field label="Всего часов">
            <input type="number" min={0} value={f.total_hours} onChange={e => setF(p => ({ ...p, total_hours: e.target.value }))} className={INPUT} placeholder="120" />
          </Field>
        </div>
        <Field label="Пройдено часов">
          <input type="number" min={0} value={f.completed_hours} onChange={e => setF(p => ({ ...p, completed_hours: e.target.value }))} className={INPUT} placeholder="0" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Начало">
            <input type="date" value={f.start_date} onChange={e => setF(p => ({ ...p, start_date: e.target.value }))} className={INPUT} />
          </Field>
          <Field label="Окончание">
            <input type="date" value={f.end_date} onChange={e => setF(p => ({ ...p, end_date: e.target.value }))} className={INPUT} />
          </Field>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={f.certificate_received}
            onChange={e => setF(p => ({ ...p, certificate_received: e.target.checked }))}
            className="w-4 h-4 rounded accent-[#3a5ff8]" />
          <span className="text-sm" style={{ color: "#3D3228" }}>Получен сертификат</span>
        </label>
        <Field label="Заметки">
          <textarea value={f.notes} onChange={e => setF(p => ({ ...p, notes: e.target.value }))} className={`${INPUT} resize-none`} rows={2} />
        </Field>
        <button onClick={save} disabled={saving} className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "#3a5ff8", color: "#fff" }}>
          {saving ? "Сохраняю..." : "Сохранить"}
        </button>
      </div>
    </Modal>
  );
}

function SessionForm({ initial, onClose, onSaved, onToast }: {
  initial?: RawSession | null; onClose: () => void;
  onSaved: () => void; onToast: (m: string, t?: "ok"|"err") => void;
}) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    session_type:        initial?.session_type        ?? "supervision",
    session_date:        initial?.session_date?.slice(0, 16) ?? "",
    duration_minutes:    initial?.duration_minutes    != null ? String(initial.duration_minutes) : "",
    supervisor_name:     initial?.supervisor_name     ?? "",
    format:              initial?.format              ?? "online",
    group_or_individual: initial?.group_or_individual ?? "individual",
    topic:               initial?.topic               ?? "",
    main_insights:       initial?.main_insights       ?? "",
    confidentiality_mode: initial?.confidentiality_mode ?? "anonymous",
  });

  async function save() {
    if (!f.session_date) { onToast("Укажите дату", "err"); return; }
    setSaving(true);
    try {
      const body = { ...f, duration_minutes: f.duration_minutes ? Number(f.duration_minutes) : undefined };
      if (initial) {
        await apiFetch(`/sessions/${initial.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        await apiFetch("/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      onSaved();
    } catch (e: unknown) { onToast(e instanceof Error ? e.message : "Ошибка", "err"); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={initial ? "Редактировать запись" : "Добавить супервизию / встречу"} onClose={onClose}>
      <div className="space-y-3">
        <div className="p-2.5 rounded-xl text-xs" style={{ background: "#FEF3C7", color: "#92400E" }}>
          Не указывайте полные имена клиентов в заметках
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Тип встречи *">
            <select value={f.session_type} onChange={e => setF(p => ({ ...p, session_type: e.target.value }))} className={INPUT}>
              {Object.entries(SESSION_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Дата *">
            <input type="datetime-local" value={f.session_date} onChange={e => setF(p => ({ ...p, session_date: e.target.value }))} className={INPUT} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Длительность (мин)">
            <input type="number" min={1} value={f.duration_minutes} onChange={e => setF(p => ({ ...p, duration_minutes: e.target.value }))} className={INPUT} placeholder="50" />
          </Field>
          <Field label="Формат">
            <select value={f.format} onChange={e => setF(p => ({ ...p, format: e.target.value }))} className={INPUT}>
              <option value="online">Онлайн</option>
              <option value="offline">Очно</option>
              <option value="hybrid">Гибрид</option>
            </select>
          </Field>
        </div>
        <Field label="Супервизор / Ведущий">
          <input value={f.supervisor_name} onChange={e => setF(p => ({ ...p, supervisor_name: e.target.value }))} className={INPUT} placeholder="Имя супервизора" />
        </Field>
        <Field label="Тема (обезличенно)">
          <input value={f.topic} onChange={e => setF(p => ({ ...p, topic: e.target.value }))} className={INPUT} placeholder="Работа с тревогой у клиента" />
        </Field>
        <Field label="Основные выводы">
          <textarea value={f.main_insights} onChange={e => setF(p => ({ ...p, main_insights: e.target.value }))} className={`${INPUT} resize-none`} rows={3} />
        </Field>
        <button onClick={save} disabled={saving} className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "#3a5ff8", color: "#fff" }}>
          {saving ? "Сохраняю..." : "Сохранить"}
        </button>
      </div>
    </Modal>
  );
}

function TherapyForm({ initial, onClose, onSaved, onToast }: {
  initial?: RawTherapy | null; onClose: () => void;
  onSaved: () => void; onToast: (m: string, t?: "ok"|"err") => void;
}) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    session_date:        initial?.session_date?.slice(0, 16) ?? "",
    duration_minutes:    initial?.duration_minutes != null ? String(initial.duration_minutes) : "",
    therapist_name:      initial?.therapist_name ?? "",
    format:              initial?.format ?? "online",
    topic:               initial?.topic ?? "",
    notes:               initial?.notes ?? "",
    confidentiality_mode: initial?.confidentiality_mode ?? "anonymous",
  });

  async function save() {
    if (!f.session_date) { onToast("Укажите дату", "err"); return; }
    setSaving(true);
    try {
      const body = { ...f, duration_minutes: f.duration_minutes ? Number(f.duration_minutes) : undefined };
      if (initial) {
        await apiFetch(`/therapy/${initial.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        await apiFetch("/therapy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      onSaved();
    } catch (e: unknown) { onToast(e instanceof Error ? e.message : "Ошибка", "err"); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={initial ? "Редактировать запись" : "Добавить сессию личной терапии"} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Дата *">
            <input type="datetime-local" value={f.session_date} onChange={e => setF(p => ({ ...p, session_date: e.target.value }))} className={INPUT} />
          </Field>
          <Field label="Длительность (мин)">
            <input type="number" min={1} value={f.duration_minutes} onChange={e => setF(p => ({ ...p, duration_minutes: e.target.value }))} className={INPUT} placeholder="50" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Терапевт">
            <input value={f.therapist_name} onChange={e => setF(p => ({ ...p, therapist_name: e.target.value }))} className={INPUT} placeholder="Имя терапевта" />
          </Field>
          <Field label="Формат">
            <select value={f.format} onChange={e => setF(p => ({ ...p, format: e.target.value }))} className={INPUT}>
              <option value="online">Онлайн</option>
              <option value="offline">Очно</option>
              <option value="hybrid">Гибрид</option>
            </select>
          </Field>
        </div>
        <Field label="Тема / заметка (обезличенно)">
          <textarea value={f.topic} onChange={e => setF(p => ({ ...p, topic: e.target.value }))} className={`${INPUT} resize-none`} rows={2} />
        </Field>
        <button onClick={save} disabled={saving} className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "#3a5ff8", color: "#fff" }}>
          {saving ? "Сохраняю..." : "Сохранить"}
        </button>
      </div>
    </Modal>
  );
}

function GoalForm({ initial, onClose, onSaved, onToast }: {
  initial?: RawGoal | null; onClose: () => void;
  onSaved: () => void; onToast: (m: string, t?: "ok"|"err") => void;
}) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    title:       initial?.title       ?? "",
    description: initial?.description ?? "",
    motivation:  initial?.motivation  ?? "",
    status:      initial?.status      ?? "planned",
    target_date: initial?.target_date?.slice(0, 10) ?? "",
    progress:    initial?.progress    ?? 0,
  });

  async function save() {
    if (!f.title.trim()) { onToast("Укажите название цели", "err"); return; }
    setSaving(true);
    try {
      if (initial) {
        await apiFetch(`/goals/${initial.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      } else {
        await apiFetch("/goals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      }
      onSaved();
    } catch (e: unknown) { onToast(e instanceof Error ? e.message : "Ошибка", "err"); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={initial ? "Редактировать цель" : "Добавить цель"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Название *">
          <input value={f.title} onChange={e => setF(p => ({ ...p, title: e.target.value }))} className={INPUT} placeholder="Пройти обучение по схема-терапии" />
        </Field>
        <Field label="Описание">
          <textarea value={f.description} onChange={e => setF(p => ({ ...p, description: e.target.value }))} className={`${INPUT} resize-none`} rows={2} />
        </Field>
        <Field label="Мотивация">
          <input value={f.motivation} onChange={e => setF(p => ({ ...p, motivation: e.target.value }))} className={INPUT} placeholder="Зачем это важно..." />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Статус">
            <select value={f.status} onChange={e => setF(p => ({ ...p, status: e.target.value }))} className={INPUT}>
              <option value="planned">Запланировано</option>
              <option value="in_progress">В работе</option>
              <option value="completed">Достигнуто</option>
              <option value="postponed">Отложено</option>
            </select>
          </Field>
          <Field label="Срок">
            <input type="date" value={f.target_date} onChange={e => setF(p => ({ ...p, target_date: e.target.value }))} className={INPUT} />
          </Field>
        </div>
        {initial && (
          <Field label={`Прогресс: ${f.progress}%`}>
            <input type="range" min={0} max={100} value={f.progress}
              onChange={e => setF(p => ({ ...p, progress: Number(e.target.value) }))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer" style={{ accentColor: "#3a5ff8" }} />
          </Field>
        )}
        <button onClick={save} disabled={saving} className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "#3a5ff8", color: "#fff" }}>
          {saving ? "Сохраняю..." : "Сохранить"}
        </button>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED UI
// ═══════════════════════════════════════════════════════════════════════════════

const INPUT = "w-full rounded-xl border px-3 py-2 text-sm outline-none bg-[#F3EBDD] border-[#CFC0A9] text-[#3D3228]";

function YearSelect({ value, onChange }: { value: number; onChange: (y: number) => void }) {
  return (
    <select value={value} onChange={e => onChange(Number(e.target.value))}
      className="rounded-xl border px-2.5 py-1.5 text-sm outline-none"
      style={{ background: "#F3EBDD", borderColor: "#CFC0A9", color: "#3D3228" }}>
      <option value={0}>Все годы</option>
      {YEAR_OPTIONS.filter(y => y > 0).map(y => <option key={y} value={y}>{y}</option>)}
    </select>
  );
}

function IconBtn({ icon: Icon, onClick, title }: { icon: React.ElementType; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title}
      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
      style={{ color: "#7A6A52" }}
      onMouseEnter={e => { e.currentTarget.style.background = "#E8E0D4"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
      <Icon size={14} />
    </button>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/30 backdrop-blur-sm lg:p-4"
      onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl lg:rounded-2xl shadow-2xl"
        style={{ background: "#FBF8F5" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#E5E5E5" }}>
          <h2 className="font-semibold text-sm" style={{ color: "#3D3228" }}>{title}</h2>
          <IconBtn icon={X} onClick={onClose} title="Закрыть" />
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: "#6B7280" }}>{label}</label>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = STATUS_COLORS;
  const c = colors[status] ?? "#6B7280";
  return (
    <span className="text-xs px-2 py-0.5 rounded-lg font-medium"
      style={{ background: `${c}18`, color: c }}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function Section({ title, onMore, children }: { title: string; onMore?: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold" style={{ color: "#3D3228" }}>{title}</h2>
        {onMore && (
          <button onClick={onMore} className="text-xs flex items-center gap-0.5" style={{ color: "#3a5ff8" }}>
            Все <ChevronRight size={12} />
          </button>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function CourseRow({ course: c }: { course: RawCourse }) {
  return (
    <div className="rounded-xl px-3 py-2.5 flex items-center gap-3" style={{ background: "#F3EBDD", border: "1px solid #CFC0A9" }}>
      <BookOpen size={14} style={{ color: "#3a5ff8", flexShrink: 0 }} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate" style={{ color: "#3D3228" }}>{c.title}</div>
        {c.provider && <div className="text-xs" style={{ color: "#7A6A52" }}>{c.provider}</div>}
      </div>
      <StatusBadge status={c.status} />
    </div>
  );
}

function SessionRow({ session: s }: { session: RawSession }) {
  return (
    <div className="rounded-xl px-3 py-2.5 flex items-center gap-3" style={{ background: "#F3EBDD", border: "1px solid #CFC0A9" }}>
      <Users size={14} style={{ color: "#7C3AED", flexShrink: 0 }} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium" style={{ color: "#3D3228" }}>{SESSION_TYPE_LABELS[s.session_type] ?? s.session_type}</div>
        <div className="text-xs" style={{ color: "#7A6A52" }}>
          {new Date(s.session_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
          {s.supervisor_name && ` · ${s.supervisor_name}`}
        </div>
      </div>
    </div>
  );
}

function GoalRow({ goal: g }: { goal: RawGoal }) {
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ background: "#F3EBDD", border: "1px solid #CFC0A9" }}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-sm font-medium truncate" style={{ color: "#3D3228" }}>{g.title}</div>
        <span className="text-xs font-semibold flex-shrink-0" style={{ color: "#3a5ff8" }}>{g.progress}%</span>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: "#DDD4C6" }}>
        <div className="h-full rounded-full" style={{ width: `${g.progress}%`, background: "#3a5ff8" }} />
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, desc, action }: {
  icon: React.ElementType; title: string; desc: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#F3EBDD", border: "1px solid #CFC0A9" }}>
        <Icon size={24} style={{ color: "#7A6A52" }} />
      </div>
      <div className="text-sm font-semibold mb-1" style={{ color: "#3D3228" }}>{title}</div>
      <div className="text-sm max-w-xs" style={{ color: "#7A6A52" }}>{desc}</div>
      {action && (
        <button onClick={action.onClick} className="mt-5 flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "#3a5ff8", color: "#fff" }}>
          <Plus size={14} /> {action.label}
        </button>
      )}
    </div>
  );
}

function AnnualReflection({ year, onToast }: { year: number; onToast: (m: string, t?: "ok"|"err") => void }) {
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [f, setF] = useState({ key_learnings: "", main_direction: "", challenges: "", proud_of: "", next_year_focus: "" });

  useEffect(() => {
    apiFetch(`/reflections?year=${year}`)
      .then(d => { if (d) setF({ key_learnings: d.key_learnings ?? "", main_direction: d.main_direction ?? "", challenges: d.challenges ?? "", proud_of: d.proud_of ?? "", next_year_focus: d.next_year_focus ?? "" }); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [year]);

  async function save() {
    setSaving(true);
    try {
      await apiFetch("/reflections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year, ...f }) });
      onToast("Рефлексия сохранена");
    } catch (e: unknown) { onToast(e instanceof Error ? e.message : "Ошибка", "err"); }
    finally { setSaving(false); }
  }

  if (!loaded) return <div className="px-4 py-6 text-center text-sm" style={{ color: "#7A6A52" }}>Загрузка...</div>;

  const REFL_FIELDS = [
    { key: "key_learnings",   label: "Что самое важное освоил/а в этом году?" },
    { key: "proud_of",        label: "Чем профессионально горжусь?" },
    { key: "challenges",      label: "Какие трудности встретил/а?" },
    { key: "main_direction",  label: "Главное профессиональное направление этого года" },
    { key: "next_year_focus", label: "Фокус на следующий год" },
  ] as const;

  return (
    <div className="px-4 py-4 space-y-3" style={{ background: "#FBF8F5" }}>
      <p className="text-xs" style={{ color: "#7A6A52" }}>Ответы сохраняются автоматически. Вы можете вернуться к рефлексии в любое время.</p>
      {REFL_FIELDS.map(({ key, label }) => (
        <div key={key}>
          <label className="block text-xs font-medium mb-1" style={{ color: "#6B7280" }}>{label}</label>
          <textarea value={f[key]} onChange={e => setF(p => ({ ...p, [key]: e.target.value }))}
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none resize-none"
            style={{ background: "#F3EBDD", borderColor: "#CFC0A9", color: "#3D3228" }}
            rows={2} placeholder="Напишите здесь..." />
        </div>
      ))}
      <button onClick={save} disabled={saving}
        className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
        style={{ background: "#3a5ff8", color: "#fff" }}>
        {saving ? "Сохраняю..." : "Сохранить рефлексию"}
      </button>
    </div>
  );
}

function TabSkeleton({ rows }: { rows: number }) {
  return (
    <div className="px-4 lg:px-6 py-4 space-y-3 max-w-3xl">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-2xl h-20 animate-pulse" style={{ background: "#F3EBDD" }} />
      ))}
    </div>
  );
}

function TabError({ msg }: { msg: string }) {
  return (
    <div className="px-4 lg:px-6 py-8 flex flex-col items-center gap-3">
      <AlertCircle size={24} style={{ color: "#EF4444" }} />
      <div className="text-sm text-center max-w-sm" style={{ color: "#6B7280" }}>
        {msg.includes("401") || msg.includes("Unauthorized")
          ? "Установите переменную PROF_DEV_USER_ID в настройках Railway"
          : msg}
      </div>
    </div>
  );
}
