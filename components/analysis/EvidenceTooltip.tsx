"use client";

/**
 * EvidenceTooltip — small 🔍 icon with hover/focus/tap popover.
 *
 * Shows WHY an interpretive AI conclusion appeared in the analysis.
 * Never shows raw JSON, evidenceRefs, or transcript text.
 */

import { useState, useRef, useEffect, useId } from "react";
import { Search } from "lucide-react";
import type { EvidenceReference } from "@/lib/analysisBlocks";

// ── Helper ────────────────────────────────────────────────────────────────────

export function hasValidEvidenceTooltip(
  block: { isInterpretive?: boolean; evidenceTooltip?: unknown },
): boolean {
  if (!block.isInterpretive) return false;
  if (!Array.isArray(block.evidenceTooltip)) return false;
  return block.evidenceTooltip.some(
    (s) => typeof s === "string" && s.trim().length > 0,
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  tooltip:      string[];
  confidence?:  "high" | "medium" | "low";
  evidenceRefs?: EvidenceReference[];   // kept for future Step 4; not shown in UI yet
}

export function EvidenceTooltip({ tooltip, confidence }: Props) {
  const [open, setOpen]   = useState(false);
  const btnRef            = useRef<HTMLButtonElement>(null);
  const popRef            = useRef<HTMLDivElement>(null);
  const tooltipId         = useId();

  const validLines = tooltip.filter((s) => typeof s === "string" && s.trim().length > 0);

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

  if (validLines.length === 0) return null;

  const confidenceLabel =
    confidence === "high"   ? "● Высокая уверенность"   :
    confidence === "medium" ? "● Средняя уверенность"   :
    confidence === "low"    ? "● Низкая уверенность"     : null;

  const confidenceColor =
    confidence === "high"   ? "#22C55E" :
    confidence === "medium" ? "#F59E0B" : "#94A3B8";

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
        /* focus ring via pseudo-class can't be set inline; use className */
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
            width:        320,
            maxWidth:     "min(320px, calc(100vw - 32px))",
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

          {/* Tooltip lines */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {validLines.map((line, i) => (
              <p key={i} style={{ fontSize: 13, color: "#475569", lineHeight: 1.55, margin: 0 }}>
                {line}
              </p>
            ))}
          </div>

          {/* Confidence badge */}
          {confidenceLabel && (
            <p style={{
              marginTop:   10,
              marginBottom: 0,
              paddingTop:  8,
              borderTop:   "1px solid #F0EBE3",
              fontSize:    11,
              fontWeight:  600,
              color:       confidenceColor,
            }}>
              {confidenceLabel}
            </p>
          )}

          {/* Attribution */}
          <p style={{
            fontSize:    10,
            color:       "#B8A898",
            marginTop:   10,
            marginBottom: 0,
          }}>
            Основано на данных сессии и речевых паттернах
          </p>
        </div>
      )}
    </div>
  );
}
