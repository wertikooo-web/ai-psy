"use client";

import { useState } from "react";
import { NotebookPen, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import type { ClientMaterial } from "@/lib/types";

const S = {
  bg:     "#FBF8F2",
  border: "#D8CFBE",
  divider:"#EDE8DE",
  title:  "#4A3C2E",
  muted:  "#A8997F",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric", month: "long", year: "numeric",
  });
}

interface Props {
  clientId:  string;
  notes:     ClientMaterial[];   // type === "therapist_notes"
  onAdd:     (m: ClientMaterial) => void;
  onDelete?: (id: string) => void;
  isMock?:   boolean;
}

export function NotesTab({ clientId, notes, onAdd, onDelete, isMock }: Props) {
  const [text, setText]         = useState("");
  const [saving, setSaving]     = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Sort newest first
  const sorted = [...notes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  async function handleSave() {
    const content = text.trim();
    if (!content || saving || isMock) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/client-materials/${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type:    "therapist_notes",
          title:   "Р—Р°РјРµС‚РєРё РїСЃРёС…РѕР»РѕРіР°",
          content,
        }),
      });
      if (res.ok) {
        const m = await res.json() as ClientMaterial;
        onAdd(m);
        setText("");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("РЈРґР°Р»РёС‚СЊ СЌС‚Сѓ Р·Р°РјРµС‚РєСѓ?")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/client-materials/${clientId}/${id}`, { method: "DELETE" });
      onDelete?.(id);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5">

      {/* РќРѕРІР°СЏ Р·Р°РјРµС‚РєР° */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: S.bg, borderColor: S.border }}>
        <div className="flex items-center gap-2 px-5 py-4" style={{ background: "#F0EBE0", borderBottom: `1px solid ${S.divider}` }}>
          <NotebookPen size={14} style={{ color: S.muted }} />
          <span className="text-sm font-semibold" style={{ color: S.title }}>РќРѕРІР°СЏ Р·Р°РјРµС‚РєР°</span>
          <span className="text-xs ml-1" style={{ color: S.muted }}>вЂ” С‚РѕР»СЊРєРѕ РґР»СЏ РІР°СЃ, РЅРµ РѕС‚РїСЂР°РІР»СЏРµС‚СЃСЏ РІ AI</span>
        </div>
        <div className="px-5 py-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Р’Р°С€Рё РЅР°Р±Р»СЋРґРµРЅРёСЏ, РјС‹СЃР»Рё, РІР°Р¶РЅС‹Рµ РґРµС‚Р°Р»Рё Рѕ РєР»РёРµРЅС‚Рµ..."
            rows={4}
            className="w-full text-sm rounded-xl border px-4 py-3 resize-none focus:outline-none focus:ring-2"
            style={{
              background: "#FFFFFF",
              borderColor: S.border,
              color: S.title,
            }}
            onFocus={e => { e.currentTarget.style.borderColor = "#A8997F"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(168,153,127,0.15)"; }}
            onBlur={e  => { e.currentTarget.style.borderColor = S.border;  e.currentTarget.style.boxShadow = "none"; }}
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={handleSave}
              disabled={!text.trim() || saving || isMock}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
              style={{ background: "#4A3C2E", color: "#FFFFFF" }}
              onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = "#3A2E22"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#4A3C2E"; }}
            >
              <Plus size={14} />
              {saving ? "РЎРѕС…СЂР°РЅСЏСЋ..." : "Р”РѕР±Р°РІРёС‚СЊ Р·Р°РјРµС‚РєСѓ"}
            </button>
          </div>
        </div>
      </div>

      {/* РЎРїРёСЃРѕРє Р·Р°РјРµС‚РѕРє */}
      {sorted.length === 0 ? (
        <div className="rounded-2xl border py-12 text-center" style={{ background: S.bg, borderColor: S.border }}>
          <NotebookPen size={28} className="mx-auto mb-3" style={{ color: S.border }} />
          <p className="text-sm font-medium" style={{ color: S.title }}>Р—Р°РјРµС‚РѕРє РїРѕРєР° РЅРµС‚</p>
          <p className="text-xs max-w-xs mx-auto mt-1" style={{ color: S.muted }}>
            Р’Р°С€Рё Р»РёС‡РЅС‹Рµ РЅР°Р±Р»СЋРґРµРЅРёСЏ Рѕ РєР»РёРµРЅС‚Рµ вЂ” РЅРµ РІРёРґРЅС‹ AI Рё РЅРµ СѓС‡Р°СЃС‚РІСѓСЋС‚ РІ Р°РЅР°Р»РёР·Рµ
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ background: S.bg, borderColor: S.border }}>
          <div className="px-5 py-3" style={{ background: "#F0EBE0", borderBottom: `1px solid ${S.divider}` }}>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: S.muted }}>
              Р—Р°РјРµС‚РєРё РїСЃРёС…РѕР»РѕРіР° вЂ” {sorted.length} Р·Р°РїРёСЃРµР№
            </span>
          </div>

          {sorted.map((note, i) => {
            const isOpen   = expanded === note.id;
            const preview  = note.content.slice(0, 250);
            const hasMore  = note.content.length > 250;

            return (
              <div key={note.id}>
                {i > 0 && <div style={{ height: 1, background: S.divider }} />}
                <div className="px-5 py-4">
                  {/* Date + delete */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium" style={{ color: S.muted }}>
                      {formatDate(note.createdAt)}
                    </span>
                    {!isMock && (
                      <button
                        onClick={() => handleDelete(note.id)}
                        disabled={deletingId === note.id}
                        className="flex items-center justify-center rounded-lg transition-colors disabled:opacity-40"
                        style={{ width: 26, height: 26, color: S.muted }}
                        onMouseEnter={e => { e.currentTarget.style.color = "#EF4444"; e.currentTarget.style.background = "#FEE2E2"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = S.muted;  e.currentTarget.style.background = "transparent"; }}
                        title="РЈРґР°Р»РёС‚СЊ Р·Р°РјРµС‚РєСѓ"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  {/* Text */}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: S.title }}>
                    {isOpen ? note.content : preview}
                    {!isOpen && hasMore && <span style={{ color: S.muted }}>вЂ¦</span>}
                  </p>
                  {hasMore && (
                    <button
                      onClick={() => setExpanded(isOpen ? null : note.id)}
                      className="mt-2 flex items-center gap-1 text-xs font-medium transition-colors"
                      style={{ color: "#A8997F" }}
                      onMouseEnter={e => { e.currentTarget.style.color = "#6B5D4F"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = "#A8997F"; }}
                    >
                      {isOpen
                        ? <><ChevronUp size={11} /> РЎРІРµСЂРЅСѓС‚СЊ</>
                        : <><ChevronDown size={11} /> РџРѕРєР°Р·Р°С‚СЊ РїРѕР»РЅРѕСЃС‚СЊСЋ</>
                      }
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

