"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type ActorType = "cat" | "human" | "car" | "dog" | "bike";
type Direction = "ltr" | "rtl";
type TimeMode  = "day" | "evening" | "night";

interface ActiveActor {
  id:        string;
  type:      ActorType;
  direction: Direction;
  durationS: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const rnd = (lo: number, hi: number) => Math.random() * (hi - lo) + lo;

function getTimeMode(): TimeMode {
  const h = new Date().getHours();
  if (h >= 21) return "evening";
  if (h < 6)   return "night";
  return "day";
}

function getLitCount(total: number, mode: TimeMode): number {
  if (mode === "day") return 0;
  const h = new Date().getHours();
  if (mode === "night") {
    if (h >= 2 && h < 5) return Math.floor(total * rnd(0.06, 0.12));
    return Math.floor(total * rnd(0.14, 0.22));
  }
  return Math.floor(total * rnd(0.28, 0.40));
}

// ─── Actor weights by time ────────────────────────────────────────────────────
const WEIGHTS: Record<TimeMode, Partial<Record<ActorType, number>>> = {
  day:     { cat: 35, human: 25, car: 25, dog: 10, bike: 5 },
  evening: { cat: 45, human: 30, car: 15, dog: 8,  bike: 2 },
  night:   { cat: 80, human: 15, car:  5 },
};

function weightedPick(weights: Partial<Record<ActorType, number>>): ActorType {
  const entries = Object.entries(weights) as [ActorType, number][];
  const total   = entries.reduce((s, [, w]) => s + w, 0);
  let   r       = Math.random() * total;
  for (const [type, w] of entries) { r -= w; if (r <= 0) return type; }
  return "cat";
}

// ─── Window grid (SVG viewBox 0 0 1400 520, street ≈ y 410) ──────────────────
interface WinDef { x: number; y: number; w: number; h: number; dur: number }

const WINDOWS: WinDef[] = (() => {
  const out: WinDef[] = [];
  // [startX, buildingW, topY, floors]
  const buildings: [number, number, number, number][] = [
    [18,   72,  95,  7], [108,  52, 145,  5], [178,  95,  65,  9],
    [290,  68, 115,  6], [375,  48, 165,  4], [440, 115,  58, 10],
    [575,  78, 100,  6], [668,  52, 155,  4], [738,  98,  78,  7],
    [860,  62, 130,  5], [940,  88,  92,  7], [1055, 72, 108,  6],
    [1142, 92,  72,  8], [1258, 78, 118,  5], [1358, 38, 148,  4],
  ];

  for (const [bx, bw, topY, floors] of buildings) {
    const perRow = Math.max(1, Math.floor((bw - 8) / 26));
    const ww     = Math.max(8, Math.floor((bw - 8 - (perRow - 1) * 6) / perRow));
    const wh     = 16;
    const fh     = 30;
    const xOff   = (bw - (perRow * ww + (perRow - 1) * 6)) / 2;

    for (let f = 0; f < floors; f++) {
      const y = topY + f * fh;
      if (y + wh > 390) continue;
      for (let w = 0; w < perRow; w++) {
        out.push({
          x:   bx + xOff + w * (ww + 6),
          y,
          w:   ww,
          h:   wh,
          dur: parseFloat(rnd(5, 14).toFixed(1)),
        });
      }
    }
  }
  return out;
})();

// ─── SVG Characters ───────────────────────────────────────────────────────────
// Colors: ~10-15% darker than city buildings (#c9c1b6)
const ACTOR_COLORS: Record<ActorType, string> = {
  cat:   "#bfb6aa",
  dog:   "#bfb6aa",
  human: "#c0b8ac",
  car:   "#c3bbaf",
  bike:  "#c0b8ac",
};
const SW = 1.8;

function SvgCat({ flip, c }: { flip: boolean; c: string }) {
  const g = (
    <g>
      <ellipse cx="22" cy="33" rx="15" ry="8"   stroke={c} strokeWidth={SW} fill="none"/>
      <circle  cx="34" cy="23" r="9"             stroke={c} strokeWidth={SW} fill="none"/>
      <path d="M28,16 L25,9  L31,15"             stroke={c} strokeWidth={1.4} fill="none" strokeLinejoin="round"/>
      <path d="M38,15 L42,9  L36,16"             stroke={c} strokeWidth={1.4} fill="none" strokeLinejoin="round"/>
      <circle cx="36" cy="22" r="1.2"            fill={c}/>
      <path d="M33,26 L35,28 L37,26"             stroke={c} strokeWidth={0.9} fill="none"/>
      <path d="M7,30 Q-2,21 1,11"                stroke={c} strokeWidth={SW} fill="none" strokeLinecap="round"/>
      <line x1="14" y1="41" x2="11" y2="51"     stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      <line x1="20" y1="41" x2="23" y2="51"     stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      <line x1="27" y1="41" x2="24" y2="51"     stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      <line x1="33" y1="41" x2="36" y2="51"     stroke={c} strokeWidth={SW} strokeLinecap="round"/>
    </g>
  );
  return flip ? <g transform="scale(-1,1) translate(-52,0)">{g}</g> : g;
}

function SvgDog({ flip, c }: { flip: boolean; c: string }) {
  const g = (
    <g>
      <ellipse cx="27" cy="34" rx="18" ry="10"  stroke={c} strokeWidth={SW} fill="none"/>
      <circle  cx="42" cy="21" r="10"            stroke={c} strokeWidth={SW} fill="none"/>
      <path d="M34,16 Q26,7  29,22"              stroke={c} strokeWidth={SW} fill="none" strokeLinecap="round"/>
      <path d="M49,16 Q58,7  56,22"              stroke={c} strokeWidth={SW} fill="none" strokeLinecap="round"/>
      <circle cx="46" cy="20" r="1.2"            fill={c}/>
      <ellipse cx="50" cy="25" rx="3" ry="2"     stroke={c} strokeWidth={1.4} fill="none"/>
      <path d="M9,28 Q-1,13 7,6"                 stroke={c} strokeWidth={SW} fill="none" strokeLinecap="round"/>
      <line x1="16" y1="44" x2="12" y2="55"     stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      <line x1="24" y1="44" x2="27" y2="55"     stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      <line x1="32" y1="44" x2="28" y2="55"     stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      <line x1="39" y1="44" x2="43" y2="55"     stroke={c} strokeWidth={SW} strokeLinecap="round"/>
    </g>
  );
  return flip ? <g transform="scale(-1,1) translate(-65,0)">{g}</g> : g;
}

function SvgHuman({ flip, c }: { flip: boolean; c: string }) {
  const g = (
    <g>
      <circle cx="20" cy="9"  r="8"              stroke={c} strokeWidth={SW} fill="none"/>
      <line x1="20" y1="17" x2="20" y2="44"     stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      <path d="M20,27 L8,37"                     stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      <path d="M20,27 L32,35"                    stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      <path d="M20,44 L13,60"                    stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      <path d="M20,44 L27,60"                    stroke={c} strokeWidth={SW} strokeLinecap="round"/>
    </g>
  );
  return flip ? <g transform="scale(-1,1) translate(-40,0)">{g}</g> : g;
}

function SvgCar({ flip, c }: { flip: boolean; c: string }) {
  const g = (
    <g>
      <path d="M4,30 L4,50 Q4,56 10,56 L96,56 Q102,56 102,50 L102,30 Z"
            stroke={c} strokeWidth={SW} fill="none"/>
      <path d="M18,30 L26,12 L76,12 L88,30"     stroke={c} strokeWidth={SW} fill="none" strokeLinejoin="round"/>
      <path d="M30,30 L36,14 L70,14 L78,30"     stroke={c} strokeWidth={1.4} fill="none"/>
      <circle cx="24" cy="56" r="9"              stroke={c} strokeWidth={SW} fill="none"/>
      <circle cx="78" cy="56" r="9"              stroke={c} strokeWidth={SW} fill="none"/>
      <circle cx="99" cy="38" r="3"              stroke={c} strokeWidth={1.4} fill="none"/>
    </g>
  );
  return flip ? <g transform="scale(-1,1) translate(-108,0)">{g}</g> : g;
}

function SvgBike({ flip, c }: { flip: boolean; c: string }) {
  const g = (
    <g>
      <circle cx="40" cy="11" r="7"              stroke={c} strokeWidth={SW} fill="none"/>
      <path d="M40,18 L44,38"                    stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      <path d="M40,27 L52,38"                    stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      <path d="M28,50 L44,33 L58,50 L28,50"     stroke={c} strokeWidth={SW} fill="none" strokeLinejoin="round"/>
      <path d="M52,38 L60,33 L65,35"             stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      <circle cx="17" cy="50" r="13"             stroke={c} strokeWidth={SW} fill="none"/>
      <circle cx="67" cy="50" r="13"             stroke={c} strokeWidth={SW} fill="none"/>
      <circle cx="43" cy="50" r="4"              stroke={c} strokeWidth={1.4} fill="none"/>
    </g>
  );
  return flip ? <g transform="scale(-1,1) translate(-84,0)">{g}</g> : g;
}

// ─── Actor display config ─────────────────────────────────────────────────────
// viewW/viewH = SVG coordinate space (internal drawing)
// dispH       = displayed pixel height (cat≈50, human≈65, car≈80 width-based)
const ACTOR_META: Record<ActorType, { viewW: number; viewH: number; dispH: number; bob: boolean }> = {
  cat:   { viewW: 52,  viewH: 58,  dispH: 50,  bob: true  },
  dog:   { viewW: 65,  viewH: 62,  dispH: 54,  bob: true  },
  human: { viewW: 44,  viewH: 68,  dispH: 65,  bob: true  },
  car:   { viewW: 112, viewH: 72,  dispH: 52,  bob: false },
  bike:  { viewW: 88,  viewH: 72,  dispH: 58,  bob: true  },
};

// Street bottom offsets (% from bottom of the image)
const BOTTOM_OFFSET: Record<ActorType, string> = {
  cat:   "9%",
  dog:   "9%",
  human: "9%",
  car:   "6%",
  bike:  "7%",
};

function ActorEl({ actor }: { actor: ActiveActor }) {
  const meta  = ACTOR_META[actor.type];
  const color = ACTOR_COLORS[actor.type];
  const flip  = actor.direction === "rtl";
  // Keep aspect ratio: dispW from dispH
  const dispW = Math.round(meta.dispH * (meta.viewW / meta.viewH));

  const moveStyle: React.CSSProperties = {
    position:   "absolute",
    bottom:     BOTTOM_OFFSET[actor.type],
    left:       0,
    animation:  `${actor.direction === "ltr" ? "cityMoveLtr" : "cityMoveRtl"} ${actor.durationS}s linear forwards`,
    willChange: "transform",
  };

  const bobStyle: React.CSSProperties = meta.bob
    ? { animation: `cityBob ${actor.type === "bike" ? "0.38s" : "0.52s"} ease-in-out infinite` }
    : { animation: `cityRoll 0.65s ease-in-out infinite` };

  return (
    <div className="city-actor" style={moveStyle}>
      <svg
        viewBox={`0 0 ${meta.viewW} ${meta.viewH}`}
        width={dispW}
        height={meta.dispH}
        aria-hidden
        style={bobStyle}
      >
        {actor.type === "cat"   && <SvgCat   flip={flip} c={color}/>}
        {actor.type === "dog"   && <SvgDog   flip={flip} c={color}/>}
        {actor.type === "human" && <SvgHuman flip={flip} c={color}/>}
        {actor.type === "car"   && <SvgCar   flip={flip} c={color}/>}
        {actor.type === "bike"  && <SvgBike  flip={flip} c={color}/>}
      </svg>
    </div>
  );
}

// ─── City tint overlay (evening / night) ─────────────────────────────────────
function CityTint({ mode }: { mode: TimeMode }) {
  if (mode === "day") return null;
  const color = mode === "evening"
    ? "rgba(200, 140, 60, 0.08)"
    : "rgba(40, 30, 20, 0.18)";
  return (
    <div
      aria-hidden
      style={{
        position:   "absolute",
        inset:      0,
        background: color,
        pointerEvents: "none",
        transition: "background 2s ease",
      }}
    />
  );
}

// ─── Window lights SVG overlay ───────────────────────────────────────────────
function CityWindows({ litSet, mode }: { litSet: Set<number>; mode: TimeMode }) {
  if (mode === "day" || litSet.size === 0) return null;
  return (
    <svg
      viewBox="0 0 1400 520"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden
      style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      {WINDOWS.map((w, i) => {
        if (!litSet.has(i)) return null;
        const animName = i % 3 === 0 ? "windowFlicker" : "windowGlow";
        return (
          <rect
            key={i}
            x={w.x} y={w.y} width={w.w} height={w.h}
            rx="2"
            fill="rgba(255,195,90,0.48)"
            className="city-window"
            style={{ animation: `${animName} ${w.dur}s ease-in-out infinite` }}
          />
        );
      })}
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function AnimatedCityScene() {
  const [timeMode,      setTimeMode]      = useState<TimeMode>("day");
  const [litSet,        setLitSet]        = useState<Set<number>>(new Set());
  const [actor,         setActor]         = useState<ActiveActor | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const h = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  // Init time mode (client-side only)
  useEffect(() => {
    setTimeMode(getTimeMode());
    const id = setInterval(() => setTimeMode(getTimeMode()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Recalculate lit windows when mode changes
  useEffect(() => {
    const count = getLitCount(WINDOWS.length, timeMode);
    const shuffled = [...Array(WINDOWS.length).keys()].sort(() => Math.random() - 0.5);
    setLitSet(new Set(shuffled.slice(0, count)));
  }, [timeMode]);

  // Actor spawn loop
  const spawnNext = useCallback(() => {
    const delay = rnd(18_000, 45_000);
    timerRef.current = setTimeout(() => {
      const mode      = getTimeMode();
      const type      = weightedPick(WEIGHTS[mode]);
      const direction: Direction = Math.random() > 0.5 ? "ltr" : "rtl";
      const durationS = parseFloat(rnd(10, 22).toFixed(1));

      setActor({ id: crypto.randomUUID(), type, direction, durationS });

      actorTimer.current = setTimeout(() => {
        setActor(null);
        spawnNext();
      }, durationS * 1000 + 800);
    }, delay);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    // First appearance: 6–16 seconds after mount
    timerRef.current = setTimeout(() => spawnNext(), rnd(6_000, 16_000));
    return () => {
      if (timerRef.current)   clearTimeout(timerRef.current);
      if (actorTimer.current) clearTimeout(actorTimer.current);
    };
  }, [reducedMotion, spawnNext]);

  // City PNG opacity by time
  const cityOpacity = timeMode === "day" ? 0.55 : timeMode === "evening" ? 0.65 : 0.42;

  return (
    <div
      aria-hidden
      style={{
        position:       "absolute",
        bottom:         0,
        left:           0,
        width:          "100%",
        pointerEvents:  "none",
        zIndex:         0,
        marginBottom:   "-2%",
      }}
    >
      {/* Static city PNG */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/city.png"
        alt=""
        aria-hidden
        className="pointer-events-none select-none w-full block"
        style={{
          opacity:    cityOpacity,
          transition: "opacity 3s ease",
        }}
      />

      {/* Evening/night tint */}
      <CityTint mode={timeMode} />

      {/* Window lights */}
      <CityWindows litSet={litSet} mode={timeMode} />

      {/* Animated characters — positioned relative to this container */}
      <div style={{ position: "absolute", inset: 0 }}>
        {actor && !reducedMotion && <ActorEl key={actor.id} actor={actor} />}
      </div>
    </div>
  );
}
