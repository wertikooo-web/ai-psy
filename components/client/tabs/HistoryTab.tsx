"use client";

import { useState } from "react";
import { Plus, Trash2, Bot, User } from "lucide-react";
import {
  HISTORY_SECTIONS_ORDER,
  HISTORY_SECTION_LABELS,
  type ClientHistoryItem,
  type HistorySection,
} from "@/lib/types";

interface Props {
  clientId: string;
  items: ClientHistoryItem[];
  isMock: boolean;
  onAdd?: (item: ClientHistoryItem) => void;
  onDelete?: (id: string) => void;
}

export function HistoryTab({ clientId, items, isMock, onAdd, onDelete }: Props) {
  const [addingSection, setAddingSection] = useState<HistorySection | null>(null);
  const [draftText, setDraftText]         = useState("");
  const [saving, setSaving]               = useState(false);
  const [deletingId, setDeletingId]       = useState<string | null>(null);

  const bySection = (section: HistorySection) => items.filter((i) => i.section === section);

  async function handleAdd(section: HistorySection) {
    const text = draftText.trim();
    if (!text) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/client-history/${clientId}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ section, text, source: "manual" }),
      });
      if (res.ok) {
        const item = await res.json();
        onAdd?.(item);
        setDraftText("");
        setAddingSection(null);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить запись?")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/client-history/${clientId}/${id}`, { method: "DELETE" });
      onDelete?.(id);
    } finally {
      setDeletingId(null);
    }
  }

  const totalItems = items.length;

  return (
    <div className="space-y-4">
      {totalItems === 0 && !isMock && (
        <p className="text-sm text-slate-400 text-center py-6">
          История клиента пуста. Добавьте первую запись вручную или она появится после AI-анализа консультации.
        </p>
      )}

      {HISTORY_SECTIONS_ORDER.map((section) => {
        const sectionItems = bySection(section);
        const isAdding     = addingSection === section;

        return (
          <div key={section} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            {/* Section header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-700">
                  {HISTORY_SECTION_LABELS[section]}
                </h3>
                {sectionItems.length > 0 && (
                  <span className="text-xs text-slate-400 bg-slate-50 rounded-full px-2 py-0.5">
                    {sectionItems.length}
                  </span>
                )}
              </div>
              {!isMock && (
                <button
                  onClick={() => {
                    setAddingSection(isAdding ? null : section);
                    setDraftText("");
                  }}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-brand-500 transition-colors px-2 py-1 rounded-lg hover:bg-brand-50"
                >
                  <Plus size={12} />
                  Добавить
                </button>
              )}
            </div>

            {/* Items */}
            <div className="divide-y divide-slate-50">
              {sectionItems.map((item) => (
                <div key={item.id} className="flex items-start gap-3 px-5 py-3 group">
                  <SourceBadge source={item.source} />
                  <p className="flex-1 text-sm text-slate-700 leading-relaxed">{item.text}</p>
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!isMock && (
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="p-1 text-slate-300 hover:text-rose-400 rounded-md transition-colors"
                        title="Удалить"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {sectionItems.length === 0 && !isAdding && (
                <p className="px-5 py-3 text-xs text-slate-300 italic">Нет записей</p>
              )}
            </div>

            {/* Inline add form */}
            {isAdding && (
              <div className="px-5 py-3 bg-slate-50/60 border-t border-slate-100">
                <textarea
                  autoFocus
                  rows={2}
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  placeholder="Введите наблюдение или заметку..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50 transition-all resize-none bg-white"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAdd(section);
                    if (e.key === "Escape") { setAddingSection(null); setDraftText(""); }
                  }}
                />
                <div className="flex items-center justify-end gap-2 mt-2">
                  <button
                    onClick={() => { setAddingSection(null); setDraftText(""); }}
                    className="text-xs text-slate-400 hover:text-slate-600 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={() => handleAdd(section)}
                    disabled={saving || !draftText.trim()}
                    className="text-xs bg-brand-500 hover:bg-brand-600 disabled:bg-slate-200 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                  >
                    {saving ? "Сохраняю..." : "Сохранить"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SourceBadge({ source }: { source: "ai" | "manual" }) {
  if (source === "ai") {
    return (
      <span
        title="Добавлено AI на основе транскрипта"
        className="mt-0.5 flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-violet-50 text-violet-500 border border-violet-100"
      >
        <Bot size={10} />
      </span>
    );
  }
  return (
    <span
      title="Добавлено психологом вручную"
      className="mt-0.5 flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-50 text-slate-400 border border-slate-100"
    >
      <User size={10} />
    </span>
  );
}
