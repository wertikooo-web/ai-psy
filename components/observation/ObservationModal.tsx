"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Eye } from "lucide-react";
import { ModalPortal } from "@/components/ui/ModalPortal";

/* ── Palette ──────────────────────────────────────────────────────────────── */
const C = {
  bg:       "#FAF8F5",
  border:   "#D8CFBE",
  divider:  "#EDE8DE",
  title:    "#3D3228",
  body:     "#4A3C2E",
  muted:    "#A8997F",
  accent:   "#6B5D4F",
  btnPrim:  "#4A3C2E",
  btnHover: "#3D3228",
  inputBg:  "#FFFFFF",
  hint:     "#8B7D6B",
};

interface Props {
  onClose:          () => void;
  defaultClientId?: string;
  consultationId?:  string;
}

function detectHintText(): string {
  if (typeof navigator === "undefined") return "Можно напечатать текст или воспользоваться голосовым вводом вашего устройства.";
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "Можно напечатать текст или нажать Win + H, чтобы продиктовать голосом.";
  if (/Mac/i.test(ua))     return "Можно напечатать текст или использовать диктовку (Fn + D).";
  return "Можно напечатать текст или воспользоваться голосовым вводом вашего устройства.";
}

export function ObservationModal({ onClose, defaultClientId, consultationId }: Props) {
  const [text,        setText]        = useState("");
  const [clientId,    setClientId]    = useState(defaultClientId ?? "");
  const [clients,     setClients]     = useState<{ id: string; name: string }[]>([]);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hintText    = detectHintText();

  /* Auto-resolve clientId from consultationId if needed */
  useEffect(() => {
    if (defaultClientId || !consultationId) return;
    fetch(`/api/consultations/${consultationId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((c) => { if (c?.clientId) setClientId(c.clientId); })
      .catch(() => {});
  }, [consultationId, defaultClientId]);

  /* Load clients for picker (only when no defaultClientId) */
  useEffect(() => {
    if (defaultClientId) return;
    fetch("/api/clients")
      .then((r) => r.ok ? r.json() : [])
      .then((list: { id: string; name?: string; full_name?: string }[]) =>
        setClients(list.map((c) => ({ id: c.id, name: c.name ?? c.full_name ?? c.id })))
      )
      .catch(() => {});
  }, [defaultClientId]);

  /* Auto-focus textarea */
  useEffect(() => {
    const t = setTimeout(() => textareaRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  /* Close on Escape */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const handleCancel = useCallback(() => {
    if (text.trim()) {
      if (!confirm("Закрыть без сохранения? Введённый текст будет потерян.")) return;
    }
    onClose();
  }, [text, onClose]);

  async function handleSave() {
    const content = text.trim();
    if (!content || !clientId) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/client-materials/${clientId}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          type:           "observation",
          title:          "Наблюдение психолога",
          content,
          consultationId: consultationId ?? undefined,
        }),
      });
      if (!res.ok) throw new Error("Ошибка сохранения");
      const matData = await res.json();

      /* Real-time: push to ObservationsTab */
      window.dispatchEvent(new CustomEvent("observation-created", {
        detail: { clientId, observation: { ...matData, status: "done" } },
      }));
      /* Mark analysis stale */
      window.dispatchEvent(new CustomEvent("client-materials-changed", {
        detail: { clientId, consultationId },
      }));

      onClose();
    } catch {
      setError("Не удалось сохранить. Попробуйте ещё раз.");
      setSaving(false);
    }
  }

  const canSave = text.trim().length > 0 && !!clientId;

  return (
    <ModalPortal>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(61,50,40,0.35)", backdropFilter: "blur(2px)" }}
        onClick={handleCancel}
      >
        {/* Dialog */}
        <div
          className="relative w-full max-w-md rounded-2xl shadow-2xl flex flex-col"
          style={{ background: C.bg, border: `1.5px solid ${C.border}`, maxHeight: "90vh" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 flex-shrink-0"
            style={{ borderBottom: `1px solid ${C.divider}` }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: C.btnPrim }}
              >
                <Eye size={15} color="white" />
              </div>
              <h2 className="text-base font-semibold" style={{ color: C.title }}>
                Новое наблюдение
              </h2>
            </div>
            <button
              onClick={handleCancel}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: C.muted }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.divider; e.currentTarget.style.color = C.body; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.muted; }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Client picker — only when no preset client */}
            {!defaultClientId && !consultationId && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
                  Клиент <span className="text-rose-400">*</span>
                </label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{
                    background:  C.inputBg,
                    border:      `1.5px solid ${C.border}`,
                    color:       clientId ? C.body : C.muted,
                    appearance:  "none",
                  }}
                >
                  <option value="">— Выберите клиента —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
                Наблюдение
              </label>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Запишите своё наблюдение о клиенте…"
                rows={6}
                className="w-full rounded-xl px-3.5 py-3 text-sm leading-relaxed resize-none outline-none transition-colors"
                style={{
                  background:  C.inputBg,
                  border:      `1.5px solid ${C.border}`,
                  color:       C.body,
                }}
                onFocus={(e)  => { e.currentTarget.style.borderColor = C.accent; }}
                onBlur={(e)   => { e.currentTarget.style.borderColor = C.border; }}
              />
              {/* Hint */}
              <p className="text-xs leading-relaxed" style={{ color: C.hint }}>
                {hintText}
              </p>
            </div>

            {error && (
              <p className="text-xs text-rose-500">{error}</p>
            )}
          </div>

          {/* Footer */}
          <div
            className="flex gap-2 px-5 py-4 flex-shrink-0"
            style={{ borderTop: `1px solid ${C.divider}` }}
          >
            <button
              onClick={handleCancel}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ background: C.divider, color: C.accent }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#DDD5C5"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = C.divider; }}
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave || saving}
              className="flex-[2] py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: canSave && !saving ? C.btnPrim : "#A8997F", color: "white" }}
              onMouseEnter={(e) => { if (canSave && !saving) e.currentTarget.style.background = C.btnHover; }}
              onMouseLeave={(e) => { if (canSave && !saving) e.currentTarget.style.background = C.btnPrim; }}
            >
              {saving ? "Сохраняется…" : "Сохранить наблюдение"}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
