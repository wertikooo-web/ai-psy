"use client";

import { useState } from "react";
import { ExternalLink, X, Bot } from "lucide-react";
import { PSY_GPTS_GROUPS, type GptItem } from "@/lib/psyGpts";

// ── Card ──────────────────────────────────────────────────────────────────────
function GptCard({
  item,
  onRemove,
}: {
  item: GptItem;
  onRemove: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="rounded-2xl border flex flex-col shadow-sm hover:shadow-md transition-shadow"
      style={{ background: "#F0EBE1", borderColor: "#DDD4C6" }}
    >
      {/* Top: emoji + name + remove */}
      <div
        className="px-5 pt-4 pb-3 border-b flex items-start gap-3"
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

      {/* Description */}
      <div className="px-5 py-3 flex-1">
        <p className="text-sm leading-relaxed" style={{ color: "#6B5D4F" }}>
          {item.description}
        </p>
      </div>

      {/* CTA */}
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="w-full flex items-center justify-between px-5 py-2.5 text-sm font-medium rounded-b-2xl transition-colors"
        style={{
          background:  hovered ? "#BEB09E" : "#C9BBAA",
          color:       "#3A2E22",
          borderTop:   "1px solid #B8AC9A",
          boxShadow:   "inset 0 1px 0 rgba(255,255,255,0.22)",
        }}
      >
        <span>Открыть GPT</span>
        <ExternalLink
          size={13}
          className="flex-shrink-0"
          style={{ color: "#6B5D4F", transform: hovered ? "translateX(2px)" : "none", transition: "transform 0.15s" }}
        />
      </a>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PsyGptsPage() {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  function hide(id: string) {
    setHidden((prev) => new Set([...prev, id]));
  }

  const groups = PSY_GPTS_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => !hidden.has(item.id)),
  }));

  const hiddenCount = hidden.size;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: "inherit" }}>
      <div className="p-8 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "#E8E0D0", border: "1px solid #D8CFBE" }}
            >
              <Bot size={18} style={{ color: "#6B5D4F" }} />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: "#3A2E22" }}>PSY-GPTs</h1>
              <p className="text-sm" style={{ color: "#A8997F" }}>
                Специализированные AI-ассистенты для профессиональной работы
              </p>
            </div>
          </div>
          {hiddenCount > 0 && (
            <button
              onClick={() => setHidden(new Set())}
              className="text-sm px-3 py-1.5 rounded-xl border transition-colors"
              style={{ color: "#6B5D4F", borderColor: "#D8CFBE", background: "#F0EBE1" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#E8E0D0"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#F0EBE1"; }}
            >
              Восстановить скрытые ({hiddenCount})
            </button>
          )}
        </div>

        {/* Groups */}
        <div className="space-y-10">
          {groups.map((group) => (
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
    </div>
  );
}
