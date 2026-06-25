"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type ActorType    = "cat" | "human" | "car" | "dog" | "bike" | "bird";
type Direction    = "ltr" | "rtl";
type TimeMode     = "day" | "evening" | "night";
type GroundLevel  = 0 | 1 | 2; // 0=near, 1=mid, 2=far

interface ActiveActor {
  id:            string;
  type:          ActorType;
  direction:     Direction;
  durationS:     number;
  level:         GroundLevel | "sky";
  skyBottom?:    string;  // birds: e.g. "48%"
  stopFraction?: number;  // cat only
  pauseMs?:      number;  // cat only
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
  if (mode === "night") return Math.floor(total * (h >= 2 && h < 5 ? rnd(0.06, 0.12) : rnd(0.14, 0.22)));
  return Math.floor(total * rnd(0.28, 0.40));
}

// ─── Actor config ─────────────────────────────────────────────────────────────
const WEIGHTS: Record<TimeMode, Partial<Record<ActorType, number>>> = {
  day:     { cat: 30, human: 25, car: 25, dog: 12, bike: 8 },
  evening: { cat: 40, human: 30, car: 15, dog: 10, bike: 5 },
  night:   { cat: 75, human: 20, car: 5 },
};
function weightedPick(w: Partial<Record<ActorType, number>>): ActorType {
  const e = Object.entries(w) as [ActorType, number][];
  let r = Math.random() * e.reduce((s, [, v]) => s + v, 0);
  for (const [t, v] of e) { r -= v; if (r <= 0) return t; }
  return "cat";
}

const ACTOR_META: Record<ActorType, { viewW:number; viewH:number; dispH:number; bob:boolean }> = {
  cat:   { viewW:52,  viewH:58, dispH:50, bob:true  },
  dog:   { viewW:65,  viewH:62, dispH:54, bob:true  },
  human: { viewW:44,  viewH:68, dispH:65, bob:true  },
  car:   { viewW:112, viewH:72, dispH:52, bob:false },
  bike:  { viewW:88,  viewH:72, dispH:58, bob:true  },
  bird:  { viewW:24,  viewH:14, dispH:14, bob:false },
};
const ACTOR_COLORS: Record<ActorType, string> = {
  cat:"#bfb6aa", dog:"#bfb6aa", human:"#c0b8ac",
  car:"#c3bbaf", bike:"#c0b8ac", bird:"#c8c0b4",
};
const BOTTOM_BASE: Record<ActorType, number> = {
  cat:28, dog:28, human:26, car:18, bike:20, bird:0,
};

// Level depth config (0=near/large, 2=far/small)
const LEVEL_CFG: Record<GroundLevel, { extraBottom:number; scale:number }> = {
  0: { extraBottom: 0,  scale: 1.00 },
  1: { extraBottom: 13, scale: 0.86 },
  2: { extraBottom: 24, scale: 0.73 },
};

// ─── Window grid ──────────────────────────────────────────────────────────────
interface WinDef { x:number; y:number; w:number; h:number; dur:number }
const WINDOWS: WinDef[] = (() => {
  const out: WinDef[] = [];
  const buildings: [number,number,number,number][] = [
    [18,72,95,7],[108,52,145,5],[178,95,65,9],[290,68,115,6],[375,48,165,4],
    [440,115,58,10],[575,78,100,6],[668,52,155,4],[738,98,78,7],[860,62,130,5],
    [940,88,92,7],[1055,72,108,6],[1142,92,72,8],[1258,78,118,5],[1358,38,148,4],
  ];
  for (const [bx,bw,topY,floors] of buildings) {
    const perRow = Math.max(1, Math.floor((bw-8)/26));
    const ww = Math.max(8, Math.floor((bw-8-(perRow-1)*6)/perRow));
    const xOff = (bw-(perRow*ww+(perRow-1)*6))/2;
    for (let f=0;f<floors;f++) {
      const y=topY+f*30;
      if (y+16>390) continue;
      for (let w=0;w<perRow;w++)
        out.push({x:bx+xOff+w*(ww+6),y,w:ww,h:16,dur:parseFloat(rnd(5,14).toFixed(1))});
    }
  }
  return out;
})();

// ─── Style helpers ────────────────────────────────────────────────────────────
const legG = (anim: string): React.CSSProperties => ({
  transformBox:    "fill-box" as React.CSSProperties["transformBox"],
  transformOrigin: "50% 0%",
  animation:       anim,
});
const wheelG = (dur = "1.6s"): React.CSSProperties => ({
  transformBox:    "fill-box" as React.CSSProperties["transformBox"],
  transformOrigin: "50% 50%",
  animation:       `wheelSpin ${dur} linear infinite`,
});
const wingG = (side: "L"|"R", pivotX: string): React.CSSProperties => ({
  transformBox:    "fill-box" as React.CSSProperties["transformBox"],
  transformOrigin: `${pivotX} 100%`,
  animation:       `birdWing${side} 0.32s ease-in-out infinite`,
});

const SW = 1.8;

// ─── SVG Characters ───────────────────────────────────────────────────────────
function SvgCat({ flip, c, isLooking }: { flip:boolean; c:string; isLooking:boolean }) {
  const wa = isLooking ? "none" : undefined;
  const g = (
    <g>
      <ellipse cx="22" cy="33" rx="15" ry="8"  stroke={c} strokeWidth={SW} fill="none"/>
      <circle  cx="34" cy="23" r="9"           stroke={c} strokeWidth={SW} fill="none"/>
      <path d="M28,16 L25,9 L31,15"            stroke={c} strokeWidth={1.3} fill="none" strokeLinejoin="round"/>
      <path d="M38,15 L42,9 L36,16"            stroke={c} strokeWidth={1.3} fill="none" strokeLinejoin="round"/>
      {isLooking ? (
        <>
          <circle cx="30" cy="22" r="1.6"      fill={c}/>
          <circle cx="38" cy="22" r="1.6"      fill={c}/>
          <path d="M33,26 L34,28 L35,26"       stroke={c} strokeWidth={0.9} fill="none"/>
          <line x1="22" y1="24" x2="29" y2="25.5" stroke={c} strokeWidth={0.8} strokeLinecap="round"/>
          <line x1="39" y1="25.5" x2="46" y2="24"  stroke={c} strokeWidth={0.8} strokeLinecap="round"/>
        </>
      ) : (
        <>
          <circle cx="36" cy="22" r="1.2"      fill={c}/>
          <path d="M33,26 L35,28 L37,26"       stroke={c} strokeWidth={0.9} fill="none"/>
        </>
      )}
      <g style={{ transformBox:"fill-box" as React.CSSProperties["transformBox"], transformOrigin:"100% 100%", animation:"catTail 1.4s ease-in-out infinite" }}>
        <path d="M7,30 Q-2,21 1,11"            stroke={c} strokeWidth={SW} fill="none" strokeLinecap="round"/>
      </g>
      <g style={legG(wa ?? "catLegB 0.42s ease-in-out infinite")}>
        <line x1="14" y1="41" x2="11" y2="52" stroke={c} strokeWidth={SW} strokeLinecap="round"/>
        <line x1="21" y1="41" x2="24" y2="52" stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      </g>
      <g style={legG(wa ?? "catLegF 0.42s ease-in-out infinite")}>
        <line x1="27" y1="41" x2="24" y2="52" stroke={c} strokeWidth={SW} strokeLinecap="round"/>
        <line x1="34" y1="41" x2="37" y2="52" stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      </g>
    </g>
  );
  return flip ? <g transform="scale(-1,1) translate(-52,0)">{g}</g> : g;
}

function SvgDog({ flip, c }: { flip:boolean; c:string }) {
  const g = (
    <g>
      <ellipse cx="27" cy="34" rx="18" ry="10" stroke={c} strokeWidth={SW} fill="none"/>
      <circle  cx="42" cy="21" r="10"           stroke={c} strokeWidth={SW} fill="none"/>
      <path d="M34,16 Q26,7 29,22"              stroke={c} strokeWidth={SW} fill="none" strokeLinecap="round"/>
      <path d="M49,16 Q58,7 56,22"              stroke={c} strokeWidth={SW} fill="none" strokeLinecap="round"/>
      <circle cx="46" cy="20" r="1.2"           fill={c}/>
      <ellipse cx="50" cy="25" rx="3" ry="2"    stroke={c} strokeWidth={1.4} fill="none"/>
      <g style={{ transformBox:"fill-box" as React.CSSProperties["transformBox"], transformOrigin:"100% 100%", animation:"dogTail 0.5s ease-in-out infinite" }}>
        <path d="M9,28 Q-1,13 7,6"              stroke={c} strokeWidth={SW} fill="none" strokeLinecap="round"/>
      </g>
      <g style={legG("dogLegB 0.44s ease-in-out infinite")}>
        <line x1="16" y1="44" x2="12" y2="55"  stroke={c} strokeWidth={SW} strokeLinecap="round"/>
        <line x1="24" y1="44" x2="27" y2="55"  stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      </g>
      <g style={legG("dogLegF 0.44s ease-in-out infinite")}>
        <line x1="32" y1="44" x2="28" y2="55"  stroke={c} strokeWidth={SW} strokeLinecap="round"/>
        <line x1="39" y1="44" x2="43" y2="55"  stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      </g>
    </g>
  );
  return flip ? <g transform="scale(-1,1) translate(-65,0)">{g}</g> : g;
}

function SvgHuman({ flip, c }: { flip:boolean; c:string }) {
  const g = (
    <g>
      <circle cx="20" cy="9" r="8"             stroke={c} strokeWidth={SW} fill="none"/>
      <line x1="20" y1="17" x2="20" y2="44"   stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      <g style={legG("humanArmB 0.50s ease-in-out infinite")}>
        <path d="M20,27 L8,38"                 stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      </g>
      <g style={legG("humanArmF 0.50s ease-in-out infinite")}>
        <path d="M20,27 L32,36"                stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      </g>
      <g style={legG("humanLegB 0.50s ease-in-out infinite")}>
        <path d="M20,44 L13,60"                stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      </g>
      <g style={legG("humanLegF 0.50s ease-in-out infinite")}>
        <path d="M20,44 L27,60"                stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      </g>
    </g>
  );
  return flip ? <g transform="scale(-1,1) translate(-40,0)">{g}</g> : g;
}

function SvgCar({ flip, c }: { flip:boolean; c:string }) {
  const g = (
    <g>
      <path d="M4,30 L4,50 Q4,56 10,56 L96,56 Q102,56 102,50 L102,30 Z"
            stroke={c} strokeWidth={SW} fill="none"/>
      <path d="M18,30 L26,12 L76,12 L88,30"   stroke={c} strokeWidth={SW} fill="none" strokeLinejoin="round"/>
      <path d="M30,30 L36,14 L70,14 L78,30"   stroke={c} strokeWidth={1.3} fill="none"/>
      <circle cx="99" cy="38" r="3"            stroke={c} strokeWidth={1.3} fill="none"/>
      <g style={wheelG()}>
        <circle cx="24" cy="56" r="9"          stroke={c} strokeWidth={SW} fill="none"/>
        <line x1="24" y1="47" x2="24" y2="65" stroke={c} strokeWidth={0.9} strokeLinecap="round"/>
        <line x1="15" y1="56" x2="33" y2="56" stroke={c} strokeWidth={0.9} strokeLinecap="round"/>
        <line x1="18" y1="50" x2="30" y2="62" stroke={c} strokeWidth={0.9} strokeLinecap="round"/>
        <line x1="30" y1="50" x2="18" y2="62" stroke={c} strokeWidth={0.9} strokeLinecap="round"/>
        <circle cx="24" cy="56" r="2.5"        stroke={c} strokeWidth={1.2} fill="none"/>
      </g>
      <g style={wheelG()}>
        <circle cx="78" cy="56" r="9"          stroke={c} strokeWidth={SW} fill="none"/>
        <line x1="78" y1="47" x2="78" y2="65" stroke={c} strokeWidth={0.9} strokeLinecap="round"/>
        <line x1="69" y1="56" x2="87" y2="56" stroke={c} strokeWidth={0.9} strokeLinecap="round"/>
        <line x1="72" y1="50" x2="84" y2="62" stroke={c} strokeWidth={0.9} strokeLinecap="round"/>
        <line x1="84" y1="50" x2="72" y2="62" stroke={c} strokeWidth={0.9} strokeLinecap="round"/>
        <circle cx="78" cy="56" r="2.5"        stroke={c} strokeWidth={1.2} fill="none"/>
      </g>
    </g>
  );
  return flip ? <g transform="scale(-1,1) translate(-108,0)">{g}</g> : g;
}

function SvgBike({ flip, c }: { flip:boolean; c:string }) {
  const g = (
    <g>
      <circle cx="40" cy="11" r="7"            stroke={c} strokeWidth={SW} fill="none"/>
      <path d="M40,18 L44,38"                  stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      <g style={legG("humanArmF 0.38s ease-in-out infinite")}>
        <path d="M40,27 L52,38"                stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      </g>
      <path d="M28,50 L44,33 L58,50 L28,50"   stroke={c} strokeWidth={SW} fill="none" strokeLinejoin="round"/>
      <path d="M52,38 L60,33 L65,35"           stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      <g style={wheelG("0.9s")}>
        <circle cx="17" cy="50" r="13"         stroke={c} strokeWidth={SW} fill="none"/>
        <line x1="17" y1="37" x2="17" y2="63" stroke={c} strokeWidth={0.8} strokeLinecap="round"/>
        <line x1="4"  y1="50" x2="30" y2="50" stroke={c} strokeWidth={0.8} strokeLinecap="round"/>
        <line x1="8"  y1="41" x2="26" y2="59" stroke={c} strokeWidth={0.8} strokeLinecap="round"/>
        <line x1="26" y1="41" x2="8"  y2="59" stroke={c} strokeWidth={0.8} strokeLinecap="round"/>
        <circle cx="17" cy="50" r="3"          stroke={c} strokeWidth={1.2} fill="none"/>
      </g>
      <g style={wheelG("0.9s")}>
        <circle cx="67" cy="50" r="13"         stroke={c} strokeWidth={SW} fill="none"/>
        <line x1="67" y1="37" x2="67" y2="63" stroke={c} strokeWidth={0.8} strokeLinecap="round"/>
        <line x1="54" y1="50" x2="80" y2="50" stroke={c} strokeWidth={0.8} strokeLinecap="round"/>
        <line x1="58" y1="41" x2="76" y2="59" stroke={c} strokeWidth={0.8} strokeLinecap="round"/>
        <line x1="76" y1="41" x2="58" y2="59" stroke={c} strokeWidth={0.8} strokeLinecap="round"/>
        <circle cx="67" cy="50" r="3"          stroke={c} strokeWidth={1.2} fill="none"/>
      </g>
      <circle cx="43" cy="50" r="4"            stroke={c} strokeWidth={1.3} fill="none"/>
    </g>
  );
  return flip ? <g transform="scale(-1,1) translate(-84,0)">{g}</g> : g;
}

function SvgBird({ flip, c }: { flip:boolean; c:string }) {
  const g = (
    <g>
      <g style={wingG("L", "100%")}>
        <path d="M10,7 Q4,1 0,5"              stroke={c} strokeWidth={1.5} fill="none" strokeLinecap="round"/>
      </g>
      <g style={wingG("R", "0%")}>
        <path d="M14,7 Q20,1 24,5"            stroke={c} strokeWidth={1.5} fill="none" strokeLinecap="round"/>
      </g>
      <ellipse cx="12" cy="8" rx="3" ry="1.5" fill={c} opacity={0.75}/>
      <circle cx="16" cy="7" r="2"            fill={c} opacity={0.8}/>
      <path d="M17.5,7 L21,7.5"              stroke={c} strokeWidth={1.0} strokeLinecap="round"/>
      <path d="M9,8 Q5,10 3,9"               stroke={c} strokeWidth={1.1} fill="none" strokeLinecap="round"/>
    </g>
  );
  return flip ? <g transform="scale(-1,1) translate(-24,0)">{g}</g> : g;
}

// ─── Actor element ────────────────────────────────────────────────────────────
interface ActorElProps { actor: ActiveActor; onFinish: (id:string) => void; }

function ActorEl({ actor, onFinish }: ActorElProps) {
  const [isLooking, setIsLooking] = useState(false);
  const meta   = ACTOR_META[actor.type];
  const color  = ACTOR_COLORS[actor.type];
  const flip   = actor.direction === "rtl";
  const dispW  = Math.round(meta.dispH * (meta.viewW / meta.viewH));
  const isCat  = actor.type === "cat";
  const isBird = actor.type === "bird";

  // Auto-remove when crossing completes
  useEffect(() => {
    const t = setTimeout(() => onFinish(actor.id), actor.durationS * 1000 + 700);
    return () => clearTimeout(t);
  }, [actor.id, actor.durationS, onFinish]);

  // Cat pause-and-look: inject per-actor CSS keyframe
  useEffect(() => {
    if (!isCat || actor.stopFraction == null || actor.pauseMs == null) return;
    const sf  = actor.stopFraction;
    const pf  = actor.pauseMs / (actor.durationS * 1000);
    const k1  = sf;
    const k2  = Math.min(sf + pf, 0.97);
    const kId = `cm_${actor.id}`;
    const stopVw  = actor.direction === "ltr" ? sf : (1 - sf);
    const stopPos = `calc(${stopVw * 100}vw - ${dispW / 2}px)`;
    const fromPos = actor.direction === "ltr" ? "-160px" : "calc(100vw + 160px)";
    const toPos   = actor.direction === "ltr" ? "calc(100vw + 160px)" : "-160px";
    const styleEl = document.createElement("style");
    styleEl.id = kId;
    styleEl.textContent = `@keyframes ${kId}{0%{transform:translateX(${fromPos})}${(k1*100).toFixed(2)}%{transform:translateX(${stopPos})}${(k2*100).toFixed(2)}%{transform:translateX(${stopPos})}100%{transform:translateX(${toPos})}}`;
    document.head.appendChild(styleEl);
    const t1 = window.setTimeout(() => setIsLooking(true),  sf * actor.durationS * 1000 - 100);
    const t2 = window.setTimeout(() => setIsLooking(false), (sf + pf) * actor.durationS * 1000 + 100);
    return () => {
      document.getElementById(kId)?.remove();
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [actor, isCat, dispW]);

  // Level config
  const levelCfg  = !isBird ? LEVEL_CFG[actor.level as GroundLevel] : null;
  const bottomVal = isBird
    ? actor.skyBottom!
    : `${BOTTOM_BASE[actor.type] + (levelCfg?.extraBottom ?? 0)}px`;
  const scale = levelCfg?.scale ?? 1.0;

  const moveAnim = isCat && actor.stopFraction != null
    ? `cm_${actor.id} ${actor.durationS}s linear forwards`
    : `${actor.direction === "ltr" ? "cityMoveLtr" : "cityMoveRtl"} ${actor.durationS}s linear forwards`;

  const bobStyle: React.CSSProperties = isLooking ? {} : meta.bob
    ? { animation: `cityBob ${actor.type === "bike" ? "0.38s" : "0.52s"} ease-in-out infinite` }
    : { animation: "cityRoll 0.65s ease-in-out infinite" };

  return (
    <div
      className="city-actor"
      style={{ position:"absolute", bottom:bottomVal, left:0, animation:moveAnim, willChange:"transform" }}
    >
      <div style={scale !== 1 ? { transform:`scale(${scale})`, transformOrigin:"bottom center" } : undefined}>
        <svg
          viewBox={`0 0 ${meta.viewW} ${meta.viewH}`}
          width={dispW} height={meta.dispH}
          aria-hidden
          style={bobStyle}
        >
          {actor.type === "cat"   && <SvgCat   flip={flip} c={color} isLooking={isLooking}/>}
          {actor.type === "dog"   && <SvgDog   flip={flip} c={color}/>}
          {actor.type === "human" && <SvgHuman flip={flip} c={color}/>}
          {actor.type === "car"   && <SvgCar   flip={flip} c={color}/>}
          {actor.type === "bike"  && <SvgBike  flip={flip} c={color}/>}
          {actor.type === "bird"  && <SvgBird  flip={flip} c={color}/>}
        </svg>
      </div>
    </div>
  );
}

// ─── City decorations ─────────────────────────────────────────────────────────
function CityTint({ mode }: { mode:TimeMode }) {
  if (mode === "day") return null;
  return <div aria-hidden style={{ position:"absolute", inset:0, pointerEvents:"none",
    background: mode === "evening" ? "rgba(200,140,60,0.08)" : "rgba(40,30,20,0.18)",
    transition: "background 2s ease" }}/>;
}
function CityWindows({ litSet, mode }: { litSet:Set<number>; mode:TimeMode }) {
  if (mode === "day" || litSet.size === 0) return null;
  return (
    <svg viewBox="0 0 1400 520" preserveAspectRatio="xMidYMax slice" aria-hidden
      style={{ position:"absolute", bottom:0, left:0, width:"100%", height:"100%", pointerEvents:"none" }}>
      {WINDOWS.map((w, i) => !litSet.has(i) ? null : (
        <rect key={i} x={w.x} y={w.y} width={w.w} height={w.h} rx="2"
          fill="rgba(255,195,90,0.48)" className="city-window"
          style={{ animation:`${i%3===0?"windowFlicker":"windowGlow"} ${w.dur}s ease-in-out infinite` }}/>
      ))}
    </svg>
  );
}

// ─── Spawn helpers (run inside setActors functional update) ───────────────────
function makeGroundActor(prev: ActiveActor[]): ActiveActor | null {
  const occupied = new Set(
    prev.filter(a => a.level !== "sky").map(a => a.level as GroundLevel)
  );
  const free = ([0, 1, 2] as GroundLevel[]).filter(l => !occupied.has(l));
  if (free.length === 0) return null;
  const level        = free[Math.floor(Math.random() * free.length)];
  const mode         = getTimeMode();
  const type         = weightedPick(WEIGHTS[mode]);
  const direction: Direction = Math.random() > 0.5 ? "ltr" : "rtl";
  const durationS    = parseFloat(rnd(28, 42).toFixed(1));
  const stopFraction = type === "cat" ? parseFloat(rnd(0.25, 0.68).toFixed(2)) : undefined;
  const pauseMs      = type === "cat" ? Math.round(rnd(2000, 3200)) : undefined;
  return { id: crypto.randomUUID(), type, direction, durationS, level, stopFraction, pauseMs };
}

function makeBirdActor(): ActiveActor {
  const direction: Direction = Math.random() > 0.5 ? "ltr" : "rtl";
  const durationS = parseFloat(rnd(4, 8).toFixed(1));
  const skyBottom = `${Math.round(rnd(32, 68))}%`;
  return { id: crypto.randomUUID(), type:"bird", direction, durationS, level:"sky", skyBottom };
}

// ─── Main component ───────────────────────────────────────────────────────────
export function AnimatedCityScene() {
  const [timeMode,      setTimeMode]      = useState<TimeMode>("day");
  const [litSet,        setLitSet]        = useState<Set<number>>(new Set());
  const [actors,        setActors]        = useState<ActiveActor[]>([]);
  const [reducedMotion, setReducedMotion] = useState(false);

  const groundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const birdTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const h = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  useEffect(() => {
    setTimeMode(getTimeMode());
    const id = setInterval(() => setTimeMode(getTimeMode()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const count   = getLitCount(WINDOWS.length, timeMode);
    const indices = [...Array(WINDOWS.length).keys()].sort(() => Math.random() - 0.5);
    setLitSet(new Set(indices.slice(0, count)));
  }, [timeMode]);

  const removeActor = useCallback((id: string) => {
    setActors(prev => prev.filter(a => a.id !== id));
  }, []);

  // Ground spawn loop — 1.5× more frequent, occasional simultaneous pair
  const scheduleGround = useCallback((delay: number) => {
    groundTimer.current = setTimeout(() => {
      setActors(prev => {
        const a = makeGroundActor(prev);
        return a ? [...prev, a] : prev;
      });
      // 42% chance: second actor 1.5-3s later on a different level
      if (Math.random() < 0.42) {
        setTimeout(() => {
          setActors(prev => {
            const a = makeGroundActor(prev);
            return a ? [...prev, a] : prev;
          });
        }, rnd(1500, 3000));
      }
      scheduleGround(rnd(13_000, 28_000));
    }, delay);
  }, []);

  // Bird spawn loop (no birds at night)
  const scheduleBird = useCallback((delay: number) => {
    birdTimer.current = setTimeout(() => {
      if (getTimeMode() !== "night") {
        setActors(prev => [...prev, makeBirdActor()]);
        if (Math.random() < 0.30) {
          setTimeout(() => {
            setActors(prev => [...prev, makeBirdActor()]);
          }, rnd(800, 2200));
        }
      }
      scheduleBird(rnd(12_000, 26_000));
    }, delay);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    scheduleGround(rnd(2_000, 5_000));
    scheduleBird(rnd(8_000, 18_000));
    return () => {
      if (groundTimer.current) clearTimeout(groundTimer.current);
      if (birdTimer.current)   clearTimeout(birdTimer.current);
    };
  }, [reducedMotion, scheduleGround, scheduleBird]);

  const cityOpacity = timeMode === "day" ? 0.55 : timeMode === "evening" ? 0.65 : 0.42;

  return (
    <div aria-hidden style={{
      position:"absolute", bottom:0, left:0, width:"100%",
      pointerEvents:"none", zIndex:0, marginBottom:"-2%",
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/city.png" alt="" aria-hidden
        className="pointer-events-none select-none w-full block"
        style={{ opacity:cityOpacity, transition:"opacity 3s ease" }}
      />
      <CityTint mode={timeMode}/>
      <CityWindows litSet={litSet} mode={timeMode}/>
      <div style={{ position:"absolute", inset:0 }}>
        {!reducedMotion && actors.map(a => (
          <ActorEl key={a.id} actor={a} onFinish={removeActor}/>
        ))}
      </div>
    </div>
  );
}
