"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { X, Sparkles, RotateCcw, Info } from "lucide-react";

export function FluidSimOverlay({ onClose }: { onClose: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady]     = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hint, setHint]       = useState(false);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // ESC key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Listen for iframe ready message
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "FLUID_READY") setReady(true);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const handleSplash = () => {
    iframeRef.current?.contentWindow?.postMessage({ type: "SPLASH" }, "*");
    setMenuOpen(false);
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "#0a0a0f", overflow: "hidden",
      }}
    >
      {/* ── Top hint bar ───────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 2,
          padding: "13px 16px",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "linear-gradient(to bottom, rgba(10,10,15,0.9) 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      >
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, letterSpacing: "0.02em" }}>
          Нажмите{" "}
          <kbd style={{
            color: "rgba(200,200,255,0.55)",
            background: "rgba(140,140,255,0.1)",
            border: "1px solid rgba(140,140,255,0.18)",
            borderRadius: 4, padding: "1px 7px",
            fontSize: 11, fontFamily: "ui-monospace, monospace",
          }}>ESC</kbd>
          {" "}для возврата
        </span>

        <button
          onClick={handleClose}
          style={{
            position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8, width: 34, height: 34,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "rgba(255,255,255,0.38)",
            pointerEvents: "auto", transition: "all 150ms",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.12)";
            e.currentTarget.style.color = "rgba(255,255,255,0.65)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            e.currentTarget.style.color = "rgba(255,255,255,0.38)";
          }}
        >
          <X size={15} />
        </button>
      </div>

      {/* ── Game iframe ─────────────────────────────────────────────── */}
      <iframe
        ref={iframeRef}
        src="/relax/fluid/index.html"
        style={{
          width: "100%", height: "100%",
          border: "none", display: "block",
          opacity: ready ? 1 : 0,
          transition: "opacity 0.6s ease",
        }}
        allow="fullscreen"
        title="Fluid Simulation"
      />

      {/* Loading indicator */}
      {!ready && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 1,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 14,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "2px solid rgba(168,148,230,0.2)",
            borderTop: "2px solid rgba(168,148,230,0.7)",
            animation: "spin 0.9s linear infinite",
          }} />
          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
            Загрузка симуляции...
          </span>
        </div>
      )}

      {/* ── Bottom hint ─────────────────────────────────────────────── */}
      <div style={{
        position: "absolute", bottom: 20, left: 0, right: 0,
        textAlign: "center",
        color: "rgba(255,255,255,0.16)", fontSize: 12, pointerEvents: "none",
        letterSpacing: "0.02em",
        transition: "opacity 0.4s",
        opacity: ready ? 1 : 0,
      }}>
        <span className="md:hidden">Касайтесь экрана для создания потоков</span>
        <span className="hidden md:inline">Двигайте мышью · Кликайте для выплесков</span>
      </div>

      {/* ── In-game menu (bottom-right) ─────────────────────────────── */}
      {ready && (
        <div style={{ position: "absolute", bottom: 20, right: 16, zIndex: 3 }}>
          {/* Menu panel */}
          {menuOpen && (
            <div
              style={{
                position: "absolute", bottom: "calc(100% + 8px)", right: 0,
                background: "rgba(18,18,28,0.88)",
                border: "1px solid rgba(150,150,220,0.15)",
                borderRadius: 12,
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                padding: "10px",
                minWidth: 200,
                boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
              }}
            >
              <div style={{ marginBottom: 8, padding: "0 4px" }}>
                <div style={{ color: "rgba(200,200,255,0.7)", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Fluid Simulation
                </div>
                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 2 }}>
                  Game 1 · WebGL
                </div>
              </div>

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                <MenuBtn icon={<Sparkles size={13} />} label="Новые всплески" onClick={handleSplash} />
                <MenuBtn
                  icon={<Info size={13} />}
                  label={hint ? "Скрыть подсказку" : "Как играть"}
                  onClick={() => setHint(h => !h)}
                />
              </div>
            </div>
          )}

          {/* Info hint card */}
          {hint && (
            <div style={{
              position: "absolute", bottom: "calc(100% + 8px)", right: 220,
              background: "rgba(18,18,28,0.88)",
              border: "1px solid rgba(150,150,220,0.15)",
              borderRadius: 12,
              backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
              padding: "12px 14px", width: 200,
              boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
            }}>
              <div style={{ color: "rgba(200,200,255,0.7)", fontSize: 11, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Управление
              </div>
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, lineHeight: 1.7 }}>
                🖱 Двигайте мышью — потоки<br />
                🖱 Кликайте — выплески цвета<br />
                📱 Касайтесь пальцем<br />
                ✨ Несколько пальцев сразу
              </div>
            </div>
          )}

          {/* Toggle button */}
          <button
            onClick={() => setMenuOpen(m => !m)}
            style={{
              background: menuOpen ? "rgba(150,140,255,0.15)" : "rgba(255,255,255,0.07)",
              border: `1px solid ${menuOpen ? "rgba(150,140,255,0.25)" : "rgba(255,255,255,0.1)"}`,
              borderRadius: 10, width: 38, height: 38,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
              color: menuOpen ? "rgba(180,170,255,0.8)" : "rgba(255,255,255,0.35)",
              transition: "all 200ms",
            }}
            onMouseEnter={(e) => {
              if (!menuOpen) {
                e.currentTarget.style.background = "rgba(255,255,255,0.12)";
                e.currentTarget.style.color = "rgba(255,255,255,0.6)";
              }
            }}
            onMouseLeave={(e) => {
              if (!menuOpen) {
                e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                e.currentTarget.style.color = "rgba(255,255,255,0.35)";
              }
            }}
            title="Меню игры"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function MenuBtn({
  icon, label, onClick,
}: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 8,
        padding: "7px 8px", borderRadius: 8,
        background: "transparent", border: "none",
        color: "rgba(255,255,255,0.55)", cursor: "pointer",
        fontSize: 13, textAlign: "left",
        transition: "all 150ms",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(150,140,255,0.12)";
        e.currentTarget.style.color = "rgba(220,215,255,0.85)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "rgba(255,255,255,0.55)";
      }}
    >
      <span style={{ opacity: 0.7 }}>{icon}</span>
      {label}
    </button>
  );
}
