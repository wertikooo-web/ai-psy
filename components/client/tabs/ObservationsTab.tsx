"use client";

import { useState, useEffect } from "react";
import { Eye, Trash2, ChevronDown, ChevronUp, Loader2, AlertCircle, Plus } from "lucide-react";
import type { ClientMaterial } from "@/lib/types";

// ── Craft palette (matches HistoryTab) ────────────────────────────────────────
const S = {
  bg:       "#FBF8F2",
  border:   "#D8CFBE",
  header:   "#E9DCC7",
  divider:  "#EDE8DE",
  title:    "#6B5D4F",
  count:    "#E4D9C8",
  countTxt: "#9C8E80",
  muted:    "#A8997F",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function ObsBadge() {
  return (
    <span
      title="Наблюдение психолога"
      className="mt-0.5 flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full"
      style={{ background: "#DBEAFE", border: "1px solid #BFDBFE", color: "#1E40AF" }}
    >
      <Eye size={10} />
    </span>
  );
}

interface Props {
  clientId: string;
  isMock?:  boolean;
}

export function ObservationsTab({ clientId, isMock }: Props) {
  const [items,      setItems]      = useState<ClientMaterial[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [expanded,   setExpanded]   = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (isMock) { setLoading(false); return; }
    fetch(`/api/client-materials/${clientId}`)
      .then((r) => r.ok ? r.json() : [])
      .then((mats: ClientMaterial[]) =>
        setItems(mats.filter((m) => m.type === "observation"))
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId, isMock]);

  useEffect(() => {
    function onCreated(e: CustomEvent) {
      if (e.detail?.clientId !== clientId) return;
      const obs: ClientMaterial = e.detail.observation;
      setItems((prev) => [obs, ...prev.filter((m) => m.id !== obs.id)]);
    }
    function onUpdated(e: CustomEvent) {
      if (e.detail?.clientId !== clientId) return;
      const { tempId, observation } = e.detail as { tempId: string; observation: ClientMaterial };
      setItems((prev) =>
        prev.map((m) => (m.id === tempId ? { ...observation } : m))
      );
    }
    window.addEventListener("observation-created", onCreated as EventListener);
    window.addEventListener("observation-updated", onUpdated as EventListener);
    return () => {
      window.removeEventListener("observation-created", onCreated as EventListener);
      window.removeEventListener("observation-updated", onUpdated as EventListener);
    };
  }, [clientId]);

  async function handleDelete(id: string) {
    if (!confirm("Удалить это наблюдение?")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/client-materials/${clientId}/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((m) => m.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  const sorted = [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={22} className="animate-spin" style={{ color: S.muted }} />
      </div>
    );
  }

  return (
    <div className="space-y-3">

      {/* Context banner */}
      <div
        className="flex items-start gap-2 rounded-xl px-4 py-3 text-xs"
        style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#1E40AF" }}
      >
        <Eye size={13} className="flex-shrink-0 mt-0.5" />
        <span>
          Наблюдения <strong>автоматически включаются</strong> в контекст следующего AI‑анализа этого клиента.
        </span>
      </div>

      {/* Card — matches HistoryTab structure */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ background: S.bg, borderColor: S.border }}
      >
        {/* Section header */}
        <div
          className="flex items-center justify-between px-5 py-3.5 border-b"
          style={{ background: S.header, borderColor: S.divider }}
        >
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-semibold" style={{ color: S.title }}>Наблюдения</h3>
            {sorted.length > 0 && (
              <span
                className="text-xs rounded-full px-2 py-0.5 font-medium"
                style={{ background: S.count, color: S.countTxt }}
              >
                {sorted.length}
              </span>
            )}
          </div>
          {!isMock && (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("open-observation-modal"))}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
              style={{ color: S.countTxt }}
              onMouseEnter={(e) => (e.currentTarget.style.background = S.count)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Plus size={12} />
              Добавить
            </button>
          )}
        </div>

        {/* Items */}
        <div>
          {sorted.length === 0 && (
            <p className="px-5 py-3.5 text-xs italic" style={{ color: "#C9BBAA" }}>Нет наблюдений</p>
          )}

          {sorted.map((obs, i) => {
            const isTranscribing = obs.status === "transcribing";
            const isError        = obs.status === "error";
            const isOpen         = expanded === obs.id;
            const preview        = obs.content.slice(0, 280);
            const hasMore        = obs.content.length > 280;

            return (
              <div
                key={obs.id}
                className="flex items-start gap-3 px-5 py-3.5 group"
                style={{ borderTop: i > 0 ? `1px solid ${S.divider}` : undefined }}
              >
                <ObsBadge />

                <div className="flex-1 min-w-0">
                  <p className="text-xs mb-1" style={{ color: S.muted }}>{formatDate(obs.createdAt)}</p>

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
                        {!isOpen && hasMore && <span style={{ color: S.muted }}>…</span>}
                      </p>
                      {hasMore && (
                        <button
                          onClick={() => setExpanded(isOpen ? null : obs.id)}
                          className="mt-1.5 flex items-center gap-1 text-xs font-medium transition-colors"
                          style={{ color: S.muted }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = S.title; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = S.muted; }}
                        >
                          {isOpen ? <><ChevronUp size={11} /> Свернуть</> : <><ChevronDown size={11} /> Показать полностью</>}
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Trash — visible on hover, like HistoryTab */}
                {!isMock && !isTranscribing && (
                  <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleDelete(obs.id)}
                      disabled={deletingId === obs.id}
                      className="p-1 rounded-md transition-colors disabled:opacity-40"
                      style={{ color: S.muted }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "#EF4444"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = S.muted; }}
                      title="Удалить наблюдение"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
