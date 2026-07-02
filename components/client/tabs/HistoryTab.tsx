"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2, Bot, User } from "lucide-react";
import {
  HISTORY_SECTIONS_ORDER,
  HISTORY_SECTION_LABELS,
  type ClientHistoryItem,
  type HistorySection,
} from "@/lib/types";

// ── Craft palette ─────────────────────────────────────────────────────────────
const S = {
  bg:       "#FBF8F2",
  border:   "#D8CFBE",
  header:   "#E9DCC7",
  divider:  "#EDE8DE",
  addArea:  "#F5F0E6",
  title:    "#6B5D4F",
  count:    "#E4D9C8",
  countTxt: "#9C8E80",
};

interface Props {
  clientId: string;
  items:    ClientHistoryItem[];
  isMock:   boolean;
  onAdd?:   (item: ClientHistoryItem) => void;
  onDelete?: (id: string) => void;
}

export function HistoryTab({ clientId, items, isMock, onAdd, onDelete }: Props) {
  const [addingSection, setAddingSection] = useState<HistorySection | null>(null);
  const [draftText, setDraftText]         = useState("");
  const [saving, setSaving]               = useState(false);
  const [deletingId, setDeletingId]       = useState<string | null>(null);
  const [expandedItem, setExpandedItem]   = useState<string | null>(null);

  const bySection = (section: HistorySection) => items.filter((i) => i.section === section);

  useEffect(() => {
    if (!expandedItem) return;
    function onOutside(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("[data-history-entry]")) setExpandedItem(null);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [expandedItem]);

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

  return (
    <div className="space-y-3">
      {items.length === 0 && !isMock && (
        <p className="text-sm text-stone-400 text-center py-6">
          История клиента пуста. Добавьте первую запись вручную или она появится после AI-анализа консультации.
        </p>
      )}

      {HISTORY_SECTIONS_ORDER.map((section) => {
        const sectionItems = bySection(section);
        const isAdding     = addingSection === section;

        return (
          <div
            key={section}
            className="rounded-2xl border overflow-hidden"
            style={{ background: S.bg, borderColor: S.border }}
          >
            {/* Section header */}
            <div
              className="flex items-center justify-between px-5 py-3.5 border-b"
              style={{ background: S.header, borderColor: S.divider }}
            >
              <div className="flex items-center gap-2.5">
                <h3 className="text-sm font-semibold" style={{ color: S.title }}>
                  {HISTORY_SECTION_LABELS[section]}
                </h3>
                {sectionItems.length > 0 && (
                  <span
                    className="text-xs rounded-full px-2 py-0.5 font-medium"
                    style={{ background: S.count, color: S.countTxt }}
                  >
                    {sectionItems.length}
                  </span>
                )}
              </div>
              {!isMock && (
                <button
                  onClick={() => { setAddingSection(isAdding ? null : section); setDraftText(""); }}
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

            {/* Items */}
            <div>
              {sectionItems.map((item, i) => {
                const isOpen = expandedItem === item.id;
                const preview = item.text.trim().slice(0, 150);
                const hasMore = item.text.trim().length > 150;

                return (
                <div
                  key={item.id}
                  data-history-entry
                  className="flex cursor-pointer items-start gap-3 px-5 py-3.5 group transition-colors hover:bg-white/55"
                  style={{
                    borderTop: i > 0 ? `1px solid ${S.divider}` : undefined,
                  }}
                  onClick={() => setExpandedItem(isOpen ? null : item.id)}
                >
                  <SourceBadge source={item.source} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
                      {isOpen ? item.text : preview}
                      {!isOpen && hasMore && <span style={{ color: S.countTxt }}>...</span>}
                    </p>
                    <button
                      type="button"
                      className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium transition-colors"
                      style={{ color: S.countTxt }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedItem(isOpen ? null : item.id);
                      }}
                    >
                      {isOpen ? <><ChevronUp size={11} /> Свернуть</> : <><ChevronDown size={11} /> Развернуть</>}
                    </button>
                  </div>
                  {!isMock && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                      }}
                      disabled={deletingId === item.id}
                      className="flex-shrink-0 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40"
                      style={{ width: 26, height: 26, background: "#FEF2F2", border: "1px solid #FECACA", color: "#EF4444" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.borderColor = "#FCA5A5"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "#FEF2F2"; e.currentTarget.style.borderColor = "#FECACA"; }}
                      title="Удалить"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
                );
              })}

              {sectionItems.length === 0 && !isAdding && (
                <p className="px-5 py-3.5 text-xs text-stone-300 italic">Нет записей</p>
              )}
            </div>

            {/* Inline add form */}
            {isAdding && (
              <div
                className="px-5 py-3 border-t"
                style={{ background: S.addArea, borderColor: S.divider }}
              >
                <textarea
                  autoFocus
                  rows={2}
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  placeholder="Введите наблюдение или заметку..."
                  className="w-full px-3 py-2 rounded-xl border text-sm text-slate-800 placeholder:text-stone-300 focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50 transition-all resize-none"
                  style={{ background: S.bg, borderColor: S.border }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAdd(section);
                    if (e.key === "Escape") { setAddingSection(null); setDraftText(""); }
                  }}
                />
                <div className="flex items-center justify-end gap-2 mt-2">
                  <button
                    onClick={() => { setAddingSection(null); setDraftText(""); }}
                    className="text-xs text-stone-400 hover:text-stone-600 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={() => handleAdd(section)}
                    disabled={saving || !draftText.trim()}
                    className="text-xs bg-brand-500 hover:bg-brand-600 disabled:bg-stone-300 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
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
      className="mt-0.5 flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full text-stone-400"
      style={{ background: "#E4DDD0", border: "1px solid #D8CFBE" }}
    >
      <User size={10} />
    </span>
  );
}
