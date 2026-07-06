"use client";

import { useState, useCallback, useEffect } from "react";
import { X } from "lucide-react";
import { FluidGame }    from "./games/FluidGame";
import { SoundsGame }   from "./games/SoundsGame";
import { ZenDropsGame } from "./games/ZenDropsGame";
import { TheWayGame }   from "./games/TheWayGame";

type Tab = "fluid" | "sounds" | "drops" | "theway";

const TABS: { id: Tab; label: string; sub: string }[] = [
  { id: "fluid",  label: "Flows",       sub: "WebGL"   },
  { id: "sounds", label: "Orbitals",    sub: "Canvas"  },
  { id: "drops",  label: "Zen Droplets", sub: "Physics" },
  { id: "theway", label: "The Way",     sub: "Swarm"   },
];

interface Props {
  onClose?: () => void;
}

export function RelaxScene({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>("fluid");

  const handleEsc = useCallback(() => { onClose?.(); }, [onClose]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") handleEsc(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [handleEsc]);

  const immersive = tab === "theway";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#0a0a0f",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* ── Top bar — hidden in immersive mode ───────────────────────────────── */}
      {!immersive && (
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "10px 52px 0",
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            background: "rgba(255,255,255,0.05)",
            borderRadius: 24,
            padding: 3,
            gap: 2,
            border: "1px solid rgba(255,255,255,0.07)",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: tab === t.id ? "rgba(168,148,230,0.22)" : "transparent",
                border: tab === t.id
                  ? "1px solid rgba(168,148,230,0.35)"
                  : "1px solid transparent",
                borderRadius: 20,
                padding: "5px 14px",
                cursor: "pointer",
                transition: "all 0.22s",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
              }}
            >
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: tab === t.id ? "#D4C8F0" : "rgba(255,255,255,0.4)",
                letterSpacing: "0.03em",
                lineHeight: 1,
                transition: "color 0.2s",
                whiteSpace: "nowrap",
              }}>
                {t.label}
              </span>
              <span style={{
                fontSize: 9,
                color: tab === t.id ? "rgba(168,148,230,0.7)" : "rgba(255,255,255,0.18)",
                letterSpacing: "0.08em",
                lineHeight: 1,
                textTransform: "uppercase",
                transition: "color 0.2s",
              }}>
                {t.sub}
              </span>
            </button>
          ))}
        </div>

        {/* Close */}
        {onClose && (
          <button
            onClick={onClose}
            title="Close (Esc)"
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "50%",
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "rgba(255,255,255,0.45)",
              transition: "all 0.18s",
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.12)";
              (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.85)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
              (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.45)";
            }}
          >
            <X size={15} />
          </button>
        )}
      </div>
      )}

      {/* ── Game area ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", marginTop: immersive ? 0 : 8 }}>
        {/* Flows — always mounted (keeps WebGL alive) */}
        <div style={{ position: "absolute", inset: 0, display: tab === "fluid" ? "block" : "none" }}>
          <FluidGame onEsc={handleEsc} />
        </div>

        {tab === "sounds" && (
          <div style={{ position: "absolute", inset: 0 }}>
            <SoundsGame />
          </div>
        )}

        {tab === "drops" && (
          <div style={{ position: "absolute", inset: 0 }}>
            <ZenDropsGame />
          </div>
        )}

        {tab === "theway" && (
          <div style={{ position: "absolute", inset: 0 }}>
            <TheWayGame onBack={() => setTab("fluid")} />
          </div>
        )}
      </div>
    </div>
  );
}
