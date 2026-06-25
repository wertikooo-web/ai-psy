"use client";

import { useState } from "react";
import { Eye, Trash2, ChevronDown, ChevronUp } from "lucide-react";
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
  });
}

interface Props {
  clientId:  string;
  items:     ClientMaterial[];   // type === "observation"
  onDelete?: (id: string) => void;
  isMock?:   boolean;
}

export function ObservationsTab({ items, onDelete, isMock }: Props) {
  const [expanded,   setExpanded]   = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sorted = [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  async function handleDelete(id: string, clientId: string) {
    if (!confirm("Удалить это наблюдение?")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/client-materials/${clientId}/${id}`, { method: "DELETE" });
      onDelete?.(id);
    } finally {
      setDeletingId(null);
    }
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
          const isOpen  = expanded === obs.id;
          const preview = obs.content.slice(0, 280);
          const hasMore = obs.content.length > 280;

          return (
            <div key={obs.id}>
              {i > 0 && <div style={{ height: 1, background: S.divider }} />}
              <div className="px-5 py-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-medium" style={{ color: S.muted }}>
                    {formatDate(obs.createdAt)}
                  </span>
                  {!isMock && (
                    <button
                      onClick={() => handleDelete(obs.id, obs.clientId)}
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
