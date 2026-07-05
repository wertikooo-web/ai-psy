"use client";

import { useState } from "react";
import { ExternalLink, X, Bot, Plus, Save, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { PSY_GPTS_GROUPS, type GptItem } from "@/lib/psyGpts";
import { ModalPortal } from "@/components/ui/ModalPortal";

// ── Add modal ─────────────────────────────────────────────────────────────────
const FIELD = "w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-colors";
const FIELD_STYLE = { background: "#FFFFFF", borderColor: "#D8CFBE", color: "#3A2E22" };
const FIELD_FOCUS = { borderColor: "#A8997F" };

function AddGptModal({
  onAdd,
  onClose,
}: {
  onAdd: (item: GptItem, groupId: string) => void;
  onClose: () => void;
}) {
  const [name, setName]       = useState("");
  const [emoji, setEmoji]     = useState("🤖");
  const [desc, setDesc]       = useState("");
  const [url, setUrl]         = useState("https://chatgpt.com/g/");
  const [group, setGroup]     = useState(PSY_GPTS_GROUPS[0].id);
  const [error, setError]     = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim())              { setError("Введите название GPT"); return; }
    if (!url.trim().startsWith("http")) { setError("Введите корректную ссылку"); return; }
    const id = `custom-${Date.now()}`;
    onAdd({ id, name: name.trim(), emoji: emoji.trim() || "🤖", description: desc.trim(), url: url.trim() }, group);
    onClose();
  }

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md rounded-2xl shadow-xl overflow-hidden"
          style={{ background: "#FDFCFA", border: "1px solid #E5DDD2" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="px-6 py-4 flex items-center justify-between border-b"
            style={{ background: "#F0EBE3", borderColor: "#E5DDD2" }}
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#E5DDD2" }}>
                <Plus size={14} style={{ color: "#6B5D4F" }} />
              </div>
              <span className="text-sm font-semibold" style={{ color: "#3A2E22" }}>Добавить GPT</span>
            </div>
            <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={submit} className="px-6 py-5 space-y-4">
            {/* Emoji + Name row */}
            <div className="flex gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: "#A8997F" }}>Emoji</label>
                <input
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value)}
                  className={FIELD}
                  style={{ ...FIELD_STYLE, width: 64, textAlign: "center", fontSize: 20 }}
                  maxLength={4}
                  onFocus={(e) => Object.assign(e.target.style, FIELD_FOCUS)}
                  onBlur={(e) => Object.assign(e.target.style, { borderColor: "#D8CFBE" })}
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs font-medium" style={{ color: "#A8997F" }}>Название *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Например: My Custom GPT"
                  className={FIELD}
                  style={FIELD_STYLE}
                  onFocus={(e) => Object.assign(e.target.style, FIELD_FOCUS)}
                  onBlur={(e) => Object.assign(e.target.style, { borderColor: "#D8CFBE" })}
                />
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: "#A8997F" }}>Описание</label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Краткое описание GPT и его возможностей..."
                rows={3}
                className={FIELD + " resize-none"}
                style={FIELD_STYLE}
                onFocus={(e) => Object.assign(e.target.style, FIELD_FOCUS)}
                onBlur={(e) => Object.assign(e.target.style, { borderColor: "#D8CFBE" })}
              />
            </div>

            {/* URL */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: "#A8997F" }}>Ссылка *</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://chatgpt.com/g/..."
                className={FIELD}
                style={FIELD_STYLE}
                onFocus={(e) => Object.assign(e.target.style, FIELD_FOCUS)}
                onBlur={(e) => Object.assign(e.target.style, { borderColor: "#D8CFBE" })}
              />
            </div>

            {/* Group */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: "#A8997F" }}>Группа</label>
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className={FIELD}
                style={FIELD_STYLE}
              >
                {PSY_GPTS_GROUPS.map((g) => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-xs text-rose-500">{error}</p>
            )}

            {/* Actions */}
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
                className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
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

function firstSentence(text: string): string {
  const m = text.match(/^[\s\S]+?[.!?](?=\s|$)/);
  return m ? m[0].trim() : text;
}

// ── Card ──────────────────────────────────────────────────────────────────────
function GptCard({ item, onRemove }: { item: GptItem; onRemove: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="rounded-2xl border flex flex-col shadow-sm hover:shadow-md transition-shadow"
      style={{ background: "#F0EBE1", borderColor: "#DDD4C6", height: 190 }}
    >
      <div
        className="px-5 pt-4 pb-3 border-b flex items-start gap-3 flex-shrink-0"
        style={{ background: "#E8E0D0", borderColor: "#DDD4C6", borderRadius: "1rem 1rem 0 0" }}
      >
        <span className="text-xl leading-none flex-shrink-0 mt-0.5">{item.emoji}</span>
        <h3 className="flex-1 text-sm font-semibold leading-snug" style={{ color: "#3A2E22" }}>
          {item.name}
        </h3>
        <button
          onClick={onRemove}
          title="Убрать из списка"
          className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-colors"
          style={{ color: "#A8997F" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#6B5D4F"; e.currentTarget.style.background = "#D8CFBE"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#A8997F"; e.currentTarget.style.background = "transparent"; }}
        >
          <X size={13} />
        </button>
      </div>

      <div className="px-5 py-3 flex-1 overflow-hidden" style={{ background: "#FBF8F5" }}>
        <p className="text-sm leading-relaxed line-clamp-2" style={{ color: "#6B5D4F" }}>
          {firstSentence(item.description) || <span className="italic" style={{ color: "#C9BBAA" }}>Без описания</span>}
        </p>
      </div>

      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="w-full flex items-center justify-between px-5 py-2.5 text-sm font-medium rounded-b-2xl flex-shrink-0"
        style={{
          background: hovered ? "#BEB09E" : "#C9BBAA",
          color:      "#3A2E22",
          borderTop:  "1px solid #B8AC9A",
          boxShadow:  "inset 0 1px 0 rgba(255,255,255,0.22)",
          transition: "background 0.15s",
        }}
      >
        <span>Открыть GPT</span>
        <ExternalLink
          size={13}
          style={{ color: "#6B5D4F", transform: hovered ? "translateX(2px)" : "none", transition: "transform 0.15s" }}
        />
      </a>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
type GroupState = { id: string; label: string; items: GptItem[] }[];

export default function PsyGptsPage() {
  const router = useRouter();
  const [groups, setGroups]     = useState<GroupState>(PSY_GPTS_GROUPS.map((g) => ({ ...g, items: [...g.items] })));
  const [hidden, setHidden]     = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen]   = useState(false);

  function hide(id: string) {
    setHidden((prev) => new Set([...prev, id]));
  }

  function restore() {
    setHidden(new Set());
  }

  function addGpt(item: GptItem, groupId: string) {
    setGroups((prev) =>
      prev.map((g) => g.id === groupId ? { ...g, items: [item, ...g.items] } : g)
    );
  }

  const visibleGroups = groups.map((g) => ({
    ...g,
    items: g.items.filter((item) => !hidden.has(item.id)),
  }));

  const hiddenCount = hidden.size;

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
          <h1 className="text-xl font-bold" style={{ color: "#3A2E22" }}>PSY-GPTs</h1>
        </div>
        <p className="text-sm mb-8" style={{ color: "#A8997F" }}>Специализированные AI-ассистенты для профессиональной работы</p>

        <div className="flex items-center justify-between mb-6">
          <div />

          <div className="flex items-center gap-2">
            {hiddenCount > 0 && (
              <button
                onClick={restore}
                className="text-sm px-3 py-2 rounded-xl border transition-colors"
                style={{ color: "#6B5D4F", borderColor: "#D8CFBE", background: "#F0EBE1" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#E8E0D0"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#F0EBE1"; }}
              >
                Восстановить скрытые ({hiddenCount})
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
              Добавить GPT
            </button>
          </div>
        </div>

        {/* Groups */}
        <div className="space-y-10">
          {visibleGroups.map((group) => (
            <section key={group.id}>
              <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "#A8997F" }}>
                {group.label}
              </h2>
              {group.items.length === 0 ? (
                <p className="text-sm py-6 text-center" style={{ color: "#C9BBAA" }}>
                  Все GPTs в этой группе скрыты
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.items.map((item) => (
                    <GptCard key={item.id} item={item} onRemove={() => hide(item.id)} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>

      </div>

      {addOpen && (
        <AddGptModal onAdd={addGpt} onClose={() => setAddOpen(false)} />
      )}
    </div>
  );
}
