"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { FluidGame }          from "./games/FluidGame";
import { SoundsGame }         from "./games/SoundsGame";
import { ZenDropsGame }       from "./games/ZenDropsGame";
import { EmpathyGardenGame }  from "./games/EmpathyGardenGame";
import { InnerLightGame }     from "./games/InnerLightGame";

type Tab = "fluid" | "sounds" | "drops" | "garden" | "light";

interface TabInfo {
  id: Tab;
  label: string;
  sub: string;
  howTo: string;
  effect: string;
}

const TABS: TabInfo[] = [
  {
    id: "fluid", label: "Потоки", sub: "WebGL",
    howTo: "Зажмите кнопку мыши или коснитесь экрана и плавно водите — за вашим движением рождаются цветные шлейфы дыма, медленно растворяясь в темноте.",
    effect: "Инструмент быстрого «заземления». Помогает замедлить хаотичный бег мыслей и вернуться в состояние «здесь и сейчас».",
  },
  {
    id: "sounds", label: "Орбиты", sub: "Canvas",
    howTo: "Кликайте в любые точки экрана, чтобы создавать пульсирующие ноты. Кометы по орбитам сталкиваются с ними, извлекая чистые звуки. Шестерёнка вверху меняет инструмент.",
    effect: "Развивает слуховое и зрительное осознавание. Из хаоса движений складывается гармоничная звуковая структура, мягко снижая тревожность.",
  },
  {
    id: "drops", label: "Дзен-Капли", sub: "Physics",
    howTo: "Кликайте в верхней части экрана, чтобы отпускать цветные капли вниз. При соприкосновении одинаковые сферы плавно сливаются. Нет счёта, таймеров и ограничений.",
    effect: "Монотонное, предсказуемое действие без «синдрома достижения». Снимает ментальное напряжение, позволяя войти в лёгкое созерцательное состояние.",
  },
  {
    id: "garden", label: "Сад Эмпатии", sub: "Swarm",
    howTo: "Плавно водите курсором или пальцем, бережно собирая хаотичные звёздочки в светящийся рой. Донесите рой до корней дерева (нижняя светящаяся точка) — энергия уйдёт в землю и зажжёт неоновые цветы. Клик создаёт мощную гравитационную волну.",
    effect: "Метафора ассимиляции опыта. Сбор частиц — это направление внимания на рассеянные переживания, а их заземление у корней символизирует трансформацию хаоса в цветущий ресурс.",
  },
  {
    id: "light", label: "Внутренний Свет", sub: "Mandala",
    howTo: "Перетаскивайте светящиеся осколки из палитры на круглый холст. Каждое действие зеркально отражается по осям симметрии, создавая идеальный калейдоскоп под кристальные звуки.",
    effect: "Арт-терапевтическая практика центрирования. Помогает собрать «расколотое» состояние в единую симметричную точку, возвращая ощущение внутренней целостности.",
  },
];

interface Props {
  onClose?: () => void;
}

// Tooltip for a single tab
function TabTooltip({ info, visible }: { info: TabInfo; visible: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        left: "50%",
        transform: `translateX(-50%) translateY(${visible ? 0 : 6}px)`,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        transition: "opacity 0.22s ease, transform 0.22s ease",
        zIndex: 200,
        minWidth: 260,
        maxWidth: 320,
        background: "rgba(10,8,22,0.92)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(168,148,230,0.22)",
        borderRadius: 14,
        padding: "14px 16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        fontFamily: "-apple-system, sans-serif",
        textAlign: "left",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(168,148,230,0.65)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 7 }}>
        Как играть
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, marginBottom: 10 }}>
        {info.howTo}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(130,200,180,0.65)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
        Терапевтический эффект
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
        {info.effect}
      </div>
    </div>
  );
}

export function RelaxScene({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>("fluid");
  const [tooltipId, setTooltipId] = useState<Tab | null>(null);
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEsc = useCallback(() => { onClose?.(); }, [onClose]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") handleEsc(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [handleEsc]);

  function showTooltip(id: Tab) {
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    setTooltipId(id);
  }
  function hideTooltip() {
    tooltipTimeout.current = setTimeout(() => setTooltipId(null), 180);
  }
  function toggleTooltip(id: Tab) {
    setTooltipId(prev => prev === id ? null : id);
  }

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
      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
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
            <div key={t.id} style={{ position: "relative" }}>
              {/* Tab button */}
              <button
                onClick={() => setTab(t.id)}
                style={{
                  background: tab === t.id ? "rgba(168,148,230,0.22)" : "transparent",
                  border: tab === t.id
                    ? "1px solid rgba(168,148,230,0.35)"
                    : "1px solid transparent",
                  borderRadius: 20,
                  padding: "5px 10px 5px 14px",
                  cursor: "pointer",
                  transition: "all 0.22s",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
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
                </div>

                {/* ℹ️ Info trigger */}
                <span
                  role="button"
                  aria-label={`Инструкция: ${t.label}`}
                  onClick={e => { e.stopPropagation(); toggleTooltip(t.id); }}
                  onMouseEnter={e => { e.stopPropagation(); showTooltip(t.id); }}
                  onMouseLeave={e => { e.stopPropagation(); hideTooltip(); }}
                  style={{
                    width: 16, height: 16,
                    borderRadius: "50%",
                    border: `1px solid ${tooltipId === t.id ? "rgba(168,148,230,0.6)" : "rgba(255,255,255,0.18)"}`,
                    background: tooltipId === t.id ? "rgba(168,148,230,0.22)" : "rgba(255,255,255,0.05)",
                    color: tooltipId === t.id ? "rgba(168,148,230,0.9)" : "rgba(255,255,255,0.3)",
                    fontSize: 9,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    flexShrink: 0,
                    transition: "all 0.15s",
                    lineHeight: 1,
                    userSelect: "none",
                  }}
                >
                  i
                </span>
              </button>

              {/* Tooltip */}
              <TabTooltip info={t} visible={tooltipId === t.id} />
            </div>
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

      {/* ── Game area ────────────────────────────────────────────────────────── */}
      <div
        style={{ flex: 1, position: "relative", overflow: "hidden", marginTop: 8 }}
        onClick={() => setTooltipId(null)}
      >
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

        {tab === "garden" && (
          <div style={{ position: "absolute", inset: 0 }}>
            <EmpathyGardenGame />
          </div>
        )}

        {tab === "light" && (
          <div style={{ position: "absolute", inset: 0 }}>
            <InnerLightGame />
          </div>
        )}
      </div>
    </div>
  );
}
