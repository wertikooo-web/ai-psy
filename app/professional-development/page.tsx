"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GraduationCap, BookOpen, Users, CalendarDays, FileText, Target,
  Plus, ChevronRight, Clock, Award, TrendingUp, Loader2,
  AlertCircle, X, Check,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "overview" | "courses" | "supervisions" | "calendar" | "documents" | "goals";

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
}

interface RawCourse {
  id: string; title: string; status: string; category: string;
  total_hours?: number; completed_hours?: number; certificate_received: boolean;
  start_date?: string; end_date?: string; provider?: string;
}
interface RawSession {
  id: string; session_type: string; session_date: string;
  duration_minutes?: number; supervisor_name?: string; topic?: string;
  confidentiality_mode: string;
}
interface RawDoc {
  id: string; title: string; document_type: string; organization?: string; issued_date?: string;
}
interface RawGoal {
  id: string; title: string; status: string; progress: number; target_date?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "overview",      label: "Обзор",          icon: TrendingUp   },
  { key: "courses",       label: "Обучение",        icon: BookOpen     },
  { key: "supervisions",  label: "Супервизии",      icon: Users        },
  { key: "calendar",      label: "Календарь",       icon: CalendarDays },
  { key: "documents",     label: "Документы",       icon: FileText     },
  { key: "goals",         label: "План развития",   icon: Target       },
];

const STATUS_LABELS: Record<string, string> = {
  planned: "Запланирован", in_progress: "В процессе", completed: "Завершён",
  paused: "Приостановлен", not_completed: "Не завершён",
  supervision: "Супервизия", intervision: "Интервизия",
  balint_group: "Балинтовская группа", clinical_case: "Клинический разбор",
  methodology_group: "Методическая группа", other: "Другое",
};
const STATUS_COLORS: Record<string, string> = {
  planned: "#6B7280", in_progress: "#3a5ff8", completed: "#16A34A",
  paused: "#D97706", not_completed: "#EF4444",
};
const CAT_LABELS: Record<string, string> = {
  long_program: "Долгосрочная программа", qualification: "Повышение квалификации",
  specialization: "Специализация", intensive: "Интенсив", webinar: "Вебинар",
  seminar: "Семинар", conference: "Конференция", masterclass: "Мастер-класс",
  online_course: "Онлайн-курс", other: "Другое",
};

// ── Toast ─────────────────────────────────────────────────────────────────────

interface Toast { id: number; msg: string; type: "ok" | "err" }

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((msg: string, type: Toast["type"] = "ok") => {
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

// ── Page (wrapped for Suspense) ───────────────────────────────────────────────

export default function ProfDevPage() {
  return (
    <Suspense>
      <ProfDevInner />
    </Suspense>
  );
}

function ProfDevInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const activeTab    = (searchParams.get("tab") ?? "overview") as Tab;
  const { toasts, show } = useToast();

  function setTab(t: Tab) {
    router.push(`/professional-development?tab=${t}`, { scroll: false });
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden" style={{ background: "#FBF8F5" }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 px-4 lg:px-6 pt-4 pb-0" style={{ background: "#FBF8F5" }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "#E8EEF9", border: "1px solid #B8CCF0" }}>
            <GraduationCap size={18} style={{ color: "#3a5ff8" }} />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight" style={{ color: "#3D3228" }}>
              Профессиональное развитие
            </h1>
            <p className="text-xs" style={{ color: "#A8997F" }}>
              Обучение, супервизии, документы и цели
            </p>
          </div>
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div className="overflow-x-auto -mx-4 lg:-mx-6 px-4 lg:px-6" style={{ scrollbarWidth: "none" }}>
          <div className="flex gap-1 min-w-max border-b" style={{ borderColor: "#E5E5E5" }}>
            {TABS.map(({ key, label, icon: Icon }) => {
              const active = key === activeTab;
              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors flex-shrink-0 relative"
                  style={{ color: active ? "#3a5ff8" : "#6B7280" }}
                >
                  <Icon size={14} strokeWidth={active ? 2.3 : 1.8} />
                  <span>{label}</span>
                  {active && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                      style={{ background: "#3a5ff8" }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ── Tab content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto pb-16 lg:pb-4">
        {activeTab === "overview"     && <OverviewTab     onNavigate={setTab} onToast={show} />}
        {activeTab === "courses"      && <CoursesTab      onToast={show} />}
        {activeTab === "supervisions" && <SupervisionsTab onToast={show} />}
        {activeTab === "calendar"     && <CalendarTab     />}
        {activeTab === "documents"    && <DocumentsTab    onToast={show} />}
        {activeTab === "goals"        && <GoalsTab        onToast={show} />}
      </div>

      {/* ── Toast stack ─────────────────────────────────────────────────────── */}
      <div className="fixed bottom-20 lg:bottom-6 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium"
            style={{
              background: t.type === "ok" ? "#16A34A" : "#DC2626",
              color: "#fff", pointerEvents: "auto",
            }}>
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

function OverviewTab({ onNavigate, onToast }: { onNavigate: (t: Tab) => void; onToast: (m: string, t?: "ok"|"err") => void }) {
  const [data, setData]     = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  useEffect(() => {
    apiFetch("/overview")
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <TabSkeleton rows={6} />;
  if (error)   return <TabError msg={error} />;
  if (!data)   return null;

  const kpis = [
    { label: "Часы обучения (год)",    value: `${data.learning_hours_this_year} ч`,    icon: BookOpen,     color: "#3a5ff8" },
    { label: "Часы супервизий (год)",  value: `${data.supervision_hours_this_year} ч`, icon: Users,        color: "#7C3AED" },
    { label: "Курсов в процессе",      value: String(data.courses_in_progress),        icon: TrendingUp,   color: "#D97706" },
    { label: "Сертификатов всего",     value: String(data.certificates_total),         icon: Award,        color: "#16A34A" },
  ];

  return (
    <div className="px-4 lg:px-6 py-4 space-y-6 max-w-4xl">

      {/* KPI карточки */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="rounded-2xl p-4" style={{ background: "#F3EBDD", border: "1px solid #CFC0A9" }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2"
              style={{ background: `${k.color}18` }}>
              <k.icon size={15} style={{ color: k.color }} />
            </div>
            <div className="text-2xl font-bold" style={{ color: "#3D3228" }}>{k.value}</div>
            <div className="text-xs mt-0.5" style={{ color: "#A8997F" }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Следующее событие */}
      {data.next_event && (
        <div className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: "#E8EEF9", border: "1px solid #B8CCF0" }}>
          <CalendarDays size={18} style={{ color: "#3a5ff8" }} />
          <div>
            <div className="text-sm font-semibold" style={{ color: "#3D3228" }}>{data.next_event.title}</div>
            <div className="text-xs" style={{ color: "#6B7280" }}>
              {new Date(data.next_event.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>
      )}

      {/* Быстрые действия */}
      <div>
        <h2 className="text-sm font-semibold mb-2" style={{ color: "#3D3228" }}>Быстрые действия</h2>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Добавить обучение",    tab: "courses"      as Tab },
            { label: "Добавить супервизию",  tab: "supervisions" as Tab },
            { label: "Добавить документ",    tab: "documents"    as Tab },
            { label: "Добавить цель",        tab: "goals"        as Tab },
          ].map(a => (
            <button key={a.tab} onClick={() => onNavigate(a.tab)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
              style={{ background: "#F3EBDD", border: "1px solid #CFC0A9", color: "#3D3228" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#EAE0D0"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#F3EBDD"; }}>
              <Plus size={13} /> {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Курсы в процессе */}
      {data.recent_courses.length > 0 && (
        <Section title="Курсы в процессе" onMore={() => onNavigate("courses")}>
          {data.recent_courses.map(c => (
            <CourseRow key={c.id} course={c} />
          ))}
        </Section>
      )}

      {/* Последние супервизии */}
      {data.recent_sessions.length > 0 && (
        <Section title="Последние супервизии" onMore={() => onNavigate("supervisions")}>
          {data.recent_sessions.map(s => (
            <SessionRow key={s.id} session={s} />
          ))}
        </Section>
      )}

      {/* Цели */}
      {data.active_goals.length > 0 && (
        <Section title="Активные цели" onMore={() => onNavigate("goals")}>
          {data.active_goals.map(g => (
            <GoalRow key={g.id} goal={g} />
          ))}
        </Section>
      )}

      {/* Все разделы пустые */}
      {data.recent_courses.length === 0 && data.recent_sessions.length === 0 && data.active_goals.length === 0 && (
        <EmptyState
          icon={GraduationCap}
          title="Начните заполнять профессиональный профиль"
          desc="Добавьте первый курс, супервизию или цель развития"
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: COURSES
// ═══════════════════════════════════════════════════════════════════════════════

function CoursesTab({ onToast }: { onToast: (m: string, t?: "ok"|"err") => void }) {
  const [courses, setCourses] = useState<RawCourse[]>([]);
  const [loading, setLoading]  = useState(true);
  const [error, setError]      = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [filter, setFilter]    = useState("");

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/courses")
      .then(setCourses)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = courses.filter(c =>
    !filter || c.title.toLowerCase().includes(filter.toLowerCase()) ||
    (c.provider ?? "").toLowerCase().includes(filter.toLowerCase())
  );

  async function deleteCourse(id: string) {
    if (!confirm("Удалить курс? Связанные документы сохранятся.")) return;
    try {
      await apiFetch(`/courses/${id}`, { method: "DELETE" });
      setCourses(p => p.filter(c => c.id !== id));
      onToast("Курс удалён");
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : "Ошибка", "err");
    }
  }

  if (loading) return <TabSkeleton rows={4} />;
  if (error)   return <TabError msg={error} />;

  return (
    <div className="px-4 lg:px-6 py-4 max-w-3xl">
      <div className="flex items-center gap-3 mb-4">
        <input
          value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Поиск по названию или организации..."
          className="flex-1 rounded-xl border px-3 py-2 text-sm outline-none"
          style={{ background: "#F3EBDD", borderColor: "#CFC0A9", color: "#3D3228" }}
        />
        <button onClick={() => setFormOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "#3a5ff8", color: "#fff" }}>
          <Plus size={14} /> Добавить
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={BookOpen} title="Курсов пока нет"
          desc="Добавьте первый курс или программу обучения"
          action={{ label: "Добавить курс", onClick: () => setFormOpen(true) }} />
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <div key={c.id} className="rounded-2xl p-4"
              style={{ background: "#F3EBDD", border: "1px solid #CFC0A9" }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate" style={{ color: "#3D3228" }}>{c.title}</div>
                  {c.provider && <div className="text-xs mt-0.5" style={{ color: "#A8997F" }}>{c.provider}</div>}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <StatusBadge status={c.status} />
                    <span className="text-xs" style={{ color: "#9C8E80" }}>{CAT_LABELS[c.category] ?? c.category}</span>
                    {c.total_hours && (
                      <span className="text-xs flex items-center gap-0.5" style={{ color: "#9C8E80" }}>
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
                <button onClick={() => deleteCourse(c.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ color: "#9C8E80" }}
                  title="Удалить">
                  <X size={14} />
                </button>
              </div>
              {c.total_hours && c.completed_hours !== undefined && (
                <div className="mt-3">
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#DDD4C6" }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, (c.completed_hours / c.total_hours) * 100)}%`, background: "#3a5ff8" }} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <CourseForm
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); load(); onToast("Курс сохранён"); }}
          onToast={onToast}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: SUPERVISIONS
// ═══════════════════════════════════════════════════════════════════════════════

function SupervisionsTab({ onToast }: { onToast: (m: string, t?: "ok"|"err") => void }) {
  const [sessions, setSessions] = useState<RawSession[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/sessions")
      .then(setSessions)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deleteSession(id: string) {
    if (!confirm("Удалить запись?")) return;
    try {
      await apiFetch(`/sessions/${id}`, { method: "DELETE" });
      setSessions(p => p.filter(s => s.id !== id));
      onToast("Запись удалена");
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : "Ошибка", "err");
    }
  }

  if (loading) return <TabSkeleton rows={4} />;
  if (error)   return <TabError msg={error} />;

  return (
    <div className="px-4 lg:px-6 py-4 max-w-3xl">
      <div className="flex justify-end mb-4">
        <button onClick={() => setFormOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "#3a5ff8", color: "#fff" }}>
          <Plus size={14} /> Добавить
        </button>
      </div>

      {/* Privacy notice */}
      <div className="mb-4 rounded-xl px-3 py-2 text-xs flex items-start gap-2"
        style={{ background: "#FEF3C7", border: "1px solid #FCD34D", color: "#92400E" }}>
        <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
        Не указывайте полные имена клиентов и идентифицирующие сведения в заметках супервизии
      </div>

      {sessions.length === 0 ? (
        <EmptyState icon={Users} title="Супервизий пока нет"
          desc="Здесь будет история ваших супервизий и интервизий"
          action={{ label: "Добавить", onClick: () => setFormOpen(true) }} />
      ) : (
        <div className="space-y-3">
          {sessions.map(s => (
            <div key={s.id} className="rounded-2xl p-4"
              style={{ background: "#F3EBDD", border: "1px solid #CFC0A9" }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-lg"
                      style={{ background: "#E8EEF9", color: "#355E9C" }}>
                      {STATUS_LABELS[s.session_type] ?? s.session_type}
                    </span>
                    <span className="text-xs" style={{ color: "#9C8E80" }}>
                      {new Date(s.session_date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                    {s.duration_minutes && (
                      <span className="text-xs flex items-center gap-0.5" style={{ color: "#9C8E80" }}>
                        <Clock size={11} /> {s.duration_minutes} мин
                      </span>
                    )}
                  </div>
                  {s.supervisor_name && (
                    <div className="text-sm font-medium mt-1" style={{ color: "#3D3228" }}>{s.supervisor_name}</div>
                  )}
                  {s.topic && s.confidentiality_mode !== "linked_client" && (
                    <div className="text-sm mt-1 line-clamp-2" style={{ color: "#6B7280" }}>{s.topic}</div>
                  )}
                </div>
                <button onClick={() => deleteSession(s.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ color: "#9C8E80" }} title="Удалить">
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <SessionForm
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); load(); onToast("Запись сохранена"); }}
          onToast={onToast}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: CALENDAR (профессиональные события из общего календаря)
// ═══════════════════════════════════════════════════════════════════════════════

function CalendarTab() {
  const [events, setEvents] = useState<{ id: string; title: string; starts_at: string; event_category: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date().toISOString();
    const far = new Date(Date.now() + 90 * 86400000).toISOString();
    fetch(`/api/calendar-events?from=${now}&to=${far}`)
      .then(r => r.json())
      .then((all: { id: string; title: string; starts_at: string; event_category?: string }[]) => {
        setEvents(all.filter(e => e.event_category && e.event_category !== "client_session").map(e => ({ ...e, event_category: e.event_category! })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <TabSkeleton rows={3} />;

  return (
    <div className="px-4 lg:px-6 py-4 max-w-3xl">
      <p className="text-xs mb-4" style={{ color: "#A8997F" }}>
        Профессиональные события из общего Календаря. Создавайте события там и выбирайте соответствующую категорию.
      </p>
      {events.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Профессиональных событий пока нет"
          desc="Добавьте событие в разделе Календарь и выберите категорию «Обучение», «Супервизия» и т.д." />
      ) : (
        <div className="space-y-3">
          {events.map(e => (
            <div key={e.id} className="rounded-2xl p-4 flex items-center gap-3"
              style={{ background: "#F3EBDD", border: "1px solid #CFC0A9" }}>
              <CalendarDays size={16} style={{ color: "#3a5ff8", flexShrink: 0 }} />
              <div>
                <div className="text-sm font-semibold" style={{ color: "#3D3228" }}>{e.title}</div>
                <div className="text-xs" style={{ color: "#9C8E80" }}>
                  {new Date(e.starts_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: DOCUMENTS
// ═══════════════════════════════════════════════════════════════════════════════

function DocumentsTab({ onToast }: { onToast: (m: string, t?: "ok"|"err") => void }) {
  const [docs, setDocs]        = useState<RawDoc[]>([]);
  const [loading, setLoading]  = useState(true);
  const [error, setError]      = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef                = useRef<HTMLInputElement>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType]   = useState("certificate");
  const [formFile, setFormFile]   = useState<File | null>(null);
  const [formOpen, setFormOpen]   = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/documents")
      .then(setDocs)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openDoc(id: string) {
    try {
      const data = await apiFetch(`/documents/${id}`);
      if (data.signed_url) window.open(data.signed_url, "_blank");
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : "Ошибка открытия", "err");
    }
  }

  async function deleteDoc(id: string) {
    if (!confirm("Удалить документ и файл?")) return;
    try {
      await apiFetch(`/documents/${id}`, { method: "DELETE" });
      setDocs(p => p.filter(d => d.id !== id));
      onToast("Документ удалён");
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : "Ошибка", "err");
    }
  }

  async function upload() {
    if (!formFile || !formTitle.trim()) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", formFile);
      fd.append("title", formTitle.trim());
      fd.append("document_type", formType);
      await apiFetch("/documents", { method: "POST", body: fd });
      setFormOpen(false); setFormTitle(""); setFormFile(null);
      load();
      onToast("Документ загружен");
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : "Ошибка загрузки", "err");
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <TabSkeleton rows={3} />;
  if (error)   return <TabError msg={error} />;

  return (
    <div className="px-4 lg:px-6 py-4 max-w-3xl">
      <div className="flex justify-end mb-4">
        <button onClick={() => setFormOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "#3a5ff8", color: "#fff" }}>
          <Plus size={14} /> Загрузить
        </button>
      </div>

      {docs.length === 0 ? (
        <EmptyState icon={FileText} title="Документов пока нет"
          desc="Добавьте сертификаты, дипломы и подтверждения обучения"
          action={{ label: "Загрузить", onClick: () => setFormOpen(true) }} />
      ) : (
        <div className="space-y-3">
          {docs.map(d => (
            <div key={d.id} className="rounded-2xl p-4"
              style={{ background: "#F3EBDD", border: "1px solid #CFC0A9" }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm" style={{ color: "#3D3228" }}>{d.title}</div>
                  {d.organization && <div className="text-xs mt-0.5" style={{ color: "#A8997F" }}>{d.organization}</div>}
                  {d.issued_date && (
                    <div className="text-xs mt-1" style={{ color: "#9C8E80" }}>
                      {new Date(d.issued_date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => openDoc(d.id)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: "#E8EEF9", color: "#3a5ff8" }}>
                    Открыть
                  </button>
                  <button onClick={() => deleteDoc(d.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ color: "#9C8E80" }} title="Удалить">
                    <X size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload form */}
      {formOpen && (
        <Modal title="Загрузить документ" onClose={() => setFormOpen(false)}>
          <div className="space-y-3">
            <Field label="Название *">
              <input value={formTitle} onChange={e => setFormTitle(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ background: "#F3EBDD", borderColor: "#CFC0A9", color: "#3D3228" }}
                placeholder="Сертификат по КПТ" />
            </Field>
            <Field label="Тип документа">
              <select value={formType} onChange={e => setFormType(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ background: "#F3EBDD", borderColor: "#CFC0A9", color: "#3D3228" }}>
                <option value="certificate">Сертификат</option>
                <option value="diploma">Диплом</option>
                <option value="qualification">Свидетельство о квалификации</option>
                <option value="supervision_confirmation">Подтверждение супервизии</option>
                <option value="receipt">Чек / квитанция</option>
                <option value="other">Другое</option>
              </select>
            </Field>
            <Field label="Файл * (PDF, JPG, PNG, до 20 МБ)">
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx"
                onChange={e => setFormFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm" style={{ color: "#3D3228" }} />
            </Field>
            <button onClick={upload} disabled={uploading || !formFile || !formTitle.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ background: "#3a5ff8", color: "#fff" }}>
              {uploading ? "Загружаю..." : "Загрузить"}
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

function GoalsTab({ onToast }: { onToast: (m: string, t?: "ok"|"err") => void }) {
  const [goals, setGoals]     = useState<RawGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/goals")
      .then(setGoals)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function updateProgress(id: string, progress: number) {
    try {
      await apiFetch(`/goals/${id}`, { method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress }) });
      setGoals(p => p.map(g => g.id === id ? { ...g, progress } : g));
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : "Ошибка", "err");
    }
  }

  async function deleteGoal(id: string) {
    if (!confirm("Удалить цель?")) return;
    try {
      await apiFetch(`/goals/${id}`, { method: "DELETE" });
      setGoals(p => p.filter(g => g.id !== id));
      onToast("Цель удалена");
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : "Ошибка", "err");
    }
  }

  if (loading) return <TabSkeleton rows={4} />;
  if (error)   return <TabError msg={error} />;

  const groups: { status: RawGoal["status"]; label: string }[] = [
    { status: "in_progress", label: "В работе" },
    { status: "planned",     label: "Запланировано" },
    { status: "completed",   label: "Достигнуто" },
    { status: "postponed",   label: "Отложено" },
  ];

  const hasGoals = goals.length > 0;

  return (
    <div className="px-4 lg:px-6 py-4 max-w-3xl">
      <div className="flex justify-end mb-4">
        <button onClick={() => setFormOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "#3a5ff8", color: "#fff" }}>
          <Plus size={14} /> Добавить цель
        </button>
      </div>

      {!hasGoals ? (
        <EmptyState icon={Target} title="Целей пока нет"
          desc="Создайте первую профессиональную цель"
          action={{ label: "Добавить цель", onClick: () => setFormOpen(true) }} />
      ) : (
        <div className="space-y-6">
          {groups.map(g => {
            const items = goals.filter(goal => goal.status === g.status);
            if (items.length === 0) return null;
            return (
              <div key={g.status}>
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#9C8E80" }}>
                  {g.label}
                </h3>
                <div className="space-y-3">
                  {items.map(goal => (
                    <div key={goal.id} className="rounded-2xl p-4"
                      style={{ background: "#F3EBDD", border: "1px solid #CFC0A9" }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm" style={{ color: "#3D3228" }}>{goal.title}</div>
                          {goal.target_date && (
                            <div className="text-xs mt-0.5" style={{ color: "#A8997F" }}>
                              Срок: {new Date(goal.target_date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                            </div>
                          )}
                          <div className="mt-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs" style={{ color: "#9C8E80" }}>Прогресс</span>
                              <span className="text-xs font-semibold" style={{ color: "#3D3228" }}>{goal.progress}%</span>
                            </div>
                            <input type="range" min={0} max={100} value={goal.progress}
                              onChange={e => updateProgress(goal.id, Number(e.target.value))}
                              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                              style={{ accentColor: "#3a5ff8" }} />
                          </div>
                        </div>
                        <button onClick={() => deleteGoal(goal.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ color: "#9C8E80" }} title="Удалить">
                          <X size={14} />
                        </button>
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
        <GoalForm
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); load(); onToast("Цель добавлена"); }}
          onToast={onToast}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORMS
// ═══════════════════════════════════════════════════════════════════════════════

function CourseForm({ onClose, onSaved, onToast }: {
  onClose: () => void; onSaved: () => void; onToast: (m: string, t?: "ok"|"err") => void;
}) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    title: "", provider: "", category: "other", format: "online",
    status: "planned", total_hours: "", start_date: "", end_date: "",
  });

  async function save() {
    if (!f.title.trim()) { onToast("Укажите название", "err"); return; }
    setSaving(true);
    try {
      await apiFetch("/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f,
          total_hours: f.total_hours ? Number(f.total_hours) : undefined,
        }),
      });
      onSaved();
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : "Ошибка", "err");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Добавить обучение" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Название *">
          <input value={f.title} onChange={e => setF(p => ({ ...p, title: e.target.value }))}
            className={INPUT} placeholder="КПТ для работы с тревогой" />
        </Field>
        <Field label="Организация / Школа">
          <input value={f.provider} onChange={e => setF(p => ({ ...p, provider: e.target.value }))}
            className={INPUT} placeholder="Институт психотерапии" />
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
          <Field label="Кол-во часов">
            <input type="number" min={0} value={f.total_hours}
              onChange={e => setF(p => ({ ...p, total_hours: e.target.value }))}
              className={INPUT} placeholder="120" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Дата начала">
            <input type="date" value={f.start_date} onChange={e => setF(p => ({ ...p, start_date: e.target.value }))} className={INPUT} />
          </Field>
          <Field label="Дата окончания">
            <input type="date" value={f.end_date} onChange={e => setF(p => ({ ...p, end_date: e.target.value }))} className={INPUT} />
          </Field>
        </div>
        <button onClick={save} disabled={saving}
          className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
          style={{ background: "#3a5ff8", color: "#fff" }}>
          {saving ? "Сохраняю..." : "Сохранить"}
        </button>
      </div>
    </Modal>
  );
}

function SessionForm({ onClose, onSaved, onToast }: {
  onClose: () => void; onSaved: () => void; onToast: (m: string, t?: "ok"|"err") => void;
}) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    session_type: "supervision", session_date: "", duration_minutes: "",
    supervisor_name: "", format: "online", group_or_individual: "individual",
    topic: "", main_insights: "", confidentiality_mode: "anonymous",
  });

  async function save() {
    if (!f.session_date) { onToast("Укажите дату", "err"); return; }
    setSaving(true);
    try {
      await apiFetch("/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f,
          duration_minutes: f.duration_minutes ? Number(f.duration_minutes) : undefined,
        }),
      });
      onSaved();
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : "Ошибка", "err");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Добавить супервизию / встречу" onClose={onClose}>
      <div className="space-y-3">
        <div className="p-2.5 rounded-xl text-xs" style={{ background: "#FEF3C7", color: "#92400E" }}>
          Не указывайте полные имена клиентов в заметках
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Тип встречи *">
            <select value={f.session_type} onChange={e => setF(p => ({ ...p, session_type: e.target.value }))} className={INPUT}>
              <option value="supervision">Супервизия</option>
              <option value="intervision">Интервизия</option>
              <option value="balint_group">Балинтовская группа</option>
              <option value="clinical_case">Клинический разбор</option>
              <option value="methodology_group">Методическая группа</option>
              <option value="other">Другое</option>
            </select>
          </Field>
          <Field label="Дата *">
            <input type="datetime-local" value={f.session_date}
              onChange={e => setF(p => ({ ...p, session_date: e.target.value }))} className={INPUT} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Длительность (мин)">
            <input type="number" min={1} value={f.duration_minutes}
              onChange={e => setF(p => ({ ...p, duration_minutes: e.target.value }))}
              className={INPUT} placeholder="50" />
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
          <input value={f.supervisor_name} onChange={e => setF(p => ({ ...p, supervisor_name: e.target.value }))}
            className={INPUT} placeholder="Имя супервизора" />
        </Field>
        <Field label="Тема (обезличенно)">
          <input value={f.topic} onChange={e => setF(p => ({ ...p, topic: e.target.value }))}
            className={INPUT} placeholder="Работа с тревогой у клиента" />
        </Field>
        <Field label="Основные выводы">
          <textarea value={f.main_insights} onChange={e => setF(p => ({ ...p, main_insights: e.target.value }))}
            className={`${INPUT} resize-none`} rows={3} placeholder="Что важного выявлено..." />
        </Field>
        <button onClick={save} disabled={saving}
          className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
          style={{ background: "#3a5ff8", color: "#fff" }}>
          {saving ? "Сохраняю..." : "Сохранить"}
        </button>
      </div>
    </Modal>
  );
}

function GoalForm({ onClose, onSaved, onToast }: {
  onClose: () => void; onSaved: () => void; onToast: (m: string, t?: "ok"|"err") => void;
}) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ title: "", description: "", motivation: "", status: "planned", target_date: "" });

  async function save() {
    if (!f.title.trim()) { onToast("Укажите название цели", "err"); return; }
    setSaving(true);
    try {
      await apiFetch("/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      onSaved();
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : "Ошибка", "err");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Добавить цель" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Название *">
          <input value={f.title} onChange={e => setF(p => ({ ...p, title: e.target.value }))}
            className={INPUT} placeholder="Пройти обучение по схема-терапии" />
        </Field>
        <Field label="Описание">
          <textarea value={f.description} onChange={e => setF(p => ({ ...p, description: e.target.value }))}
            className={`${INPUT} resize-none`} rows={2} placeholder="Что именно планирую сделать..." />
        </Field>
        <Field label="Мотивация">
          <input value={f.motivation} onChange={e => setF(p => ({ ...p, motivation: e.target.value }))}
            className={INPUT} placeholder="Зачем это важно..." />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Статус">
            <select value={f.status} onChange={e => setF(p => ({ ...p, status: e.target.value }))} className={INPUT}>
              <option value="planned">Запланировано</option>
              <option value="in_progress">В работе</option>
            </select>
          </Field>
          <Field label="Срок">
            <input type="date" value={f.target_date} onChange={e => setF(p => ({ ...p, target_date: e.target.value }))} className={INPUT} />
          </Field>
        </div>
        <button onClick={save} disabled={saving}
          className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
          style={{ background: "#3a5ff8", color: "#fff" }}>
          {saving ? "Сохраняю..." : "Сохранить"}
        </button>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED UI PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════════

const INPUT = "w-full rounded-xl border px-3 py-2 text-sm outline-none bg-[#F3EBDD] border-[#CFC0A9] text-[#3D3228]";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/30 backdrop-blur-sm p-0 lg:p-4"
      onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl lg:rounded-2xl shadow-2xl"
        style={{ background: "#FBF8F5" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#E5E5E5" }}>
          <h2 className="font-semibold text-sm" style={{ color: "#3D3228" }}>{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ color: "#9C8E80" }}>
            <X size={16} />
          </button>
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
  return (
    <span className="text-xs px-2 py-0.5 rounded-lg font-medium"
      style={{ background: `${STATUS_COLORS[status] ?? "#6B7280"}18`, color: STATUS_COLORS[status] ?? "#6B7280" }}>
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
    <div className="rounded-xl px-3 py-2.5 flex items-center gap-3"
      style={{ background: "#F3EBDD", border: "1px solid #CFC0A9" }}>
      <BookOpen size={14} style={{ color: "#3a5ff8", flexShrink: 0 }} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate" style={{ color: "#3D3228" }}>{c.title}</div>
        {c.provider && <div className="text-xs" style={{ color: "#A8997F" }}>{c.provider}</div>}
      </div>
      <StatusBadge status={c.status} />
    </div>
  );
}

function SessionRow({ session: s }: { session: RawSession }) {
  return (
    <div className="rounded-xl px-3 py-2.5 flex items-center gap-3"
      style={{ background: "#F3EBDD", border: "1px solid #CFC0A9" }}>
      <Users size={14} style={{ color: "#7C3AED", flexShrink: 0 }} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium" style={{ color: "#3D3228" }}>
          {STATUS_LABELS[s.session_type] ?? s.session_type}
        </div>
        <div className="text-xs" style={{ color: "#A8997F" }}>
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
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: "#F3EBDD", border: "1px solid #CFC0A9" }}>
        <Icon size={24} style={{ color: "#9C8E80" }} />
      </div>
      <div className="text-sm font-semibold mb-1" style={{ color: "#3D3228" }}>{title}</div>
      <div className="text-sm max-w-xs" style={{ color: "#9C8E80" }}>{desc}</div>
      {action && (
        <button onClick={action.onClick}
          className="mt-5 flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "#3a5ff8", color: "#fff" }}>
          <Plus size={14} /> {action.label}
        </button>
      )}
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
      <div className="text-sm text-center" style={{ color: "#6B7280" }}>
        {msg.includes("401") || msg.includes("Unauthorized")
          ? "Для работы раздела установите переменную PROF_DEV_USER_ID в настройках Railway"
          : msg}
      </div>
    </div>
  );
}
