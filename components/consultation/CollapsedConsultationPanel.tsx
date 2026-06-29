"use client";

import { useState } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";

// ── Shared collapsed-column width ─────────────────────────────────────────────
// All three consultation columns use this same value when collapsed.
export const COLLAPSED_COL_W = 48;

interface Props {
  label: string;
  icon: React.ReactNode;
  /** Background matching the panel's own expanded header */
  bg: string;
  /** Slightly darker shade for hover */
  hoverBg: string;
  /** Which direction the column expands into (drives the chevron) */
  expandDirection?: "right" | "left";
  onExpand: () => void;
  tooltip: string;
}

export function CollapsedConsultationPanel({
  label,
  icon,
  bg,
  hoverBg,
  expandDirection = "right",
  onExpand,
  tooltip,
}: Props) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onExpand}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onExpand(); } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={tooltip}
      style={{
        width: COLLAPSED_COL_W,
        flexShrink: 0,
        background: hovered ? hoverBg : bg,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
        transition: "background 150ms ease",
        outline: "none",
      }}
    >
      {/* ── Top zone: panel icon + expand chevron ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 14,
          paddingBottom: 6,
          gap: 5,
          flexShrink: 0,
        }}
      >
        {/* Panel-specific icon in a translucent pill, matching the expanded header */}
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: "rgba(255,255,255,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>

        {/* Small expand-direction chevron — separate from the icon */}
        {expandDirection === "right"
          ? <ChevronRight size={12} style={{ color: "rgba(255,255,255,0.60)", flexShrink: 0 }} />
          : <ChevronLeft  size={12} style={{ color: "rgba(255,255,255,0.60)", flexShrink: 0 }} />
        }
      </div>

      {/* ── Vertical label ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 0,
        }}
      >
        <span
          style={{
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.04em",
            color: "rgba(255,255,255,0.72)",
            userSelect: "none",
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
