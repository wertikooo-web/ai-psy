"use client";

import { useState } from "react";
import { Upload, ChevronDown, ChevronUp, Trash2, FileText } from "lucide-react";
import { ImportMaterialModal } from "@/components/client/ImportMaterialModal";
import { MATERIAL_TYPE_LABELS, type ClientMaterial } from "@/lib/types";

// ── Craft palette ─────────────────────────────────────────────────────────────
const S = {
  bg:      "#EDE7DA",
  border:  "#D8CFBE",
  header:  "#E4DDD0",
  divider: "#DDD5C8",
  tag:     "#E4DDD0",
  tagBdr:  "#D0C8B8",
  title:   "#6B5D4F",
};

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
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Удалить материал?")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/client-materials/${clientId}/${id}`, { method: "DELETE" });
      onDelete?.(id);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <div className="space-y-3">
        {/* Upload button */}
        <div className="flex justify-end">
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
          >
            <Upload size={14} />
            Добавить материалы
          </button>
        </div>

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

        {materials.map((m) => {
          const isOpen  = expanded === m.id;
          const preview = m.content.slice(0, 180);
          const hasMore = m.content.length > 180;

          return (
            <div
              key={m.id}
              className="rounded-2xl border overflow-hidden"
              style={{ background: S.bg, borderColor: S.border }}
            >
              {/* Header */}
              <div
                className="flex items-center gap-3 px-5 py-4"
                style={{ background: S.header }}
              >
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
                  <button
                    onClick={() => handleDelete(m.id)}
                    disabled={deletingId === m.id}
                    title="Удалить материал"
                    className="flex items-center justify-center rounded-lg transition-colors flex-shrink-0 disabled:opacity-40"
                    style={{
                      width: 30, height: 30,
                      background: "#FFFFFF",
                      border: "1px solid #D8CFBE",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                      color: "#6B5D4F",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = "#EF4444"; e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.borderColor = "#FECACA"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "#6B5D4F"; e.currentTarget.style.background = "#FFFFFF"; e.currentTarget.style.borderColor = "#D8CFBE"; }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              {/* Content */}
              <div className="px-5 py-4" style={{ borderTop: `1px solid ${S.divider}` }}>
                <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
                  {isOpen ? m.content : preview}
                  {!isOpen && hasMore && <span style={{ color: S.tagBdr }}>…</span>}
                </p>
                {hasMore && (
                  <button
                    onClick={() => setExpanded(isOpen ? null : m.id)}
                    className="mt-2 flex items-center gap-1 text-xs text-brand-500 hover:text-brand-600 font-medium transition-colors"
                  >
                    {isOpen ? <><ChevronUp size={12} /> Свернуть</> : <><ChevronDown size={12} /> Показать полностью</>}
                  </button>
                )}
              </div>
            </div>
          );
        })}
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
