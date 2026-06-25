"use client";

import { useState, useEffect } from "react";
import { Eye, Trash2, ChevronDown, ChevronUp, Loader2, AlertCircle, RotateCcw } from "lucide-react";
import type { ClientMaterial } from "@/lib/types";

const S = {
  bg:      "#FBF8F2",
  border:  "#D8CFBE",
  header:  "#E9DCC7",
  divider: "#EDE8DE",
  title:   "#4A3C2E",
  muted:   "#A8997F",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
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

  // Initial fetch
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

  // Real-time event listeners
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

  if (sorted.length === 0) {
    return (
      <div
        className="rounded-2xl border py-14 text-center"
        style={{ background: S.bg, borderColor: S.border }}
      >
        <Eye size={28} className="mx-auto mb-3" style={{ color: S.border }} />
        <p className="text-sm font-medium" style={{ color: S.title }}>Наблюдений пока нет</p>
        <p className="text-xs max-w-xs mx-auto mt-1.5 leading-relaxed" style={{ color: S.muted }}>
          Нажмите кнопку 🎙 справа внизу — запишите голосовое или текстовое наблюдение.
          Оно попадёт сюда и будет учтено в следующем AI‑анализе.
        </p>
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

      <div
        className="rounded-2xl border overflow-hidden"
        style={{ background: S.bg, borderColor: S.border }}
      >
        {/* Header */}
        <div
          className="px-5 py-3 border-b"
          style={{ background: S.header, borderColor: S.divider }}
        >
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: S.muted }}>
            Наблюдения · {sorted.length}
          </span>
        </div>

        {/* List */}
        {sorted.map((obs, i) => {
          const isTranscribing = obs.status === "transcribing";
          const isError        = obs.status === "error";
          const isOpen         = expanded === obs.id;
          const preview        = obs.content.slice(0, 280);
          const hasMore        = obs.content.length > 280;

          return (
            <div key={obs.id}>
              {i > 0 && <div style={{ height: 1, background: S.divider }} />}
              <div className="px-5 py-4">

                {/* Meta row */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium" style={{ color: S.muted }}>
                      {formatDate(obs.createdAt)}
                    </span>
                    {/* Source label */}
                    <span
                      className="text-xs font-medium inline-flex items-center gap-1"
                      style={{ color: "#6B5D4F" }}
                    >
                      <Eye size={10} />
                      Наблюдение психолога
                    </span>
                  </div>

                  {/* Delete — only for done observations */}
                  {!isMock && !isTranscribing && (
                    <button
                      onClick={() => handleDelete(obs.id)}
                      disabled={deletingId === obs.id}
                      className="flex-shrink-0 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40"
                      style={{ width: 26, height: 26, color: S.muted }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "#EF4444"; e.currentTarget.style.background = "#FEE2E2"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = S.muted; e.currentTarget.style.background = "transparent"; }}
                      title="Удалить наблюдение"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

                {/* Transcribing state */}
                {isTranscribing && (
                  <div className="flex items-center gap-2 mt-1">
                    <Loader2 size={13} className="animate-spin flex-shrink-0" style={{ color: S.muted }} />
                    <span className="text-sm italic" style={{ color: S.muted }}>Расшифровывается…</span>
                  </div>
                )}

                {/* Error state */}
                {isError && (
                  <div className="flex items-center gap-2 mt-1">
                    <AlertCircle size={13} className="flex-shrink-0 text-rose-400" />
                    <span className="text-sm" style={{ color: "#be123c" }}>
                      {obs.content || "Ошибка транскрипции. Аудио сохранено."}
                    </span>
                  </div>
                )}

                {/* Normal content */}
                {!isTranscribing && !isError && (
                  <>
                    <p
                      className="text-sm leading-relaxed whitespace-pre-wrap"
                      style={{ color: S.title }}
                    >
                      {isOpen ? obs.content : preview}
                      {!isOpen && hasMore && <span style={{ color: S.muted }}>…</span>}
                    </p>
                    {hasMore && (
                      <button
                        onClick={() => setExpanded(isOpen ? null : obs.id)}
                        className="mt-2 flex items-center gap-1 text-xs font-medium transition-colors"
                        style={{ color: S.muted }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = S.title; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = S.muted; }}
                      >
                        {isOpen
                          ? <><ChevronUp size={11} /> Свернуть</>
                          : <><ChevronDown size={11} /> Показать полностью</>}
                      </button>
                    )}
                  </>
                )}

              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
