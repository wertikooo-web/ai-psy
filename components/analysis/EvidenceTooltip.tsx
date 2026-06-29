"use client";

/**
 * EvidenceTooltip — small 🔍 icon with hover/focus/tap popover.
 *
 * Shows WHY an interpretive AI conclusion appeared in the analysis.
 * Primary content: `explanation` (rich 2–4 sentence prose).
 * Fallback for old analyses: `tooltip` bullet list.
 * Evidence quotes from `evidenceRefs` shown as supporting fragments.
 */

import { useState, useRef, useEffect, useId } from "react";
import { Search } from "lucide-react";
import type { EvidenceReference } from "@/lib/analysisBlocks";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtSeconds(s: number): string {
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

export function hasValidEvidenceTooltip(
  block: { isInterpretive?: boolean; evidenceTooltip?: unknown; explanation?: unknown },
): boolean {
  if (!block.isInterpretive) return false;
  if (typeof block.explanation === "string" && block.explanation.trim().length > 20) return true;
  if (!Array.isArray(block.evidenceTooltip)) return false;
  return block.evidenceTooltip.some(
    (s) => typeof s === "string" && s.trim().length > 0,
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  explanation?:  string;
  tooltip?:      string[];
  confidence?:   "high" | "medium" | "low";
  evidenceRefs?: EvidenceReference[];
}

export function EvidenceTooltip({ explanation, tooltip, confidence, evidenceRefs }: Props) {
  const [open, setOpen]   = useState(false);
  const btnRef            = useRef<HTMLButtonElement>(null);
  const popRef            = useRef<HTMLDivElement>(null);
  const tooltipId         = useId();

  const validLines = (tooltip ?? []).filter((s) => typeof s === "string" && s.trim().length > 0);
  const hasContent = (explanation && explanation.trim().length > 0) || validLines.length > 0;

  // Best evidence quotes (max 3, with actual quote text)
  const topRefs = (evidenceRefs ?? []).filter((r) => r.quote && r.quote.trim().length > 0).slice(0, 3);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btnRef.current?.focus(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!btnRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!hasContent) return null;

  const confidenceLabel =
    confidence === "high"   ? "Высокая уверенность"   :
    confidence === "medium" ? "Средняя уверенность"   :
    confidence === "low"    ? "Низкая уверенность"     : null;

  const confidenceColor =
    confidence === "high"   ? "#22C55E" :
    confidence === "medium" ? "#F59E0B" : "#94A3B8";

  const categoryLabel: Record<string, string> = {
    repeatedThemes:              "повт. тема",
    repeatedPhrases:             "повт. фраза",
    uncertaintyMarkers:          "неопределённость",
    possibleOffTopicAnswers:     "уход от темы",
    importantQuotes:             "значимый фрагмент",
    possibleTranscriptionIssues: "возм. ошибка транскр.",
  };

  return (
    <div style={{ position: "relative", display: "inline-block", lineHeight: 1 }}>
      {/* ── Trigger button ── */}
      <button
        ref={btnRef}
        aria-label="Показать объяснение вывода AI"
        aria-expanded={open}
        aria-controls={tooltipId}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={(e) => {
          if (popRef.current?.contains(e.relatedTarget as Node)) return;
          setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v) => !v); }
        }}
        style={{
          display:        "inline-flex",
          alignItems:     "center",
          justifyContent: "center",
          width:          22,
          height:         22,
          borderRadius:   "50%",
          border:         `1.5px solid ${open ? "#8B7355" : "#C9BBAA"}`,
          background:     open ? "#F0EBE3" : "transparent",
          color:          open ? "#8B7355" : "#B8A898",
          cursor:         "pointer",
          padding:        0,
          transition:     "border-color 0.15s, background 0.15s, color 0.15s",
          flexShrink:     0,
          outline:        "none",
        }}
        className="evidence-tooltip-btn"
      >
        <Search size={11} strokeWidth={2.5} aria-hidden />
      </button>

      {/* ── Popover ── */}
      {open && (
        <div
          id={tooltipId}
          ref={popRef}
          role="tooltip"
          onMouseLeave={(e) => {
            if (btnRef.current?.contains(e.relatedTarget as Node)) return;
            setOpen(false);
          }}
          style={{
            position:     "absolute",
            top:          "calc(100% + 8px)",
            right:        0,
            width:        360,
            maxWidth:     "min(360px, calc(100vw - 32px))",
            background:   "#FFFFFF",
            border:       "1px solid #E5DDD2",
            borderRadius: 12,
            boxShadow:    "0 4px 20px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)",
            padding:      "14px 16px",
            zIndex:       60,
          }}
        >
          {/* Arrow */}
          <div
            aria-hidden
            style={{
              position:    "absolute",
              top:         -5,
              right:       8,
              width:       9,
              height:      9,
              background:  "#FFFFFF",
              border:      "1px solid #E5DDD2",
              borderRight: "none",
              borderBottom:"none",
              transform:   "rotate(45deg)",
            }}
          />

          {/* Header */}
          <p style={{
            fontSize:      11,
            fontWeight:    700,
            color:         "#8B7355",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom:  10,
            marginTop:     0,
          }}>
            Как AI пришёл к этому выводу
          </p>

          {/* ── Primary content: explanation prose ── */}
          {explanation && explanation.trim().length > 0 ? (
            <p style={{
              fontSize:   13.5,
              color:      "#374151",
              lineHeight: 1.65,
              margin:     0,
              marginBottom: topRefs.length > 0 ? 12 : 0,
            }}>
              {explanation.trim()}
            </p>
          ) : (
            /* ── Fallback: legacy evidenceTooltip bullet list ── */
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: topRefs.length > 0 ? 10 : 0 }}>
              {validLines.map((line, i) => (
                <p key={i} style={{ fontSize: 13, color: "#475569", lineHeight: 1.55, margin: 0 }}>
                  {line}
                </p>
              ))}
            </div>
          )}

          {/* ── Evidence quotes ── */}
          {topRefs.length > 0 && (
            <div style={{
              borderTop:   "1px solid #F0EBE3",
              paddingTop:  10,
              marginTop:   explanation ? 0 : 0,
              display:     "flex",
              flexDirection: "column",
              gap:         6,
            }}>
              <p style={{
                fontSize:      10,
                fontWeight:    600,
                color:         "#A8997F",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                margin:        0,
                marginBottom:  4,
              }}>
                Из транскрипта
              </p>
              {topRefs.map((ref, i) => (
                <div key={i} style={{
                  background:   "#FAF8F5",
                  borderRadius: 6,
                  padding:      "6px 9px",
                  borderLeft:   "2px solid #D8CFBE",
                }}>
                  <p style={{
                    fontSize:   12.5,
                    color:      "#4B5563",
                    lineHeight: 1.5,
                    margin:     0,
                    fontStyle:  "italic",
                  }}>
                    «{ref.quote!.trim()}»
                  </p>
                  <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
                    {ref.startSeconds !== undefined && (
                      <span style={{ fontSize: 10, color: "#9CA3AF", fontVariantNumeric: "tabular-nums" }}>
                        {fmtSeconds(ref.startSeconds)}
                      </span>
                    )}
                    {ref.category && (
                      <span style={{ fontSize: 10, color: "#B8A898" }}>
                        {categoryLabel[ref.category] ?? ref.category}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Confidence badge ── */}
          {confidenceLabel && (
            <div style={{
              display:    "flex",
              alignItems: "center",
              gap:        5,
              marginTop:  10,
              paddingTop: 8,
              borderTop:  "1px solid #F0EBE3",
            }}>
              <span style={{
                display:      "inline-block",
                width:        6,
                height:       6,
                borderRadius: "50%",
                background:   confidenceColor,
                flexShrink:   0,
              }} />
              <span style={{ fontSize: 11, color: "#94A3B8" }}>{confidenceLabel}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
