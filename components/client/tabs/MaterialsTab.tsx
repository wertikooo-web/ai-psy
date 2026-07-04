"use client";

import { useState, useRef, useEffect } from "react";
import {
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Trash2, FileText, Plus, Paperclip, Eye, Loader2, AlertCircle,
} from "lucide-react";
import { ImportMaterialModal } from "@/components/client/ImportMaterialModal";
import { MATERIAL_TYPE_LABELS, type ClientMaterial } from "@/lib/types";

// ── Craft palette ─────────────────────────────────────────────────────────────
const S = {
  bg:      "#FBF8F2",
  border:  "#D8CFBE",
  header:  "#E9DCC7",
  divider: "#EDE8DE",
  tag:     "#E9DCC7",
  tagBdr:  "#D0C8B8",
  title:   "#6B5D4F",
  muted:   "#A8997F",
};

const PAGE_SIZE = 5;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

function formatObsDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

interface Props {
  clientId:    string;
  materials:   ClientMaterial[];
  onAdd:       (m: ClientMaterial) => void;
  onDelete?:   (id: string) => void;
  isMock?:     boolean;
  highlightId?: string;
}

export function MaterialsTab({ clientId, materials, onAdd, onDelete, isMock, highlightId }: Props) {
  const [importOpen, setImportOpen] = useState(false);
  const [expanded,   setExpanded]   = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page,       setPage]       = useState(1);
  const [expandedObs, setExpandedObs] = useState<string | null>(null);

  // Level 1: section collapsed by default (false = collapsed)
  const [obsOpen,  setObsOpen]  = useState(false);
  const [matsOpen, setMatsOpen] = useState(false);

  const listRef    = useRef<HTMLDivElement>(null);
  const obsListRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  // Close material accordion on outside click
  useEffect(() => {
    if (!expanded) return;
    function onOutside(e: MouseEvent) {
      if (listRef.current && !listRef.current.contains(e.target as Node)) setExpanded(null);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [expanded]);

  // Close expanded observation on outside click
  useEffect(() => {
    if (!expandedObs) return;
    function onOutside(e: MouseEvent) {
      if (obsListRef.current && !obsListRef.current.contains(e.target as Node)) setExpandedObs(null);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [expandedObs]);

  // Auto-open and highlight the linked material on mount
  useEffect(() => {
    if (!highlightId || !materials.length) return;
    const target = materials.find((m) => m.id === highlightId);
    if (!target) return;
    if (target.type === "observation") {
      setObsOpen(true);
      setExpandedObs(highlightId);
    } else {
      setMatsOpen(true);
      setExpanded(highlightId);
    }
    // Scroll after a short delay to let the section open
    setTimeout(() => {
      highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId]);

  // Split: observations vs regular materials
  const observations = [...materials]
    .filter((m) => m.type === "observation")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const regularMaterials = materials.filter((m) => m.type !== "observation");

  const totalPages = Math.max(1, Math.ceil(regularMaterials.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = regularMaterials.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function goPage(p: number) {
    setPage(p);
    setExpanded(null);
  }

  async function handleDeleteMaterial(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await fetch(`/api/client-materials/${clientId}/${id}`, { method: "DELETE" });
      onDelete?.(id);
      if (paginated.length === 1 && safePage > 1) goPage(safePage - 1);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDeleteObs(id: string) {
    if (!confirm("Удалить это наблюдение?")) return;
    await fetch(`/api/client-materials/${clientId}/${id}`, { method: "DELETE" });
    onDelete?.(id);
  }

  return (
    <>
      <div className="space-y-3">

        {/* ══════════ Observations section ══════════ */}
        <div
          className="flex items-start gap-2 rounded-xl px-4 py-3 text-xs"
          style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#1E40AF" }}
        >
          <Eye size={13} className="flex-shrink-0 mt-0.5" />
          <span>
            Наблюдения <strong>автоматически включаются</strong> в контекст следующего AI‑анализа этого клиента.
          </span>
        </div>

        <div className="rounded-2xl border overflow-hidden" style={{ background: S.bg, borderColor: S.border }}>
          {/* ── Level 1: Observations header — click to toggle ── */}
          <div
            className="flex items-center justify-between px-5 border-b cursor-pointer select-none"
            style={{
              background: S.header,
              borderColor: obsOpen ? S.divider : "transparent",
              minHeight: 44,
            }}
            onClick={() => setObsOpen((v) => !v)}
          >
            <div className="flex items-center gap-2.5 py-3.5">
              {/* Rotating arrow */}
              <span
                style={{
                  color: S.title,
                  display: "inline-flex",
                  transition: "transform 150ms ease",
                  transform: obsOpen ? "rotate(0deg)" : "rotate(-90deg)",
                }}
              >
                <ChevronDown size={14} />
              </span>
              <h3 className="text-sm font-semibold" style={{ color: S.title }}>Наблюдения</h3>
              {observations.length > 0 && (
                <span
                  className="text-xs rounded-full px-2 py-0.5 font-medium"
                  style={{ background: "#E4D9C8", color: "#9C8E80" }}
                >
                  {observations.length}
                </span>
              )}
            </div>
            {!isMock && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Auto-open section when adding
                  if (!obsOpen) setObsOpen(true);
                  window.dispatchEvent(new CustomEvent("open-observation-modal"));
                }}
                className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors flex-shrink-0"
                style={{ background: "#D4C5B1", color: "#4A3C2E" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#C9BBAA")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#D4C5B1")}
              >
                <Plus size={11} />
                Добавить
              </button>
            )}
          </div>

          {/* ── Level 1: Observation items — visible only when open ── */}
          {obsOpen && (
            <div ref={obsListRef}>
              {observations.length === 0 && (
                <p className="px-5 py-3.5 text-xs italic" style={{ color: "#C9BBAA" }}>Нет наблюдений</p>
              )}
              {observations.map((obs, i) => {
                const isTranscribing = obs.status === "transcribing";
                const isError        = obs.status === "error";
                const isOpen         = expandedObs === obs.id;
                const preview        = obs.content.trim().slice(0, 150);
                const hasMore        = obs.content.trim().length > 150;

                return (
                  <div
                    key={obs.id}
                    ref={obs.id === highlightId ? highlightRef : undefined}
                    className="flex cursor-pointer items-start gap-3 px-5 py-3.5 transition-colors hover:bg-white/55"
                    style={{
                      borderTop: i > 0 ? `1px solid ${S.divider}` : undefined,
                      background: obs.id === highlightId ? "rgba(58,95,248,0.06)" : undefined,
                    }}
                    onClick={() => {
                      if (!isTranscribing && !isError) setExpandedObs(isOpen ? null : obs.id);
                    }}
                  >
                    <span
                      className="mt-0.5 flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full"
                      style={{ background: "#DBEAFE", border: "1px solid #BFDBFE", color: "#1E40AF" }}
                    >
                      <Eye size={10} />
                    </span>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs mb-1" style={{ color: S.muted }}>{formatObsDate(obs.createdAt)}</p>

                      {isTranscribing && (
                        <div className="flex items-center gap-2">
                          <Loader2 size={12} className="animate-spin flex-shrink-0" style={{ color: S.muted }} />
                          <span className="text-sm italic" style={{ color: S.muted }}>Расшифровывается…</span>
                        </div>
                      )}
                      {isError && (
                        <div className="flex items-center gap-2">
                          <AlertCircle size={12} className="flex-shrink-0 text-rose-400" />
                          <span className="text-sm" style={{ color: "#be123c" }}>
                            {obs.content || "Ошибка транскрипции. Аудио сохранено."}
                          </span>
                        </div>
                      )}
                      {!isTranscribing && !isError && (
                        <>
                          <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
                            {isOpen ? obs.content : preview}
                            {!isOpen && hasMore && <span style={{ color: S.muted }}>...</span>}
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedObs(isOpen ? null : obs.id);
                            }}
                            className="mt-1.5 flex items-center gap-1 text-xs font-medium transition-colors"
                            style={{ color: S.muted }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = S.title; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = S.muted; }}
                          >
                            {isOpen
                              ? <><ChevronUp size={11} /> Свернуть</>
                              : <><ChevronDown size={11} /> Развернуть</>}
                          </button>
                        </>
                      )}
                    </div>

                    {!isMock && !isTranscribing && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteObs(obs.id);
                        }}
                        className="flex-shrink-0 flex items-center justify-center rounded-lg transition-colors"
                        style={{ width: 26, height: 26, background: "#FEF2F2", border: "1px solid #FECACA", color: "#EF4444" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.borderColor = "#FCA5A5"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "#FEF2F2"; e.currentTarget.style.borderColor = "#FECACA"; }}
                        title="Удалить наблюдение"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ══════════ Materials section ══════════ */}
        <div
          className="flex items-start gap-2 rounded-xl px-4 py-3 text-xs"
          style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#1E40AF" }}
        >
          <Paperclip size={13} className="flex-shrink-0 mt-0.5" />
          <span>
            Материалы <strong>автоматически включаются</strong> в контекст следующего AI‑анализа этого клиента.
          </span>
        </div>

        {/* ── Level 1: Materials section header — click to toggle ── */}
        <div className="rounded-2xl border overflow-hidden" style={{ background: S.bg, borderColor: S.border }}>
          <div
            className="flex items-center justify-between gap-3 px-5 cursor-pointer select-none"
            style={{
              background: S.header,
              minHeight: 44,
            }}
            onClick={() => setMatsOpen((v) => !v)}
          >
            <div className="flex items-center gap-2.5 py-3">
              {/* Rotating arrow */}
              <span
                style={{
                  color: "#9C8E80",
                  display: "inline-flex",
                  transition: "transform 150ms ease",
                  transform: matsOpen ? "rotate(0deg)" : "rotate(-90deg)",
                }}
              >
                <ChevronDown size={14} />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#9C8E80" }}>
                Материалы · {regularMaterials.length}
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Auto-open section when adding
                if (!matsOpen) setMatsOpen(true);
                setImportOpen(true);
              }}
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors flex-shrink-0"
              style={{ background: "#D4C5B1", color: "#4A3C2E" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#C9BBAA")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#D4C5B1")}
            >
              <Plus size={11} />
              Добавить
            </button>
          </div>
        </div>

        {/* ── Level 1: Materials body — visible only when open ── */}
        {matsOpen && (
          <>
            {/* Empty state */}
            {regularMaterials.length === 0 && (
              <div
                className="rounded-2xl border py-12 text-center"
                style={{ background: S.bg, borderColor: S.border }}
              >
                <FileText size={28} className="mx-auto mb-3" style={{ color: S.tagBdr }} />
                <p className="text-sm font-medium" style={{ color: S.title }}>Материалов пока нет</p>
                <p className="text-xs text-stone-400 max-w-xs mx-auto mt-1">
                  Импортируйте заметки, старые анализы, транскрипты или историю клиента из других систем
                </p>
              </div>
            )}

            {/* Accordion list */}
            <div ref={listRef}>
              {paginated.map((m) => {
                const isOpen = expanded === m.id;

                return (
                  <div
                    key={m.id}
                    ref={m.id === highlightId ? highlightRef : undefined}
                    className="rounded-2xl border overflow-hidden"
                    style={{
                      background: "#FFFFFF",
                      borderColor: m.id === highlightId ? "#3a5ff8" : S.border,
                      boxShadow: m.id === highlightId ? "0 0 0 2px rgba(58,95,248,0.18)" : undefined,
                    }}
                  >
                    {/* Clickable header row */}
                    <button
                      className="w-full flex items-center gap-3 px-5 py-4 text-left transition-colors"
                      style={{ background: isOpen ? S.header : "#FFFFFF" }}
                      onClick={() => setExpanded(isOpen ? null : m.id)}
                    >
                      <div className="flex-shrink-0" style={{ color: S.title }}>
                        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold" style={{ color: S.title }}>
                            {m.title || MATERIAL_TYPE_LABELS[m.type]}
                          </span>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: S.tag, border: `1px solid ${S.tagBdr}`, color: "#7A6E63" }}
                          >
                            {MATERIAL_TYPE_LABELS[m.type]}
                          </span>
                        </div>
                        <p className="text-xs text-stone-400 mt-0.5">{formatDate(m.createdAt)}</p>
                      </div>

                      {!isMock && (
                        <div
                          onClick={(e) => handleDeleteMaterial(m.id, e)}
                          role="button"
                          title="Удалить материал"
                          className="flex items-center justify-center rounded-lg transition-colors flex-shrink-0 cursor-pointer"
                          style={{
                            width: 28, height: 28,
                            background: "#FEF2F2",
                            border: "1px solid #FECACA",
                            color: deletingId === m.id ? "#9CA3AF" : "#EF4444",
                            opacity: deletingId === m.id ? 0.5 : 1,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.borderColor = "#FCA5A5"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "#FEF2F2"; e.currentTarget.style.borderColor = "#FECACA"; }}
                        >
                          <Trash2 size={12} />
                        </div>
                      )}
                    </button>

                    {/* Expanded content */}
                    {isOpen && (
                      <div className="px-5 py-4" style={{ borderTop: `1px solid ${S.divider}`, background: S.bg }}>
                        <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
                          {m.content}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 pt-1">
                <button
                  onClick={() => goPage(safePage - 1)}
                  disabled={safePage === 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30"
                  style={{ color: S.title }}
                  onMouseEnter={(e) => { if (safePage > 1) e.currentTarget.style.background = S.header; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <ChevronLeft size={14} />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => goPage(p)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition-colors"
                    style={{
                      background: p === safePage ? "#6B5D4F" : "transparent",
                      color:      p === safePage ? "#fff"    : S.title,
                      border:     p === safePage ? "none"    : `1px solid ${S.border}`,
                    }}
                  >
                    {p}
                  </button>
                ))}

                <button
                  onClick={() => goPage(safePage + 1)}
                  disabled={safePage === totalPages}
                  className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30"
                  style={{ color: S.title }}
                  onMouseEnter={(e) => { if (safePage < totalPages) e.currentTarget.style.background = S.header; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <ImportMaterialModal
        open={importOpen}
        clientId={clientId}
        onClose={() => setImportOpen(false)}
        onImported={(m) => { onAdd(m); setImportOpen(false); }}
      />
    </>
  );
}
