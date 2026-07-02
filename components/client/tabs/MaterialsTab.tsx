"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Trash2, FileText, Plus, Paperclip } from "lucide-react";
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
};

const PAGE_SIZE = 5;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

interface Props {
  clientId:  string;
  materials: ClientMaterial[];
  onAdd:     (m: ClientMaterial) => void;
  onDelete?: (id: string) => void;
  isMock?:   boolean;
}

export function MaterialsTab({ clientId, materials, onAdd, onDelete, isMock }: Props) {
  const [importOpen, setImportOpen] = useState(false);
  const [expanded,   setExpanded]   = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page,       setPage]       = useState(1);

  const totalPages = Math.max(1, Math.ceil(materials.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = materials.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset expanded when page changes
  function goPage(p: number) {
    setPage(p);
    setExpanded(null);
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await fetch(`/api/client-materials/${clientId}/${id}`, { method: "DELETE" });
      onDelete?.(id);
      // If deleting last item on page, go to prev page
      if (paginated.length === 1 && safePage > 1) goPage(safePage - 1);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <div className="space-y-3">

        {/* Info banner — same style as ObservationsTab */}
        <div
          className="flex items-start gap-2 rounded-xl px-4 py-3 text-xs"
          style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#1E40AF" }}
        >
          <Paperclip size={13} className="flex-shrink-0 mt-0.5" />
          <span>
            Материалы <strong>автоматически включаются</strong> в контекст следующего AI‑анализа этого клиента.
          </span>
        </div>

        {/* Header bar */}
        <div className="rounded-2xl border overflow-hidden" style={{ background: S.bg, borderColor: S.border }}>
          <div className="flex items-center justify-between gap-3 px-5 py-3" style={{ background: S.header }}>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#9C8E80" }}>
              Материалы · {materials.length}
            </span>
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors flex-shrink-0"
              style={{ background: "#D4C5B1", color: "#4A3C2E" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#C9BBAA")}
              onMouseLeave={e => (e.currentTarget.style.background = "#D4C5B1")}
            >
              <Plus size={11} />
              Добавить
            </button>
          </div>
        </div>

        {/* Empty state */}
        {materials.length === 0 && (
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
        {paginated.map((m) => {
          const isOpen = expanded === m.id;

          return (
            <div
              key={m.id}
              className="rounded-2xl border overflow-hidden"
              style={{ background: "#FFFFFF", borderColor: S.border }}
            >
              {/* Clickable header row */}
              <button
                className="w-full flex items-center gap-3 px-5 py-4 text-left transition-colors"
                style={{ background: isOpen ? S.header : "#FFFFFF" }}
                onClick={() => setExpanded(isOpen ? null : m.id)}
              >
                {/* Chevron */}
                <div className="flex-shrink-0" style={{ color: S.title }}>
                  {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>

                {/* Title + tag */}
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

                {/* Delete button */}
                {!isMock && (
                  <div
                    onClick={(e) => handleDelete(m.id, e)}
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
                    onMouseEnter={e => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.borderColor = "#FCA5A5"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "#FEF2F2"; e.currentTarget.style.borderColor = "#FECACA"; }}
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 pt-1">
            <button
              onClick={() => goPage(safePage - 1)}
              disabled={safePage === 1}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30"
              style={{ color: S.title }}
              onMouseEnter={e => { if (safePage > 1) e.currentTarget.style.background = S.header; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              <ChevronLeft size={14} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => goPage(p)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition-colors"
                style={{
                  background:  p === safePage ? "#6B5D4F" : "transparent",
                  color:       p === safePage ? "#fff"    : S.title,
                  border:      p === safePage ? "none"    : `1px solid ${S.border}`,
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
              onMouseEnter={e => { if (safePage < totalPages) e.currentTarget.style.background = S.header; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
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
