"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { consultations as mockConsultations } from "@/lib/mockData";
import type { StoredConsultation } from "@/lib/consultationStore";
import { Avatar } from "@/components/ui/Avatar";
import { UploadModal } from "@/components/upload/UploadModal";
import {
  Mic, ArrowRight, ArrowLeft, CheckCircle2, Clock, AlertCircle, ChevronDown, Trash2,
  ChevronRight, Search,
} from "lucide-react";
import { CalendarButtons } from "@/components/ui/CalendarButtons";

type SortOption  = "date_desc" | "date_asc" | "client";
type GroupOption = "none" | "month" | "client" | "status";

const PAGE_SIZE = 5;
const CARD_BG   = "#F4F0E8";
const TAB_BG    = "#C9BBAA";
const TAB_HOV   = "#BEB09E";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

type AnyConsultation = StoredConsultation & {
  isMock?: boolean; topic?: string; sessionNumber?: number;
  duration?: string; summary?: string;
};

function Badge({ label, state }: { label: string; state: "ok" | "warn" | "none" }) {
  const styles = {
    ok:   "bg-emerald-50 text-emerald-600 border border-emerald-100",
    warn: "bg-amber-50 text-amber-600 border border-amber-100",
    none: "bg-stone-100 text-stone-400 border border-stone-200",
  }[state];
  const Icon = state === "ok" ? CheckCircle2 : state === "warn" ? AlertCircle : Clock;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles}`}>
      <Icon size={10} />
      {label}
    </span>
  );
}

// ── Confirm modal ─────────────────────────────────────────────────────────────
function DeleteModal({
  title, onConfirm, onCancel, loading,
}: { title: string; onConfirm: () => void; onCancel: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.35)" }}>
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
        <h2 className="text-base font-bold text-slate-800 mb-2">Удалить консультацию?</h2>
        <p className="text-sm text-slate-500 leading-relaxed mb-5">
          Будут удалены запись консультации, транскрипт, анализ и связанные материалы
          <span className="font-medium text-slate-700"> «{title}»</span>.
          Это действие нельзя отменить.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-40"
          >
            {loading ? "Удаление..." : "Удалить"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
function ConsultationCard({
  c, num, onOpen, onDeleteClick,
}: {
  c: AnyConsultation;
  num: number;
  onOpen: () => void;
  onDeleteClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [delHovered, setDelHovered] = useState(false);

  const title         = c.title || c.topic || `Консультация #${num}`;
  const showTopic     = title !== `Консультация #${num}`;
  const hasTranscript = !!(c as StoredConsultation).transcript?.text || c.isMock;
  const hasAnalysis   = !!((c as StoredConsultation).analyses?.length) || c.isMock;

  return (
    <div
      className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow flex flex-col"
      style={{ background: CARD_BG, borderColor: "#DDD4C6" }}
    >
      {/* ── Body ── */}
      <div className="px-4 sm:px-5 pt-4 pb-3">

        {/* Mobile layout */}
        <div className="flex sm:hidden items-start gap-3 mb-2">
          <Avatar initials={c.clientInitials} color={c.clientColor} size="sm" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-slate-700 truncate block">{c.clientName}</span>
            <span className="font-semibold text-slate-800 text-sm">Консультация #{num}</span>
            {showTopic && <p className="text-xs text-stone-400 line-clamp-1">{title}</p>}
            <p className="text-xs text-stone-400">{formatDate(c.createdAt)}</p>
          </div>
          {/* Delete — mobile */}
          {!c.isMock && (
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteClick(); }}
              title="Удалить консультацию"
              className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
              style={{
                background: delHovered ? "#FECACA" : "#FEE2E2",
                color: "#DC2626",
              }}
              onMouseEnter={() => setDelHovered(true)}
              onMouseLeave={() => setDelHovered(false)}
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>

        {/* Desktop layout */}
        <div className="hidden sm:flex items-start gap-4">
          <Avatar initials={c.clientInitials} color={c.clientColor} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-semibold text-slate-800">Консультация #{num}</span>
              {c.duration && (
                <span className="text-xs text-stone-400 flex items-center gap-0.5">
                  <Clock size={10} />
                  {c.duration}
                </span>
              )}
            </div>
            <div className="text-sm text-stone-500 mt-0.5">
              {c.clientName}
              {showTopic && <span className="text-stone-400"> · {title}</span>}
            </div>
            {c.summary && (
              <p className="text-sm text-stone-400 line-clamp-2 mt-1 leading-relaxed">{c.summary}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-stone-400 pt-0.5">{formatDate(c.createdAt)}</span>
            {/* Delete — desktop */}
            {!c.isMock && (
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteClick(); }}
                title="Удалить консультацию"
                className="w-7 h-7 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
                style={{
                  background: delHovered ? "#FECACA" : "#FEE2E2",
                  color: "#DC2626",
                }}
                onMouseEnter={() => setDelHovered(true)}
                onMouseLeave={() => setDelHovered(false)}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status badges + calendar */}
      <div className="px-4 sm:px-5 pb-4 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex flex-wrap gap-1.5">
          <Badge label={hasTranscript ? "Транскрипт готов" : "Транскрипт не создан"} state={hasTranscript ? "ok" : "none"} />
          <Badge label={hasAnalysis   ? "Анализ готов"     : "Анализ не готов"}      state={hasAnalysis   ? "ok" : "none"} />
        </div>
        <CalendarButtons
          clientName={c.clientName ?? ""}
          date={c.createdAt}
          duration={c.duration}
          topic={c.topic ?? c.title ?? ""}
          session={num}
          compact
        />
      </div>

      {/* CTA */}
      <button
        onClick={onOpen}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="w-full flex items-center justify-between px-4 sm:px-5 py-2.5 text-sm font-medium rounded-b-2xl"
        style={{
          background: hovered ? TAB_HOV : TAB_BG,
          color:      "#4A3F32",
          borderTop:  "1px solid #B8AC9A",
          boxShadow:  "inset 0 1px 0 rgba(255,255,255,0.22)",
          transition: "background 0.15s ease",
        }}
      >
        <span>Открыть консультацию</span>
        <ArrowRight
          size={20}
          strokeWidth={2.5}
          className="text-stone-500 transition-transform duration-150"
          style={{ transform: hovered ? "translateX(4px)" : "translateX(0)" }}
        />
      </button>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getStatusLabel(c: AnyConsultation): string {
  const hasTranscript = !!(c as StoredConsultation).transcript?.text || c.isMock;
  const hasAnalysis   = !!((c as StoredConsultation).analyses?.length) || c.isMock;
  if (hasAnalysis)   return "Анализ готов";
  if (hasTranscript) return "Транскрипт готов";
  return "Без обработки";
}

function getMonthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ConsultationsPage() {
  const router = useRouter();
  const [uploadOpen, setUploadOpen]       = useState(false);
  const [consultations, setConsultations] = useState<AnyConsultation[]>([]);
  const [loading, setLoading]             = useState(true);
  const [sort,  setSort]                  = useState<SortOption>("date_desc");
  const [group, setGroup]                 = useState<GroupOption>("none");
  const [visibleCount, setVisibleCount]   = useState(PAGE_SIZE);

  // Delete modal state
  const [deleteTarget, setDeleteTarget]   = useState<AnyConsultation | null>(null);
  const [deleting, setDeleting]           = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch("/api/consultations");
        const real: StoredConsultation[] = res.ok ? await res.json() : [];
        const realIds = new Set(real.map((c) => c.id));
        const mock = mockConsultations
          .filter((m) => !realIds.has(m.id))
          .map((m) => ({
            id:             m.id,
            clientId:       m.clientId,
            clientName:     m.clientName,
            clientInitials: m.clientInitials,
            clientColor:    m.clientColor,
            title:          m.topic,
            createdAt:      m.date,
            source:         "audio" as const,
            status:         "done"  as const,
            topic:          m.topic,
            sessionNumber:  m.sessionNumber,
            duration:       m.duration,
            summary:        m.summary,
            isMock:         true,
          } as AnyConsultation));
        setConsultations([...real, ...mock]);
      } catch {
        setConsultations([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Reset visible count when sort/group changes
  const handleSort = useCallback((v: SortOption) => {
    setSort(v);
    setVisibleCount(PAGE_SIZE);
  }, []);

  const handleGroup = useCallback((v: GroupOption) => {
    setGroup(v);
    setVisibleCount(PAGE_SIZE);
  }, []);

  const total = consultations.length;

  const sorted = useMemo(() => {
    const arr = [...consultations];
    if (sort === "date_desc") arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (sort === "date_asc")  arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    if (sort === "client")    arr.sort((a, b) => (a.clientName ?? "").localeCompare(b.clientName ?? "", "ru"));
    return arr;
  }, [consultations, sort]);

  // Slice first, then group — so pagination applies to final sorted list
  const visible = sorted.slice(0, visibleCount);

  const grouped = useMemo((): { label: string; items: AnyConsultation[] }[] => {
    if (group === "none") return [{ label: "", items: visible }];
    const map = new Map<string, AnyConsultation[]>();
    for (const c of visible) {
      const key =
        group === "month"  ? getMonthLabel(c.createdAt) :
        group === "client" ? (c.clientName ?? "Без клиента") :
        getStatusLabel(c);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
  }, [visible, group]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`/api/consultations/${deleteTarget.id}`, { method: "DELETE" });
      setConsultations(prev => prev.filter(c => c.id !== deleteTarget.id));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const mobileSorted = [...consultations].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden" style={{ background: "inherit" }}>

      {/* ── Mobile layout ────────────────────────────────────────── */}
      <div className="lg:hidden flex-1 min-h-0 overflow-y-auto" style={{ background: "#FBF8F5" }}>

        {/* Sticky header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b" style={{ background: "#FBF8F5", borderColor: "#CFC0A9" }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#3D3228" }}>Консультации</span>
          <button onClick={() => setUploadOpen(true)} style={{ display: "flex", alignItems: "center", gap: 5, background: "#3a5ff8", border: "none", borderRadius: 8, padding: "6px 12px", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            <Mic size={13} /> Загрузить
          </button>
        </div>

        {/* Card list */}
        <div style={{ padding: "10px 16px 80px", display: "flex", flexDirection: "column", gap: 8 }}>
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} style={{ height: 72, borderRadius: 14, background: "#F3EBDD", border: "1px solid #CFC0A9", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))
          ) : mobileSorted.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "56px 24px", gap: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: 18, background: "#F3EBDD", border: "1px solid #CFC0A9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Mic size={24} style={{ color: "#C9BBAA" }} />
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#3D3228", marginBottom: 4 }}>Консультаций пока нет</div>
                <div style={{ fontSize: 13, color: "#A8997F", lineHeight: 1.5 }}>Загрузите первую запись — и она появится здесь</div>
              </div>
              <button onClick={() => setUploadOpen(true)} style={{ marginTop: 4, background: "#3a5ff8", border: "none", borderRadius: 10, padding: "10px 20px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Загрузить запись
              </button>
            </div>
          ) : (
            mobileSorted.map((c) => {
              const hasAnalysis = !!((c as StoredConsultation).analyses?.length) || c.isMock;
              const label = c.title || c.topic || "Консультация";
              const dateStr = new Date(c.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
              return (
                <button key={c.id} onClick={() => router.push(`/consultation/${c.id}`)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "#F3EBDD", border: "1px solid #CFC0A9", borderRadius: 14, cursor: "pointer", textAlign: "left", width: "100%" }}>
                  <Avatar initials={c.clientInitials ?? "?"} color={c.clientColor ?? "#94a3b8"} size="md" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#3D3228", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.clientName}</div>
                    <div style={{ fontSize: 11, color: "#A8997F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{label}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: "#C9BBAA" }}>{dateStr}</div>
                    <div style={{ marginTop: 3 }}>
                      {hasAnalysis
                        ? <span style={{ fontSize: 10, color: "#16a34a", background: "#dcfce7", borderRadius: 99, padding: "2px 7px", fontWeight: 600 }}>анализ</span>
                        : <span style={{ fontSize: 10, color: "#d97706", background: "#fef3c7", borderRadius: 99, padding: "2px 7px", fontWeight: 600 }}>транскрипт</span>}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Desktop layout ────────────────────────────────────────── */}
      <div className="hidden lg:block flex-1 min-h-0 overflow-y-auto" style={{ background: "inherit" }}>
      <div
        className="px-8 max-w-3xl mx-auto"
        style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top, 0px) + 1rem)" }}
      >

        {/* Title row */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-sm transition-colors"
              style={{ color: "#A8997F" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#4A3C2E"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#A8997F"; }}
            >
              <ArrowLeft size={16} />
              Назад
            </button>
            <div className="w-px h-5" style={{ background: "#DDD4C6" }} />
            <h1 className="text-xl font-bold text-slate-800">Консультации</h1>
          </div>
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
          >
            <Mic size={15} />
            Загрузить запись
          </button>
        </div>

        {/* Sort + Group controls */}
        {!loading && consultations.length > 0 && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="relative">
              <select
                value={sort}
                onChange={(e) => handleSort(e.target.value as SortOption)}
                className="appearance-none pl-3 pr-7 py-1.5 rounded-lg border text-xs font-medium cursor-pointer focus:outline-none"
                style={{ background: "#F0EBE1", borderColor: "#D8CFBE", color: "#6B5D4F" }}
              >
                <option value="date_desc">Сначала новые</option>
                <option value="date_asc">Сначала старые</option>
                <option value="client">По клиенту</option>
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#A8997F" }} />
            </div>
            <div className="relative">
              <select
                value={group}
                onChange={(e) => handleGroup(e.target.value as GroupOption)}
                className="appearance-none pl-3 pr-7 py-1.5 rounded-lg border text-xs font-medium cursor-pointer focus:outline-none"
                style={{ background: "#F0EBE1", borderColor: "#D8CFBE", color: "#6B5D4F" }}
              >
                <option value="none">Без группировки</option>
                <option value="month">По месяцу</option>
                <option value="client">По клиенту</option>
                <option value="status">По статусу</option>
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#A8997F" }} />
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border h-28 animate-pulse" style={{ background: CARD_BG, borderColor: "#DDD4C6" }} />
            ))}
          </div>
        ) : consultations.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-4">
            <div className="flex items-center justify-center rounded-2xl" style={{ width: 64, height: 64, background: "#F3EBDD", border: "1px solid #CFC0A9" }}>
              <Mic size={28} style={{ color: "#C9BBAA" }} />
            </div>
            <div className="text-center">
              <div className="text-base font-semibold mb-1" style={{ color: "#3D3228" }}>Консультаций пока нет</div>
              <div className="text-sm" style={{ color: "#A8997F" }}>Загрузите первую запись — она появится здесь с транскриптом и анализом</div>
            </div>
            <button onClick={() => setUploadOpen(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: "#3a5ff8" }}>
              <Mic size={14} /> Загрузить запись
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-6">
              {grouped.map(({ label, items }) => (
                <div key={label || "_"}>
                  {label && (
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#A8997F" }}>{label}</span>
                      <div className="flex-1 h-px" style={{ background: "#E4DDD0" }} />
                    </div>
                  )}
                  <div className="space-y-3 sm:space-y-4">
                    {items.map((c) => (
                      <ConsultationCard
                        key={c.id}
                        c={c}
                        num={c.sessionNumber ?? (total - sorted.indexOf(c))}
                        onOpen={() => router.push(`/consultation/${c.id}`)}
                        onDeleteClick={() => setDeleteTarget(c)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer: status + load more */}
            <div className="mt-6 flex flex-col items-center gap-3">
              {visibleCount < sorted.length && (
                <button
                  onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                  className="px-6 py-2.5 rounded-xl text-sm font-medium border transition-colors"
                  style={{ background: "#F0EBE1", borderColor: "#D8CFBE", color: "#6B5D4F" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#E8E0D0"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#F0EBE1"; }}
                >
                  Показать ещё
                </button>
              )}
              <p className="text-xs text-stone-400">
                {visibleCount >= sorted.length
                  ? "Показаны все консультации"
                  : `Показано ${Math.min(visibleCount, sorted.length)} из ${sorted.length} консультаций`
                }
              </p>
            </div>
          </>
        )}
      </div>
      </div>{/* end desktop */}

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />

      {deleteTarget && (
        <DeleteModal
          title={deleteTarget.title || deleteTarget.topic || "консультацию"}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
    </div>
  );
}
