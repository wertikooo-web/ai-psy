"use client";

import { useState } from "react";
import { Upload, ChevronDown, ChevronUp, Trash2, FileText } from "lucide-react";
import { ImportMaterialModal } from "@/components/client/ImportMaterialModal";
import { MATERIAL_TYPE_LABELS, type ClientMaterial } from "@/lib/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

interface Props {
  clientId: string;
  materials: ClientMaterial[];
  onAdd: (m: ClientMaterial) => void;
  onDelete?: (id: string) => void;
  isMock?: boolean;
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
      <div className="space-y-4">
        {/* Header action */}
        <div className="flex justify-end">
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
          >
            <Upload size={14} />
            Импортировать материалы
          </button>
        </div>

        {materials.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 py-12 text-center">
            <FileText size={28} className="mx-auto text-slate-200 mb-3" />
            <p className="text-sm text-slate-500 font-medium mb-1">Материалов пока нет</p>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Импортируйте заметки, старые анализы, транскрипты или историю клиента из других систем
            </p>
          </div>
        )}

        <div className="space-y-2">
          {materials.map((m) => {
            const isOpen    = expanded === m.id;
            const preview   = m.content.slice(0, 180);
            const hasMore   = m.content.length > 180;

            return (
              <div key={m.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                {/* Material header */}
                <div className="flex items-center gap-3 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-800">{m.title || MATERIAL_TYPE_LABELS[m.type]}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-100 flex-shrink-0">
                        {MATERIAL_TYPE_LABELS[m.type]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDate(m.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!isMock && (
                      <button
                        onClick={() => handleDelete(m.id)}
                        disabled={deletingId === m.id}
                        className="p-1.5 text-slate-200 hover:text-rose-400 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Удалить"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Content preview */}
                <div className="px-5 pb-4 border-t border-slate-50">
                  <p className="text-sm text-slate-600 leading-relaxed mt-3 whitespace-pre-wrap">
                    {isOpen ? m.content : preview}
                    {!isOpen && hasMore && (
                      <span className="text-slate-300">…</span>
                    )}
                  </p>
                  {hasMore && (
                    <button
                      onClick={() => setExpanded(isOpen ? null : m.id)}
                      className="mt-2 flex items-center gap-1 text-xs text-brand-500 hover:text-brand-600 font-medium transition-colors"
                    >
                      {isOpen ? (
                        <><ChevronUp size={12} /> Свернуть</>
                      ) : (
                        <><ChevronDown size={12} /> Показать полностью</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
