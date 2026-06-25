"use client";

import { useState, useEffect } from "react";
import { BookOpen, Plus, Trash2, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import type { NotebookEntry } from "@/lib/notebookStore";

const C = {
  cardBg:  "#FBF8F2",
  cardBdr: "#D8CFBE",
  header:  "#E9DCC7",
  headBdr: "#D8CFBE",
  divider: "#EDE8DE",
  title:   "#3D3228",
  muted:   "#A8997F",
  addBg:   "#F5F0E6",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function NotebookPage() {
  const [entries,  setEntries]  = useState<NotebookEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [text,     setText]     = useState("");
  const [saving,   setSaving]   = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/notebook")
      .then((r) => (r.ok ? r.json() : []))
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    const content = text.trim();
    if (!content || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/notebook", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text: content }),
      });
      if (res.ok) {
        const entry = await res.json() as NotebookEntry;
        setEntries((prev) => [entry, ...prev]);
        setText("");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить запись?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/notebook/${id}`, { method: "DELETE" });
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8 space-y-6">

        {/* Page header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: C.header, border: `1px solid ${C.headBdr}` }}
            >
              <BookOpen size={17} style={{ color: "#6B5D4F" }} />
            </div>
            <h1 className="text-xl font-bold" style={{ color: C.title }}>
              Блокнот психолога
            </h1>
          </div>
          <p className="text-sm ml-12" style={{ color: C.muted }}>
            Личные заметки · идеи · наблюдения · напоминания
          </p>
          <div
            className="mt-3 ml-12 rounded-xl px-3 py-2 text-xs leading-relaxed"
            style={{ background: "#FEF3C7", border: "1px solid #FDE68A", color: "#92400E" }}
          >
            Записи хранятся только в этом сеансе и <strong>не участвуют в AI‑анализе</strong>.
            Для наблюдений по клиентам — используйте кнопку 🎙 справа внизу.
          </div>
        </div>

        {/* New entry form */}
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ background: C.cardBg, borderColor: C.cardBdr }}
        >
          <div
            className="flex items-center gap-2 px-5 py-3.5 border-b"
            style={{ background: C.header, borderColor: C.divider }}
          >
            <Plus size={14} style={{ color: C.muted }} />
            <span className="text-sm font-semibold" style={{ color: C.title }}>Новая запись</span>
          </div>
          <div className="px-5 py-4">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Мысли, идеи, планы, напоминания..."
              rows={4}
              className="w-full text-sm rounded-xl border px-4 py-3 resize-none focus:outline-none focus:ring-2"
              style={{
                background:  "#FFFFFF",
                borderColor: C.cardBdr,
                color:       C.title,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#A8997F"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(168,153,127,0.15)"; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = C.cardBdr; e.currentTarget.style.boxShadow = "none"; }}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave(); }}
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs" style={{ color: "#C9BBAA" }}>Cmd+Enter для сохранения</span>
              <button
                onClick={handleSave}
                disabled={!text.trim() || saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
                style={{ background: "#4A3C2E", color: "#FFFFFF" }}
                onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = "#3A2E22"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#4A3C2E"; }}
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                {saving ? "Сохраняю..." : "Добавить"}
              </button>
            </div>
          </div>
        </div>

        {/* Entries list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin" style={{ color: C.muted }} />
          </div>
        ) : entries.length === 0 ? (
          <div
            className="rounded-2xl border py-14 text-center"
            style={{ background: C.cardBg, borderColor: C.cardBdr }}
          >
            <BookOpen size={28} className="mx-auto mb-3" style={{ color: C.cardBdr }} />
            <p className="text-sm font-medium" style={{ color: C.title }}>Блокнот пуст</p>
            <p className="text-xs mt-1" style={{ color: C.muted }}>Добавьте первую запись выше</p>
          </div>
        ) : (
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ background: C.cardBg, borderColor: C.cardBdr }}
          >
            <div
              className="px-5 py-3 border-b"
              style={{ background: C.header, borderColor: C.divider }}
            >
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>
                Записи · {entries.length}
              </span>
            </div>

            {entries.map((entry, i) => {
              const isOpen  = expanded === entry.id;
              const preview = entry.text.slice(0, 300);
              const hasMore = entry.text.length > 300;

              return (
                <div key={entry.id}>
                  {i > 0 && <div style={{ height: 1, background: C.divider }} />}
                  <div className="px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium" style={{ color: C.muted }}>
                        {formatDate(entry.createdAt)}
                      </span>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        disabled={deleting === entry.id}
                        className="flex items-center justify-center rounded-lg transition-colors disabled:opacity-40"
                        style={{ width: 26, height: 26, color: C.muted }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "#EF4444"; e.currentTarget.style.background = "#FEE2E2"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = C.muted; e.currentTarget.style.background = "transparent"; }}
                        title="Удалить запись"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <p
                      className="text-sm leading-relaxed whitespace-pre-wrap"
                      style={{ color: C.title }}
                    >
                      {isOpen ? entry.text : preview}
                      {!isOpen && hasMore && <span style={{ color: C.muted }}>…</span>}
                    </p>

                    {hasMore && (
                      <button
                        onClick={() => setExpanded(isOpen ? null : entry.id)}
                        className="mt-2 flex items-center gap-1 text-xs font-medium transition-colors"
                        style={{ color: C.muted }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = C.title; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = C.muted; }}
                      >
                        {isOpen
                          ? <><ChevronUp size={11} /> Свернуть</>
                          : <><ChevronDown size={11} /> Показать полностью</>}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
