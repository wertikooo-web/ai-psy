"use client";

import { useState, useCallback, useEffect } from "react";
import { X } from "lucide-react";
import { FluidGame } from "./games/FluidGame";
import { SoundsGame } from "./games/SoundsGame";
import { ZenDropsGame } from "./games/ZenDropsGame";

type Tab = "fluid" | "sounds" | "drops";

const TABS: { id: Tab; label: string; sub: string }[] = [
  { id: "fluid",  label: "Потоки",    sub: "WebGL" },
  { id: "sounds", label: "Звуки",     sub: "Canvas" },
  { id: "drops",  label: "Дзен-Капли", sub: "Physics" },
];

interface Props {
  /** If provided, renders a close button that calls this */
  onClose?: () => void;
}

export function RelaxScene({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>("fluid");

  const handleEsc = useCallback(() => {
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleEsc();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleEsc]);

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
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "10px 16px 0",
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        {/* Tab switcher */}
        <div
          style={{
            display: "flex",
            background: "rgba(255,255,255,0.05)",
            borderRadius: 24,
            padding: 3,
            gap: 2,
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: tab === t.id
                  ? "rgba(168,148,230,0.22)"
                  : "transparent",
                border: tab === t.id
                  ? "1px solid rgba(168,148,230,0.35)"
                  : "1px solid transparent",
                borderRadius: 20,
                padding: "5px 16px",
                cursor: "pointer",
                transition: "all 0.22s",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: tab === t.id ? "#D4C8F0" : "rgba(255,255,255,0.4)",
                  letterSpacing: "0.03em",
                  lineHeight: 1,
                  transition: "color 0.2s",
                }}
              >
                {t.label}
              </span>
              <span
                style={{
                  fontSize: 9,
                  color: tab === t.id ? "rgba(168,148,230,0.7)" : "rgba(255,255,255,0.18)",
                  letterSpacing: "0.08em",
                  lineHeight: 1,
                  textTransform: "uppercase",
                  transition: "color 0.2s",
                }}
              >
                {t.sub}
              </span>
            </button>
          ))}
        </div>

        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            title="Закрыть (Esc)"
            style={{
              position: "absolute",
              right: 16,
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

      {/* ── Game area ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", marginTop: 8 }}>
        {/* Fluid — always mounted to keep WebGL context alive while on this tab */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: tab === "fluid" ? "block" : "none",
          }}
        >
          <FluidGame onEsc={handleEsc} />
        </div>

        {/* Sounds */}
        {tab === "sounds" && (
          <div style={{ position: "absolute", inset: 0 }}>
            <SoundsGame />
          </div>
        )}

        {/* Zen Drops */}
        {tab === "drops" && (
          <div style={{ position: "absolute", inset: 0 }}>
            <ZenDropsGame />
          </div>
        )}
      </div>
    </div>
  );
}
