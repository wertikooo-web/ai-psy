"use client";

import { useState } from "react";
import { ExternalLink, X, MessageSquare, Plus, Save, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { DEFAULT_AI_SERVICES, type AiService } from "@/lib/aiServices";
import { ModalPortal } from "@/components/ui/ModalPortal";

// ── Add modal ─────────────────────────────────────────────────────────────────
const INPUT_CLS = "w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-colors";
const INPUT_ST  = { background: "#FFFFFF", borderColor: "#D8CFBE", color: "#3A2E22" };
const FOCUS_ST  = { borderColor: "#A8997F" };

function AddServiceModal({
  onAdd,
  onClose,
}: {
  onAdd: (s: AiService) => void;
  onClose: () => void;
}) {
  const [name,  setName]  = useState("");
  const [url,   setUrl]   = useState("https://");
  const [emoji, setEmoji] = useState("🤖");
  const [desc,  setDesc]  = useState("");
  const [err,   setErr]   = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim())                   { setErr("Введите название"); return; }
    if (!url.trim().startsWith("http")) { setErr("Введите корректную ссылку"); return; }
    onAdd({
      id:          `custom-${Date.now()}`,
      name:        name.trim(),
      url:         url.trim(),
      emoji:       emoji.trim() || "🤖",
      description: desc.trim(),
    });
    onClose();
  }

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-sm rounded-2xl shadow-xl overflow-hidden"
          style={{ background: "#FDFCFA", border: "1px solid #E5DDD2" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="px-6 py-4 flex items-center justify-between border-b"
            style={{ background: "#F0EBE3", borderColor: "#E5DDD2" }}
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#E5DDD2" }}>
                <Plus size={14} style={{ color: "#6B5D4F" }} />
              </div>
              <span className="text-sm font-semibold" style={{ color: "#3A2E22" }}>Добавить сервис</span>
            </div>
            <button onClick={onClose} style={{ color: "#A8997F" }}><X size={16} /></button>
          </div>

          <form onSubmit={submit} className="px-6 py-5 space-y-4">
            <div className="flex gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: "#A8997F" }}>Emoji</label>
                <input
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value)}
                  className={INPUT_CLS}
                  style={{ ...INPUT_ST, width: 56, textAlign: "center", fontSize: 20 }}
                  maxLength={4}
                  onFocus={(e) => Object.assign(e.target.style, FOCUS_ST)}
                  onBlur={(e)  => Object.assign(e.target.style, { borderColor: "#D8CFBE" })}
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs font-medium" style={{ color: "#A8997F" }}>Название *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Например: Mistral"
                  className={INPUT_CLS}
                  style={INPUT_ST}
                  onFocus={(e) => Object.assign(e.target.style, FOCUS_ST)}
                  onBlur={(e)  => Object.assign(e.target.style, { borderColor: "#D8CFBE" })}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: "#A8997F" }}>Ссылка *</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className={INPUT_CLS}
                style={INPUT_ST}
                onFocus={(e) => Object.assign(e.target.style, FOCUS_ST)}
                onBlur={(e)  => Object.assign(e.target.style, { borderColor: "#D8CFBE" })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: "#A8997F" }}>Описание</label>
              <input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Модель · Компания"
                className={INPUT_CLS}
                style={INPUT_ST}
                onFocus={(e) => Object.assign(e.target.style, FOCUS_ST)}
                onBlur={(e)  => Object.assign(e.target.style, { borderColor: "#D8CFBE" })}
              />
            </div>

            {err && <p className="text-xs text-rose-500">{err}</p>}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border text-sm transition-colors"
                style={{ borderColor: "#D8CFBE", color: "#6B5D4F", background: "#F0EBE1" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#E8E0D0"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#F0EBE1"; }}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                style={{ background: "#6B5D4F", color: "#FFFFFF" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#4A3C2E"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#6B5D4F"; }}
              >
                <Save size={14} />
                Добавить
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}

// ── Service card ──────────────────────────────────────────────────────────────
function ServiceCard({ s, onRemove }: { s: AiService; onRemove: () => void }) {
  const [hov, setHov] = useState(false);

  return (
    <div
      className="rounded-2xl border flex flex-col shadow-sm hover:shadow-md transition-shadow"
      style={{ background: "#F0EBE1", borderColor: "#DDD4C6" }}
    >
      {/* Header */}
      <div
        className="px-5 pt-4 pb-3 border-b flex items-center gap-3"
        style={{ background: "#E8E0D0", borderColor: "#DDD4C6", borderRadius: "1rem 1rem 0 0" }}
      >
        <span className="text-2xl leading-none flex-shrink-0">{s.emoji}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate" style={{ color: "#3A2E22" }}>{s.name}</h3>
          {s.description && (
            <p className="text-xs truncate mt-0.5" style={{ color: "#A8997F" }}>{s.description}</p>
          )}
        </div>
        <button
          onClick={onRemove}
          title="Убрать"
          className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-colors"
          style={{ color: "#A8997F" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#6B5D4F"; e.currentTarget.style.background = "#D8CFBE"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#A8997F"; e.currentTarget.style.background = "transparent"; }}
        >
          <X size={13} />
        </button>
      </div>

      {/* CTA */}
      <a
        href={s.url}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium rounded-b-2xl mt-auto"
        style={{
          background: hov ? "#BEB09E" : "#C9BBAA",
          color:      "#3A2E22",
          borderTop:  "1px solid #B8AC9A",
          boxShadow:  "inset 0 1px 0 rgba(255,255,255,0.22)",
          transition: "background 0.15s",
        }}
      >
        <span>Открыть</span>
        <ExternalLink
          size={13}
          style={{ color: "#6B5D4F", transform: hov ? "translateX(2px)" : "none", transition: "transform 0.15s" }}
        />
      </a>
    </div>
  );
}

// ── Add placeholder card ──────────────────────────────────────────────────────
function AddCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 p-6 min-h-[110px] transition-all"
      style={{ borderColor: "#D8CFBE", color: "#A8997F" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#A8997F"; e.currentTarget.style.color = "#6B5D4F"; e.currentTarget.style.background = "#F0EBE1"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#D8CFBE"; e.currentTarget.style.color = "#A8997F"; e.currentTarget.style.background = "transparent"; }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#E8E0D0" }}>
        <Plus size={18} style={{ color: "#6B5D4F" }} />
      </div>
      <span className="text-sm font-medium">Добавить сервис</span>
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AiChatPage() {
  const router = useRouter();
  const [services, setServices] = useState<AiService[]>(DEFAULT_AI_SERVICES);
  const [hidden,   setHidden]   = useState<Set<string>>(new Set());
  const [addOpen,  setAddOpen]  = useState(false);

  const visible = services.filter((s) => !hidden.has(s.id));

  return (
    <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: "inherit" }}>
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm transition-colors"
            style={{ color: "#A8997F" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#4A3C2E"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#A8997F"; }}
          >
            <ArrowLeft size={16} />
            Назад
          </button>
          <div className="w-px h-5" style={{ background: "#DDD4C6" }} />
          <h1 className="text-xl font-bold" style={{ color: "#3A2E22" }}>AI сервисы</h1>
        </div>
        <p className="text-sm mb-8" style={{ color: "#A8997F" }}>Быстрый доступ к AI-сервисам</p>

        <div className="flex items-center justify-between mb-6">
          <div />

          <div className="flex items-center gap-2">
            {hidden.size > 0 && (
              <button
                onClick={() => setHidden(new Set())}
                className="text-sm px-3 py-2 rounded-xl border transition-colors"
                style={{ color: "#6B5D4F", borderColor: "#D8CFBE", background: "#F0EBE1" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#E8E0D0"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#F0EBE1"; }}
              >
                Восстановить ({hidden.size})
              </button>
            )}
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl font-medium transition-colors"
              style={{ background: "#6B5D4F", color: "#FFFFFF" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#4A3C2E"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#6B5D4F"; }}
            >
              <Plus size={15} />
              Добавить сервис
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {visible.map((s) => (
            <ServiceCard
              key={s.id}
              s={s}
              onRemove={() => setHidden((prev) => new Set([...prev, s.id]))}
            />
          ))}
          <AddCard onClick={() => setAddOpen(true)} />
        </div>

      </div>

      {addOpen && (
        <AddServiceModal
          onAdd={(s) => setServices((prev) => [s, ...prev])}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}
