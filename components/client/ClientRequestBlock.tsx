"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, Pencil, Plus, X, Loader2 } from "lucide-react";
import { ModalPortal } from "@/components/ui/ModalPortal";
import type { ClientRequest } from "@/lib/types";

const S = {
  bg:     "#FBF8F2",
  border: "#D8CFBE",
  title:  "#3A2E22",
  muted:  "#A8997F",
  text:   "#4A3C2E",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

// ── Edit modal (Уточнить формулировку) ────────────────────────────────────────

function EditModal({
  request,
  onSave,
  onClose,
}: {
  request: ClientRequest;
  onSave:  (text: string) => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText]     = useState(request.text);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  async function handleSave() {
    if (!text.trim()) { setError("Текст не может быть пустым"); return; }
    setSaving(true);
    setError("");
    try {
      await onSave(text.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: S.border }}>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: S.title }}>Уточнить формулировку</h2>
              <p className="text-xs mt-0.5" style={{ color: S.muted }}>Новая запись не создаётся — только правка текста</p>
            </div>
            <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors ml-4">
              <X size={16} />
            </button>
          </div>
          <div className="px-5 py-4 space-y-3">
            {request.previousText && (
              <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "#F5F0E8", color: S.muted }}>
                Предыдущая: {request.previousText}
              </p>
            )}
            <div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 300))}
                rows={3}
                className="w-full text-sm rounded-xl border px-3 py-2.5 resize-none outline-none"
                style={{ borderColor: S.border, background: S.bg, color: S.text }}
                placeholder="Формулировка запроса..."
                autoFocus
              />
              <p className="text-right text-xs mt-1" style={{ color: text.length >= 280 ? "#E07050" : S.muted }}>
                {text.length}/300
              </p>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
          <div className="flex gap-3 px-5 pb-5">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm border transition-colors"
              style={{ borderColor: S.border, color: "#6B5D4F" }}
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !text.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: "#6B5D4F" }}
              onMouseEnter={e => { if (!saving) e.currentTarget.style.background = "#4A3C2E"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#6B5D4F"; }}
            >
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

// ── New request modal ──────────────────────────────────────────────────────────

function NewRequestModal({
  onSave,
  onClose,
}: {
  onSave:  (text: string, comment: string) => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText]       = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  async function handleSave() {
    if (!text.trim()) { setError("Текст не может быть пустым"); return; }
    setSaving(true);
    setError("");
    try {
      await onSave(text.trim(), comment.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка создания");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: S.border }}>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: S.title }}>Новый запрос</h2>
              <p className="text-xs mt-0.5" style={{ color: S.muted }}>Предыдущий запрос сохранится в истории</p>
            </div>
            <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors ml-4">
              <X size={16} />
            </button>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: S.muted }}>
                Новый запрос клиента
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 300))}
                rows={3}
                className="w-full text-sm rounded-xl border px-3 py-2.5 resize-none outline-none"
                style={{ borderColor: S.border, background: S.bg, color: S.text }}
                placeholder="Опишите новую тему или запрос..."
                autoFocus
              />
              <p className="text-right text-xs mt-1" style={{ color: text.length >= 280 ? "#E07050" : S.muted }}>
                {text.length}/300
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: S.muted }}>
                Комментарий <span style={{ fontWeight: 400 }}>(необязательно)</span>
              </label>
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 120))}
                className="w-full text-sm rounded-xl border px-3 py-2.5 outline-none"
                style={{ borderColor: S.border, background: S.bg, color: S.text }}
                placeholder="Почему изменился запрос..."
              />
              <p className="text-right text-xs mt-1" style={{ color: comment.length >= 100 ? "#E07050" : S.muted }}>
                {comment.length}/120
              </p>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
          <div className="flex gap-3 px-5 pb-5">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm border transition-colors"
              style={{ borderColor: S.border, color: "#6B5D4F" }}
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !text.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: "#6B5D4F" }}
              onMouseEnter={e => { if (!saving) e.currentTarget.style.background = "#4A3C2E"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#6B5D4F"; }}
            >
              {saving ? "Создание..." : "Создать запрос"}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

// ── Main block ─────────────────────────────────────────────────────────────────

interface Props {
  clientId: string;
  isMock:   boolean;
}

export function ClientRequestBlock({ clientId, isMock }: Props) {
  const [requests, setRequests]       = useState<ClientRequest[]>([]);
  const [loading, setLoading]         = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showAll, setShowAll]         = useState(false);
  const [editOpen, setEditOpen]       = useState(false);
  const [newOpen, setNewOpen]         = useState(false);

  const VISIBLE_LIMIT = 5;
  const current  = requests.find((r) => r.isCurrent) ?? null;

  const reload = useCallback(async () => {
    if (isMock) { setLoading(false); return; }
    try {
      const res  = await fetch(`/api/client-requests/${clientId}`);
      const data = res.ok ? await res.json() : [];
      setRequests(data);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [clientId, isMock]);

  useEffect(() => { reload(); }, [reload]);

  async function handleUpdateText(text: string) {
    if (!current) return;
    const res = await fetch(`/api/client-requests/${clientId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ requestId: current.id, text }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Ошибка сохранения");
    }
    await reload();
  }

  async function handleCreateNew(text: string, comment: string) {
    const res = await fetch(`/api/client-requests/${clientId}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ text, comment: comment || undefined }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Ошибка создания");
    }
    await reload();
    setHistoryOpen(true);
  }

  // ── Mock placeholder ────────────────────────────────────────────────────────
  if (isMock) {
    return (
      <div className="rounded-2xl border overflow-hidden" style={{ background: S.bg, borderColor: S.border }}>
        <div className="px-5 py-3 border-b" style={{ borderColor: S.border, background: "#E9DCC7" }}>
          <h3 className="text-sm font-bold" style={{ color: S.title }}>Запрос клиента</h3>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm italic" style={{ color: S.muted }}>Доступно только для реальных клиентов.</p>
        </div>
      </div>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="rounded-2xl border overflow-hidden" style={{ background: S.bg, borderColor: S.border }}>
        <div className="px-5 py-3 border-b" style={{ borderColor: S.border, background: "#E9DCC7" }}>
          <h3 className="text-sm font-bold" style={{ color: S.title }}>Запрос клиента</h3>
        </div>
        <div className="px-5 py-4 flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" style={{ color: S.muted }} />
          <span className="text-sm" style={{ color: S.muted }}>Загрузка...</span>
        </div>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <>
      <div className="rounded-2xl border overflow-hidden" style={{ background: S.bg, borderColor: S.border }}>

        {/* Header */}
        <div
          className="px-5 py-3 border-b flex items-center justify-between"
          style={{ borderColor: S.border, background: "#E9DCC7" }}
        >
          <h3 className="text-sm font-bold" style={{ color: S.title }}>Запрос клиента</h3>
          <div className="flex items-center gap-1.5">
            {current && (
              <button
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                style={{ background: "#D4C5B1", color: "#4A3C2E" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#C8B89F"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#D4C5B1"; }}
              >
                <Pencil size={10} />
                Уточнить
              </button>
            )}
            <button
              onClick={() => setNewOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
              style={{ background: "#6B5D4F", color: "#FFFFFF" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#4A3C2E"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#6B5D4F"; }}
            >
              <Plus size={10} />
              Новый запрос
            </button>
          </div>
        </div>

        {/* Current request text */}
        <div className="px-5 py-4">
          {current ? (
            <>
              <p className="text-sm leading-relaxed" style={{ color: S.text }}>{current.text}</p>
              {current.previousText && (
                <p className="mt-2 text-xs" style={{ color: S.muted }}>
                  Уточнено: <span className="line-through">{current.previousText}</span>
                </p>
              )}
            </>
          ) : (
            <p className="text-sm italic" style={{ color: S.muted }}>Запрос пока не задан.</p>
          )}
        </div>

        {/* History toggle — only when there are multiple requests */}
        {requests.length > 1 && (
          <div className="border-t" style={{ borderColor: S.border }}>
            <button
              onClick={() => setHistoryOpen((o) => !o)}
              className="w-full flex items-center justify-between px-5 py-3 text-xs font-medium transition-colors"
              style={{ color: S.muted }}
              onMouseEnter={e => { e.currentTarget.style.color = S.text; }}
              onMouseLeave={e => { e.currentTarget.style.color = S.muted; }}
            >
              <span className="font-semibold">Эволюция запроса ({requests.length})</span>
              <ChevronDown
                size={14}
                style={{
                  transform:  historyOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                }}
              />
            </button>

            {historyOpen && (
              <div className="px-4 pb-4">
                {(() => {
                  const hidden  = requests.length > VISIBLE_LIMIT && !showAll;
                  const visible = hidden
                    ? [...requests.slice(0, VISIBLE_LIMIT - 1), requests[requests.length - 1]]
                    : requests;
                  const hiddenCount = requests.length - VISIBLE_LIMIT;

                  return visible.map((req, i) => {
                    const isLast         = i === visible.length - 1;
                    const isCollapsedGap = hidden && i === VISIBLE_LIMIT - 2;

                    return (
                      <div key={req.id}>
                        {/* Request card */}
                        <div
                          className="px-3 py-3 rounded-xl"
                          style={{
                            background: req.isCurrent ? "#EDE4D4" : "transparent",
                            border:     req.isCurrent ? `1px solid ${S.border}` : "1px solid transparent",
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className="text-sm leading-relaxed flex-1"
                              style={{ color: req.isCurrent ? S.title : "#7A6E60" }}
                            >
                              {req.text}
                            </p>
                            {req.isCurrent && (
                              <span
                                className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                                style={{ background: "#D4C5B1", color: "#4A3C2E" }}
                              >
                                текущий
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-x-2 text-xs" style={{ color: S.muted }}>
                            <span>{fmtDate(req.createdAt)}</span>
                            {req.source === "edit" && <span>· уточнение</span>}
                            {req.comment                  && <span>· {req.comment}</span>}
                          </div>
                          {req.previousText && (
                            <p className="mt-1.5 text-xs" style={{ color: S.muted }}>
                              Было: <span className="line-through">{req.previousText}</span>
                            </p>
                          )}
                        </div>

                        {/* Connector */}
                        {!isLast && (
                          <div style={{ height: 26, marginLeft: 12 }}>
                            <svg width="12" height="26" viewBox="0 0 12 26" fill="none">
                              <line x1="6" y1="0" x2="6" y2="18" stroke="#C9BBAA" strokeWidth="2"/>
                              <path d="M1 13 L6 21 L11 13" stroke="#C9BBAA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                            </svg>
                          </div>
                        )}

                        {/* "Show more" button in the gap */}
                        {isCollapsedGap && (
                          <button
                            onClick={() => setShowAll(true)}
                            className="w-full text-xs py-1.5 mb-0 rounded-lg transition-colors"
                            style={{ color: S.muted, background: "#F0EAE0" }}
                            onMouseEnter={e => { e.currentTarget.style.color = S.text; }}
                            onMouseLeave={e => { e.currentTarget.style.color = S.muted; }}
                          >
                            ещё {hiddenCount} запрос{hiddenCount > 1 ? "а" : ""}
                          </button>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      {editOpen && current && (
        <EditModal
          request={current}
          onSave={handleUpdateText}
          onClose={() => setEditOpen(false)}
        />
      )}

      {newOpen && (
        <NewRequestModal
          onSave={handleCreateNew}
          onClose={() => setNewOpen(false)}
        />
      )}
    </>
  );
}
