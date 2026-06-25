"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";

// ─── Types ────────────────────────────────────────────────────────────────────
type ActorType    = "cat" | "human" | "car" | "dog" | "bike" | "bird" | "bus";
type HumanVariant = "man" | "woman" | "child";
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
  stopFraction?: number;  // cat & dog: random stop point
  pauseMs?:      number;  // cat: look pause / dog: pee pause
  isPeeStop?:    boolean; // dog only: this stop is a pee stop
  humanVariant?:         HumanVariant; // human only
  humanStopFraction?:    number;       // human: pause point (0-1)
  humanStopMs?:          number;       // human: pause duration ms
  humanReverseFraction?: number;       // human: turn-around point (0-1)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const rnd = (lo: number, hi: number) => Math.random() * (hi - lo) + lo;

function getTimeMode(): TimeMode {
  const h = new Date().getHours();
  if (h >= 21) return "evening";
  if (h < 6)   return "night";
  return "day";
}

// ─── Actor config ─────────────────────────────────────────────────────────────
const WEIGHTS: Record<TimeMode, Partial<Record<ActorType, number>>> = {
  day:     { cat: 28, human: 24, car: 22, dog: 11, bike: 8, bus: 7 },
  evening: { cat: 38, human: 28, car: 14, dog: 9, bike: 5, bus: 6 },
  night:   { cat: 73, human: 20, car: 5, bus: 2 },
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
  human: { viewW:44,  viewH:74, dispH:65, bob:true  },
  bus:   { viewW:134, viewH:80, dispH:58, bob:false },
  car:   { viewW:112, viewH:72, dispH:52, bob:false },
  bike:  { viewW:88,  viewH:72, dispH:58, bob:true  },
  bird:  { viewW:24,  viewH:14, dispH:14, bob:false },
};
const ACTOR_COLORS: Record<ActorType, string> = {
  cat:"#bfb6aa", dog:"#bfb6aa", human:"#c0b8ac",
  car:"#c3bbaf", bike:"#c0b8ac", bird:"#c8c0b4", bus:"#c8c2b8",
};
const BOTTOM_BASE: Record<ActorType, number> = {
  cat:28, dog:28, human:26, car:18, bike:20, bird:0, bus:16,
};

// Level depth config (0=near/large, 2=far/small)
const LEVEL_CFG: Record<GroundLevel, { extraBottom:number; scale:number }> = {
  0: { extraBottom: 0,  scale: 1.00 },
  1: { extraBottom: 13, scale: 0.86 },
  2: { extraBottom: 24, scale: 0.73 },
};


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
function SvgCat({ flip, c, isLooking, speedMulti=1 }: { flip:boolean; c:string; isLooking:boolean; speedMulti?:number }) {
  const dur = (0.42 / speedMulti).toFixed(2);
  const wa  = isLooking ? "none" : undefined;
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
      <g style={legG(wa ?? `catLegB ${dur}s ease-in-out infinite`)}>
        <line x1="14" y1="41" x2="11" y2="52" stroke={c} strokeWidth={SW} strokeLinecap="round"/>
        <line x1="21" y1="41" x2="24" y2="52" stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      </g>
      <g style={legG(wa ?? `catLegF ${dur}s ease-in-out infinite`)}>
        <line x1="27" y1="41" x2="24" y2="52" stroke={c} strokeWidth={SW} strokeLinecap="round"/>
        <line x1="34" y1="41" x2="37" y2="52" stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      </g>
    </g>
  );
  return flip ? <g transform="scale(-1,1) translate(-52,0)">{g}</g> : g;
}

function SvgDog({ flip, c, isPeeing = false, peeDurS = 3, speedMulti = 1 }: { flip:boolean; c:string; isPeeing?:boolean; peeDurS?:number; speedMulti?:number }) {
  const dogDur = (0.44 / speedMulti).toFixed(2);
  // Raised back-left leg: rotated ~80° upward from hip
  const raisedLegStyle: React.CSSProperties = {
    transformBox:    "fill-box" as React.CSSProperties["transformBox"],
    transformOrigin: "100% 0%", // pivot at (16,44) = right edge top of bounding box
    transform:       "rotate(-82deg)",
  };
  const streamStyle: React.CSSProperties = {
    transformBox:    "fill-box" as React.CSSProperties["transformBox"],
    transformOrigin: "50% 0%",
    animation:       `peeStream ${peeDurS.toFixed(1)}s ease-in-out forwards`,
  };

  const g = (
    <g>
      <ellipse cx="27" cy="34" rx="18" ry="10" stroke={c} strokeWidth={SW} fill="none"/>
      <circle  cx="42" cy="21" r="10"           stroke={c} strokeWidth={SW} fill="none"/>
      <path d="M34,16 Q26,7 29,22"              stroke={c} strokeWidth={SW} fill="none" strokeLinecap="round"/>
      <path d="M49,16 Q58,7 56,22"              stroke={c} strokeWidth={SW} fill="none" strokeLinecap="round"/>
      <circle cx="46" cy="20" r="1.2"           fill={c}/>
      <ellipse cx="50" cy="25" rx="3" ry="2"    stroke={c} strokeWidth={1.4} fill="none"/>
      {/* Tail */}
      <g style={{ transformBox:"fill-box" as React.CSSProperties["transformBox"], transformOrigin:"100% 100%", animation:"dogTail 0.5s ease-in-out infinite" }}>
        <path d="M9,28 Q-1,13 7,6"              stroke={c} strokeWidth={SW} fill="none" strokeLinecap="round"/>
      </g>

      {/* Back legs */}
      {isPeeing ? (
        <>
          {/* Left back leg RAISED */}
          <g style={raisedLegStyle}>
            <line x1="16" y1="44" x2="12" y2="55" stroke={c} strokeWidth={SW} strokeLinecap="round"/>
            <line x1="12" y1="55" x2="9"  y2="62" stroke={c} strokeWidth={SW-0.3} strokeLinecap="round"/>
          </g>
          {/* Right back leg — standing still */}
          <line x1="24" y1="44" x2="27" y2="56"   stroke={c} strokeWidth={SW} strokeLinecap="round"/>
          <line x1="27" y1="56" x2="25" y2="62"   stroke={c} strokeWidth={SW-0.3} strokeLinecap="round"/>
          {/* Pee stream — dotted arc downward from raised-leg area */}
          <g style={streamStyle}>
            <line x1="14" y1="46" x2="10" y2="62"
                  stroke={c} strokeWidth={1.6}
                  strokeDasharray="1.8 2.8"
                  strokeLinecap="round"
                  opacity="0.82"/>
            {/* Small splash dots at ground */}
            <circle cx="9"  cy="63" r="1.0" fill={c} opacity="0.5"/>
            <circle cx="11" cy="65" r="0.8" fill={c} opacity="0.35"/>
            <circle cx="7"  cy="65" r="0.7" fill={c} opacity="0.3"/>
          </g>
        </>
      ) : (
        <g style={legG(`dogLegB ${dogDur}s ease-in-out infinite`)}>
          <line x1="16" y1="44" x2="12" y2="55"  stroke={c} strokeWidth={SW} strokeLinecap="round"/>
          <line x1="24" y1="44" x2="27" y2="55"  stroke={c} strokeWidth={SW} strokeLinecap="round"/>
        </g>
      )}

      {/* Front legs */}
      <g style={legG(isPeeing ? "none" : `dogLegF ${dogDur}s ease-in-out infinite`)}>
        <line x1="32" y1="44" x2="28" y2="55"    stroke={c} strokeWidth={SW} strokeLinecap="round"/>
        <line x1="39" y1="44" x2="43" y2="55"    stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      </g>
    </g>
  );
  return flip ? <g transform="scale(-1,1) translate(-65,0)">{g}</g> : g;
}

// Profile-view walking human (facing right by default; flip mirrors to face left)
// Draw order: back leg → back arm → torso → front arm → front leg → head (z-layers)
// Contralateral gait: back leg pairs with front arm (opposite-side swing)
function SvgHuman({ flip, c, variant = "man", speedMulti = 1, isStopped = false }: {
  flip:boolean; c:string; variant?:HumanVariant; speedMulti?:number; isStopped?:boolean
}) {
  const legDur = (0.50 / speedMulti).toFixed(2);
  const armDur = (0.50 / speedMulti).toFixed(2);
  const ps  = isStopped ? "paused" : "running";
  const LSW = 2.1;
  // pv: pivot at top of limb. Include ps in animation shorthand to avoid shorthand/longhand conflict.
  const pv = (anim: string): React.CSSProperties => ({
    transformBox:    "fill-box" as React.CSSProperties["transformBox"],
    transformOrigin: "50% 0%",
    animation:       `${anim} ${ps}`,
  });

  let g: React.ReactNode;

  if (variant === "child") {
    g = (
      <g>
        {/* back leg — swings same direction as front arm (contralateral) */}
        <g style={pv(`humanLegF ${legDur}s ease-in-out infinite`)}>
          <path d="M19,36 Q16,44 15,50" stroke={c} strokeWidth={LSW} strokeLinecap="round" fill="none"/>
          <path d="M15,50 Q14,56 14,60" stroke={c} strokeWidth={LSW-0.3} strokeLinecap="round" fill="none"/>
          <line x1="14" y1="60" x2="8"  y2="61" stroke={c} strokeWidth={1.4} strokeLinecap="round"/>
        </g>
        {/* back arm — opposite phase to back leg (contralateral pair: backLeg+frontArm) */}
        <g style={pv(`humanArmB ${armDur}s ease-in-out infinite`)}>
          <path d="M18,22 Q13,29 11,35" stroke={c} strokeWidth={LSW-0.3} strokeLinecap="round" fill="none"/>
        </g>
        {/* body */}
        <ellipse cx="22" cy="29" rx="7" ry="8" stroke={c} strokeWidth={SW} fill={c} fillOpacity={0.09}/>
        {/* front arm — same phase as back leg (contralateral) */}
        <g style={pv(`humanArmF ${armDur}s ease-in-out infinite`)}>
          <path d="M24,22 Q29,29 31,35" stroke={c} strokeWidth={LSW-0.3} strokeLinecap="round" fill="none"/>
        </g>
        {/* front leg */}
        <g style={pv(`humanLegB ${legDur}s ease-in-out infinite`)}>
          <path d="M23,36 Q26,44 27,50" stroke={c} strokeWidth={LSW} strokeLinecap="round" fill="none"/>
          <path d="M27,50 Q28,56 28,60" stroke={c} strokeWidth={LSW-0.3} strokeLinecap="round" fill="none"/>
          <line x1="28" y1="60" x2="34" y2="59" stroke={c} strokeWidth={1.4} strokeLinecap="round"/>
        </g>
        {/* head — big for child */}
        <circle cx="24" cy="10" r="10" stroke={c} strokeWidth={SW} fill={c} fillOpacity={0.07}/>
        <path d="M33,10 Q36,11 33,14"  stroke={c} strokeWidth={1.0} fill="none"/>
      </g>
    );
  } else if (variant === "woman") {
    g = (
      <g>
        {/* back leg */}
        <g style={pv(`humanLegF ${legDur}s ease-in-out infinite`)}>
          <path d="M19,57 Q17,63 16,69" stroke={c} strokeWidth={LSW} strokeLinecap="round" fill="none"/>
          <path d="M16,69 Q15,72 15,74" stroke={c} strokeWidth={LSW-0.3} strokeLinecap="round" fill="none"/>
          <line x1="15" y1="74" x2="9"  y2="74" stroke={c} strokeWidth={1.4} strokeLinecap="round"/>
        </g>
        {/* back arm — contralateral: pairs with front leg */}
        <g style={pv(`humanArmB ${armDur}s ease-in-out infinite`)}>
          <path d="M18,21 Q13,30 12,37" stroke={c} strokeWidth={1.9} strokeLinecap="round" fill="none"/>
          <path d="M12,37 Q11,44 11,47" stroke={c} strokeWidth={1.5} strokeLinecap="round" fill="none"/>
        </g>
        {/* torso — feminine profile */}
        <path d="M17,20 Q14,28 14,36 Q13,42 16,44 L25,44 Q27,42 26,36 Q26,28 25,20 Z"
              stroke={c} strokeWidth={SW} fill={c} fillOpacity={0.10} strokeLinejoin="round"/>
        {/* skirt in profile */}
        <path d="M16,44 Q10,53 12,57 L30,57 Q32,53 25,44"
              stroke={c} strokeWidth={SW-0.2} fill={c} fillOpacity={0.09} strokeLinejoin="round"/>
        {/* front arm — contralateral: pairs with back leg */}
        <g style={pv(`humanArmF ${armDur}s ease-in-out infinite`)}>
          <path d="M24,21 Q29,30 30,37" stroke={c} strokeWidth={1.9} strokeLinecap="round" fill="none"/>
          <path d="M30,37 Q31,44 31,47" stroke={c} strokeWidth={1.5} strokeLinecap="round" fill="none"/>
        </g>
        {/* front leg */}
        <g style={pv(`humanLegB ${legDur}s ease-in-out infinite`)}>
          <path d="M22,57 Q25,63 26,69" stroke={c} strokeWidth={LSW} strokeLinecap="round" fill="none"/>
          <path d="M26,69 Q27,72 27,74" stroke={c} strokeWidth={LSW-0.3} strokeLinecap="round" fill="none"/>
          <line x1="27" y1="74" x2="33" y2="73" stroke={c} strokeWidth={1.4} strokeLinecap="round"/>
        </g>
        {/* head */}
        <circle cx="24" cy="8" r="7.5" stroke={c} strokeWidth={SW} fill={c} fillOpacity={0.07}/>
        <ellipse cx="21" cy="5" rx="9" ry="5" stroke={c} strokeWidth={1.3} fill={c} fillOpacity={0.12}/>
        <path d="M31,8 Q34,9 31,12" stroke={c} strokeWidth={1.1} fill="none"/>
      </g>
    );
  } else {
    // man — profile walking
    g = (
      <g>
        {/* back leg */}
        <g style={pv(`humanLegF ${legDur}s ease-in-out infinite`)}>
          <path d="M19,44 Q16,54 15,62" stroke={c} strokeWidth={LSW+0.1} strokeLinecap="round" fill="none"/>
          <path d="M15,62 Q14,68 14,72" stroke={c} strokeWidth={LSW-0.1} strokeLinecap="round" fill="none"/>
          <line x1="14" y1="72" x2="8"  y2="73" stroke={c} strokeWidth={1.5} strokeLinecap="round"/>
        </g>
        {/* back arm — contralateral: pairs with front leg */}
        <g style={pv(`humanArmB ${armDur}s ease-in-out infinite`)}>
          <path d="M19,21 Q14,30 12,37" stroke={c} strokeWidth={LSW} strokeLinecap="round" fill="none"/>
          <path d="M12,37 Q11,44 11,47" stroke={c} strokeWidth={LSW-0.4} strokeLinecap="round" fill="none"/>
        </g>
        {/* torso — narrow profile body */}
        <path d="M18,20 Q16,32 16,44 L25,44 Q25,32 26,20 Z"
              stroke={c} strokeWidth={SW} fill={c} fillOpacity={0.11} strokeLinejoin="round"/>
        {/* belt */}
        <line x1="17" y1="40" x2="25" y2="40" stroke={c} strokeWidth={0.9} opacity={0.45}/>
        {/* front arm — contralateral: pairs with back leg */}
        <g style={pv(`humanArmF ${armDur}s ease-in-out infinite`)}>
          <path d="M24,21 Q29,30 31,37" stroke={c} strokeWidth={LSW} strokeLinecap="round" fill="none"/>
          <path d="M31,37 Q32,44 32,47" stroke={c} strokeWidth={LSW-0.4} strokeLinecap="round" fill="none"/>
        </g>
        {/* front leg */}
        <g style={pv(`humanLegB ${legDur}s ease-in-out infinite`)}>
          <path d="M23,44 Q26,54 27,62" stroke={c} strokeWidth={LSW+0.1} strokeLinecap="round" fill="none"/>
          <path d="M27,62 Q28,68 29,72" stroke={c} strokeWidth={LSW-0.1} strokeLinecap="round" fill="none"/>
          <line x1="29" y1="72" x2="35" y2="71" stroke={c} strokeWidth={1.5} strokeLinecap="round"/>
        </g>
        {/* head */}
        <circle cx="24" cy="8" r="7.5" stroke={c} strokeWidth={SW} fill={c} fillOpacity={0.07}/>
        <path d="M31,8 Q34,9 31,12" stroke={c} strokeWidth={1.1} fill="none"/>
      </g>
    );
  }
  return flip
    ? <g transform="scale(-1,1) translate(-44,0)">{g}</g>
    : <>{g}</>;
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
  const [isLooking,      setIsLooking]      = useState(false);
  const [isPeeing,       setIsPeeing]       = useState(false);
  const [isHumanStopped, setIsHumanStopped] = useState(false);
  const [speedMulti,     setSpeedMulti]     = useState(1);
  const [speedAnim,      setSpeedAnim]      = useState<string|null>(null);
  const [flipDir,        setFlipDir]        = useState(actor.direction === "rtl");
  // humanRevAnim is initialised eagerly so the div has a valid animation string from first render
  const [humanRevAnim,   setHumanRevAnim]   = useState<string|null>(() => {
    if (actor.type !== "human" || actor.humanReverseFraction == null) return null;
    const dur1 = actor.durationS * actor.humanReverseFraction;
    return `hr1_${actor.id} ${dur1.toFixed(2)}s linear forwards`;
  });

  const startTime  = useRef(Date.now());
  const finishRef  = useRef<ReturnType<typeof setTimeout>|null>(null);
  const meta    = ACTOR_META[actor.type];
  const color   = ACTOR_COLORS[actor.type];
  const dispW   = Math.round(meta.dispH * (meta.viewW / meta.viewH));
  const isCat   = actor.type === "cat";
  const isDog   = actor.type === "dog";
  const isHuman = actor.type === "human";
  const isBird  = actor.type === "bird";
  const flip    = isHuman ? flipDir : actor.direction === "rtl";

  // Auto-remove when crossing completes
  useEffect(() => {
    finishRef.current = setTimeout(() => onFinish(actor.id), actor.durationS * 1000 + 2500);
    return () => { if (finishRef.current) clearTimeout(finishRef.current); };
  }, [actor.id, actor.durationS, onFinish]);

  // Click: doubles speed; uses negative animation-delay to preserve position
  const handleClick = useCallback(() => {
    setSpeedMulti(prev => Math.min(prev * 2, 8));
  }, []);

  useEffect(() => {
    if (speedMulti === 1) return;
    const elapsed  = (Date.now() - startTime.current) / 1000;
    const progress = Math.min(elapsed / actor.durationS, 0.995);
    const newDur   = actor.durationS / speedMulti;
    const negDelay = -(progress * newDur);
    const ltr      = actor.direction === "ltr";

    // IMPORTANT: changing the animation NAME forces the browser to restart with the
    // new negative delay. Reusing the same name doesn't restart → negative delay has no effect.
    const kId = `cspd_${actor.id}_${speedMulti}`;
    const fromPos = ltr ? "-160px" : "calc(100vw + 160px)";
    const toPos   = ltr ? "calc(100vw + 160px)" : "-160px";

    let kContent: string;
    if ((isCat || isDog) && actor.stopFraction != null && actor.pauseMs != null) {
      const sf  = actor.stopFraction;
      const pf  = actor.pauseMs / (actor.durationS * 1000);
      const k1  = sf;
      const k2  = Math.min(sf + pf, 0.97);
      const stopVw  = ltr ? sf : (1 - sf);
      const stopPos = `calc(${stopVw * 100}vw - ${dispW / 2}px)`;
      kContent = `@keyframes ${kId}{0%{transform:translateX(${fromPos})}${(k1*100).toFixed(2)}%{transform:translateX(${stopPos})}${(k2*100).toFixed(2)}%{transform:translateX(${stopPos})}100%{transform:translateX(${toPos})}}`;
    } else if (isHuman && actor.humanStopFraction != null && actor.humanStopMs != null) {
      const sf  = actor.humanStopFraction;
      const pf  = actor.humanStopMs / (actor.durationS * 1000);
      const k1  = sf;
      const k2  = Math.min(sf + pf, 0.97);
      const stopVw  = ltr ? sf : (1 - sf);
      const stopPos = `calc(${stopVw * 100}vw - ${dispW / 2}px)`;
      kContent = `@keyframes ${kId}{0%{transform:translateX(${fromPos})}${(k1*100).toFixed(2)}%{transform:translateX(${stopPos})}${(k2*100).toFixed(2)}%{transform:translateX(${stopPos})}100%{transform:translateX(${toPos})}}`;
    } else {
      kContent = `@keyframes ${kId}{from{transform:translateX(${fromPos})}to{transform:translateX(${toPos})}}`;
    }

    const prev = document.getElementById(kId);
    if (prev) prev.remove();
    const styleEl = document.createElement("style");
    styleEl.id = kId;
    styleEl.textContent = kContent;
    document.head.appendChild(styleEl);

    setSpeedAnim(`${kId} ${newDur.toFixed(2)}s linear ${negDelay.toFixed(2)}s forwards`);
    const remaining = Math.max(0.5, newDur * (1 - progress));
    if (finishRef.current) clearTimeout(finishRef.current);
    finishRef.current = setTimeout(() => onFinish(actor.id), remaining * 1000 + 400);
  }, [speedMulti]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cat (look) and dog (pee): inject pause keyframe + visual state
  useEffect(() => {
    const needsPause = (isCat || isDog) && actor.stopFraction != null && actor.pauseMs != null;
    if (!needsPause) return;
    const sf  = actor.stopFraction!;
    const pf  = actor.pauseMs! / (actor.durationS * 1000);
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
    const onStart = sf * actor.durationS * 1000 - 100;
    const onEnd   = (sf + pf) * actor.durationS * 1000 + 100;
    const t1 = window.setTimeout(() => { if (isCat) setIsLooking(true);  if (isDog) setIsPeeing(true);  }, onStart);
    const t2 = window.setTimeout(() => { if (isCat) setIsLooking(false); if (isDog) setIsPeeing(false); }, onEnd);
    return () => {
      document.getElementById(kId)?.remove();
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [actor, isCat, isDog, dispW]);

  // Human stop: pause at random point, legs freeze, then continue
  useEffect(() => {
    if (!isHuman || actor.humanStopFraction == null || actor.humanStopMs == null) return;
    const sf  = actor.humanStopFraction;
    const pf  = actor.humanStopMs / (actor.durationS * 1000);
    const k1  = sf;
    const k2  = Math.min(sf + pf, 0.97);
    const kId = `hm_${actor.id}`;
    const stopVw  = actor.direction === "ltr" ? sf : (1 - sf);
    const stopPos = `calc(${stopVw * 100}vw - ${dispW / 2}px)`;
    const fromPos = actor.direction === "ltr" ? "-160px" : "calc(100vw + 160px)";
    const toPos   = actor.direction === "ltr" ? "calc(100vw + 160px)" : "-160px";
    const styleEl = document.createElement("style");
    styleEl.id = kId;
    styleEl.textContent = `@keyframes ${kId}{0%{transform:translateX(${fromPos})}${(k1*100).toFixed(2)}%{transform:translateX(${stopPos})}${(k2*100).toFixed(2)}%{transform:translateX(${stopPos})}100%{transform:translateX(${toPos})}}`;
    document.head.appendChild(styleEl);
    const onStart = sf * actor.durationS * 1000 - 100;
    const onEnd   = (sf + pf) * actor.durationS * 1000 + 100;
    const t1 = window.setTimeout(() => setIsHumanStopped(true),  onStart);
    const t2 = window.setTimeout(() => setIsHumanStopped(false), onEnd);
    return () => {
      document.getElementById(kId)?.remove();
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [actor, isHuman, dispW]);

  // Human reverse: walk to reversePoint, flip, walk back to origin edge
  useEffect(() => {
    if (!isHuman || actor.humanReverseFraction == null) return;
    const rf  = actor.humanReverseFraction;
    const ltr = actor.direction === "ltr";
    const dur1 = actor.durationS * rf;

    // Position at reverse point (same formula as bird x-calculation)
    const revOff = rf * 320 - 160;
    const revPos = ltr
      ? `calc(${(rf * 100).toFixed(1)}vw ${revOff >= 0 ? '+' : '-'} ${Math.abs(revOff).toFixed(0)}px)`
      : `calc(${((1 - rf) * 100).toFixed(1)}vw ${(-revOff) >= 0 ? '+' : '-'} ${Math.abs(-revOff).toFixed(0)}px)`;

    const fromPos = ltr ? "translateX(-160px)" : "translateX(calc(100vw + 160px))";
    const oppEdge = ltr ? "translateX(-160px)"  : "translateX(calc(100vw + 160px))"; // returns to same edge

    const kId1 = `hr1_${actor.id}`;
    const kId2 = `hr2_${actor.id}`;

    // Phase 1: walk to reverse point
    const s1 = document.createElement("style");
    s1.id = kId1;
    s1.textContent = `@keyframes ${kId1}{from{transform:${fromPos}}to{transform:translateX(${revPos})}}`;
    document.head.appendChild(s1);

    // At reverse point: freeze legs + flip
    const t1 = setTimeout(() => {
      setIsHumanStopped(true);
      setFlipDir(d => !d);
    }, dur1 * 1000);

    // After 400ms pause: resume in opposite direction
    const t2 = setTimeout(() => {
      setIsHumanStopped(false);
      const s2 = document.createElement("style");
      s2.id = kId2;
      s2.textContent = `@keyframes ${kId2}{from{transform:translateX(${revPos})}to{transform:${oppEdge}}}`;
      document.head.appendChild(s2);
      setHumanRevAnim(`${kId2} ${dur1.toFixed(2)}s linear forwards`);
    }, dur1 * 1000 + 400);

    // Override finish timer: total = phase1 + pause + phase2
    const totalMs = (dur1 * 2 + 0.4 + 0.6) * 1000;
    if (finishRef.current) clearTimeout(finishRef.current);
    finishRef.current = setTimeout(() => onFinish(actor.id), totalMs);

    return () => {
      clearTimeout(t1); clearTimeout(t2);
      document.getElementById(kId1)?.remove();
      document.getElementById(kId2)?.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Bird: inject curved per-bird keyframe with correct X formula and natural Y trajectory
  useEffect(() => {
    if (!isBird) return;
    const kId = `bf_${actor.id}`;
    const ltr = actor.direction === "ltr";

    // Correct X at fraction p/100 for LTR: calc(p*vw + (p*3.2-160)px)
    // For RTL: calc((100-p)*vw + (160-p*3.2)px)
    const xAt = (p: number): string => {
      if (ltr) {
        const off = p * 3.2 - 160;
        return `calc(${p}vw ${off >= 0 ? '+' : '-'} ${Math.abs(off).toFixed(0)}px)`;
      } else {
        const off = 160 - p * 3.2;
        return `calc(${100 - p}vw ${off >= 0 ? '+' : '-'} ${Math.abs(off).toFixed(0)}px)`;
      }
    };

    // 5-7 random waypoints with varied Y (up/down/flat segments randomly)
    const numPts = Math.floor(rnd(5, 8));
    const pts: Array<{p:number; y:number}> = [];
    let curY = 0;
    for (let i = 1; i < numPts; i++) {
      const pct = (i / numPts) * 100;
      // Each segment can go up, down, or stay relatively flat
      const delta = rnd(-22, 22);
      curY = Math.max(-38, Math.min(38, curY + delta));
      pts.push({ p: pct, y: Math.round(curY) });
    }

    const from = ltr ? "translateX(-160px) translateY(0)" : "translateX(calc(100vw + 160px)) translateY(0)";
    const to   = ltr ? "translateX(calc(100vw + 160px)) translateY(0)" : "translateX(-160px) translateY(0)";
    let kf = `@keyframes ${kId}{0%{transform:${from}}`;
    for (const {p, y} of pts) {
      kf += `${p.toFixed(0)}%{transform:translateX(${xAt(p)}) translateY(${y}px)}`;
    }
    kf += `100%{transform:${to}}}`;

    const styleEl = document.createElement("style");
    styleEl.id = kId;
    styleEl.textContent = kf;
    document.head.appendChild(styleEl);
    return () => document.getElementById(kId)?.remove();
  }, [actor, isBird]);

  // Level config
  const levelCfg  = !isBird ? LEVEL_CFG[actor.level as GroundLevel] : null;
  const bottomVal = isBird
    ? actor.skyBottom!
    : `${BOTTOM_BASE[actor.type] + (levelCfg?.extraBottom ?? 0)}px`;

  // Child humans are visually smaller
  const childScale = actor.type === "human" && actor.humanVariant === "child" ? 0.72 : 1.0;
  const scale = (levelCfg?.scale ?? 1.0) * childScale;

  const defaultMoveAnim = (() => {
    if ((isCat || isDog) && actor.stopFraction != null) return `cm_${actor.id} ${actor.durationS}s linear forwards`;
    if (isHuman && actor.humanStopFraction != null)     return `hm_${actor.id} ${actor.durationS}s linear forwards`;
    if (isBird) return `bf_${actor.id} ${actor.durationS}s linear forwards`;
    return `${actor.direction === "ltr" ? "cityMoveLtr" : "cityMoveRtl"} ${actor.durationS}s linear forwards`;
  })();
  // humanRevAnim overrides everything (phase 1/2 for reversing humans); speedAnim overrides for click acceleration
  const moveAnim = humanRevAnim ?? speedAnim ?? defaultMoveAnim;

  const isClickable = (isCat || isDog) && speedMulti < 8;
  const bobStyle: React.CSSProperties = isLooking ? {} : meta.bob
    ? { animation: `cityBob ${actor.type === "bike" ? "0.38s" : "0.52s"} ease-in-out infinite` }
    : { animation: "cityRoll 0.65s ease-in-out infinite" };

  return (
    <div
      className="city-actor"
      style={{
        position:"absolute", bottom:bottomVal, left:0,
        animation:moveAnim, willChange:"transform",
        pointerEvents: isClickable ? "auto" : "none",
        cursor: isClickable ? "pointer" : undefined,
      }}
      onClick={isClickable ? handleClick : undefined}
    >
      <div style={scale !== 1 ? { transform:`scale(${scale})`, transformOrigin:"bottom center" } : undefined}>
        <svg
          viewBox={`0 0 ${meta.viewW} ${meta.viewH}`}
          width={dispW} height={meta.dispH}
          aria-hidden
          style={bobStyle}
        >
          {actor.type === "cat"   && <SvgCat   flip={flip} c={color} isLooking={isLooking} speedMulti={speedMulti}/>}
          {actor.type === "dog"   && <SvgDog   flip={flip} c={color} isPeeing={isPeeing} peeDurS={(actor.pauseMs ?? 3000)/1000} speedMulti={speedMulti}/>}
          {actor.type === "human" && <SvgHuman flip={flip} c={color} variant={actor.humanVariant} speedMulti={speedMulti} isStopped={isHumanStopped}/>}
          {actor.type === "car"   && <SvgCar   flip={flip} c={color}/>}
          {actor.type === "bike"  && <SvgBike  flip={flip} c={color}/>}
          {actor.type === "bird"  && <SvgBird  flip={flip} c={color}/>}
          {actor.type === "bus"   && <SvgBus   flip={flip} c={color}/>}
        </svg>
      </div>
    </div>
  );
}

// ─── Bus ──────────────────────────────────────────────────────────────────────
function SvgBus({ flip, c }: { flip:boolean; c:string }) {
  const wh = c;
  const wStyle: React.CSSProperties = {
    transformBox:    "fill-box" as React.CSSProperties["transformBox"],
    transformOrigin: "50% 50%",
    animation:       "wheelSpin 0.9s linear infinite",
  };
  const g = (
    <g>
      {/* Body */}
      <rect x="4"  y="16" width="126" height="50" rx="6"
        stroke={c} strokeWidth={1.7} fill={c} fillOpacity={0.09}/>
      {/* Roof stripe */}
      <rect x="4"  y="16" width="126" height="10" rx="6"
        stroke="none" fill={c} fillOpacity={0.16}/>
      {/* Cab front — right side */}
      <path d="M106,16 Q126,20 128,35 L128,60 L106,60 Z"
        stroke={c} strokeWidth={1.4} fill={c} fillOpacity={0.13} strokeLinejoin="round"/>
      {/* Windshield */}
      <path d="M108,20 Q122,23 124,36 L108,36 Z"
        stroke={c} strokeWidth={1.2} fill={c} fillOpacity={0.22} strokeLinejoin="round"/>
      {/* Headlight */}
      <rect x="122" y="44" width="7" height="5" rx="2"
        stroke={c} strokeWidth={1.0} fill={c} fillOpacity={0.35}/>
      {/* Passenger windows */}
      <rect x="14"  y="24" width="20" height="16" rx="3"
        stroke={c} strokeWidth={1.2} fill={c} fillOpacity={0.2}/>
      <rect x="42"  y="24" width="20" height="16" rx="3"
        stroke={c} strokeWidth={1.2} fill={c} fillOpacity={0.2}/>
      <rect x="70"  y="24" width="20" height="16" rx="3"
        stroke={c} strokeWidth={1.2} fill={c} fillOpacity={0.2}/>
      {/* Door lines */}
      <line x1="36"  y1="46" x2="36"  y2="66" stroke={c} strokeWidth={1.0} opacity={0.4}/>
      <line x1="62"  y1="46" x2="62"  y2="66" stroke={c} strokeWidth={1.0} opacity={0.4}/>
      {/* Undercarriage */}
      <rect x="4"  y="62" width="126" height="4" rx="2"
        stroke="none" fill={c} fillOpacity={0.2}/>
      {/* Rear wheel */}
      <g style={wStyle}>
        <circle cx="28"  cy="70" r="12" stroke={c} strokeWidth={1.6} fill={c} fillOpacity={0.08}/>
        <line x1="28" y1="58" x2="28" y2="82" stroke={c} strokeWidth={0.9} opacity={0.4}/>
        <line x1="16" y1="70" x2="40" y2="70" stroke={c} strokeWidth={0.9} opacity={0.4}/>
      </g>
      {/* Front wheel */}
      <g style={wStyle}>
        <circle cx="104" cy="70" r="12" stroke={c} strokeWidth={1.6} fill={c} fillOpacity={0.08}/>
        <line x1="104" y1="58" x2="104" y2="82" stroke={c} strokeWidth={0.9} opacity={0.4}/>
        <line x1="92"  y1="70" x2="116" y2="70" stroke={c} strokeWidth={0.9} opacity={0.4}/>
      </g>
      {/* Taillight */}
      <rect x="4"  y="44" width="5" height="7" rx="2"
        stroke={c} strokeWidth={1.0} fill={wh} fillOpacity={0.30}/>
    </g>
  );
  return flip
    ? <g transform="scale(-1,1) translate(-134,0)">{g}</g>
    : <>{g}</>;
}

// ─── Interactive bird perch ───────────────────────────────────────────────────
const BIRD_PERCH_SPOTS = [
  { id:"bp1", x:12, y:37 },
  { id:"bp2", x:33, y:34 },
  { id:"bp3", x:56, y:38 },
  { id:"bp4", x:76, y:35 },
] as const;
type BirdPerch = typeof BIRD_PERCH_SPOTS[number];

function SvgBirdSit({ c }: { c:string }) {
  return (
    <g>
      <ellipse cx="13" cy="9"  rx="8" ry="5"   stroke={c} strokeWidth={1.5} fill="none"/>
      <path d="M5,10 Q2,13 3,16"               stroke={c} strokeWidth={1.3} fill="none" strokeLinecap="round"/>
      <circle  cx="19" cy="5"  r="5"            stroke={c} strokeWidth={1.5} fill="none"/>
      <circle  cx="21" cy="4"  r="1"            fill={c}/>
      <path d="M23,5 L27,6 L23,7"              stroke="#C8A870" strokeWidth={1.1} strokeLinecap="round"/>
      <path d="M7,9 Q13,7 17,8"               stroke={c} strokeWidth={1.0} fill="none"/>
      <line x1="11" y1="14" x2="9"  y2="17"   stroke="#C8A870" strokeWidth={1.3} strokeLinecap="round"/>
      <line x1="9"  y1="17" x2="6"  y2="18"   stroke="#C8A870" strokeWidth={1.1} strokeLinecap="round"/>
      <line x1="9"  y1="17" x2="9"  y2="20"   stroke="#C8A870" strokeWidth={1.1} strokeLinecap="round"/>
      <line x1="15" y1="14" x2="17" y2="17"   stroke="#C8A870" strokeWidth={1.3} strokeLinecap="round"/>
      <line x1="17" y1="17" x2="20" y2="18"   stroke="#C8A870" strokeWidth={1.1} strokeLinecap="round"/>
      <line x1="17" y1="17" x2="17" y2="20"   stroke="#C8A870" strokeWidth={1.1} strokeLinecap="round"/>
    </g>
  );
}

function InteractiveBird({ spot, onDone }: { spot:BirdPerch; onDone:()=>void }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [clicked, setClicked] = useState(false);
  const flyDir  = useRef(Math.random() > 0.5 ? 1 : -1);
  const timersB = useRef<ReturnType<typeof setTimeout>[]>([]);
  const c = "#B8AFA6";

  const atB = (ms:number, fn:()=>void) => { const t = setTimeout(fn, ms); timersB.current.push(t); };
  const clearB = useCallback(() => { timersB.current.forEach(clearTimeout); timersB.current = []; }, []);

  useEffect(() => {
    atB(40,  () => setVisible(true));
    const idleMs = Math.round(rnd(10_000, 15_000));
    atB(1200 + idleMs, () => { setLeaving(true); atB(900, onDone); });
    return clearB;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = useCallback(() => {
    if (clicked || leaving) return;
    setClicked(true);
    clearB();
    setLeaving(true);
    setTimeout(onDone, 900);
  }, [clicked, leaving, clearB, onDone]);

  const tx = leaving ? `${flyDir.current * 32}vw` : "0px";
  const ty = !visible ? "-45px" : leaving ? "-55px" : "0px";
  const op = !visible || leaving ? 0 : 1;

  return (
    <div
      role="button" tabIndex={0} aria-label="Спугнуть птицу"
      style={{
        position:"absolute", left:`${spot.x}%`, bottom:`${spot.y}%`,
        pointerEvents:"auto", cursor:"pointer",
        padding:"14px", margin:"-14px",
        transition:"transform 0.85s cubic-bezier(0.2,0,0.1,1), opacity 0.65s ease",
        transform:`translateX(${tx}) translateY(${ty})`,
        opacity:op,
      }}
      onClick={handleClick}
      onKeyDown={(e)=>{ if(e.key==="Enter"||e.key===" ") handleClick(); }}
    >
      <svg viewBox="0 0 30 22" width={30} height={22} aria-hidden>
        <SvgBirdSit c={c}/>
      </svg>
    </div>
  );
}

// ─── Interactive cat from building edge ───────────────────────────────────────
const CAT_SPOT_POSITIONS = [
  { id:"cs1", x:10, y:16, entryFrom:"left"  as const },
  { id:"cs2", x:48, y:15, entryFrom:"left"  as const },
  { id:"cs3", x:78, y:17, entryFrom:"right" as const },
] as const;
type CatSpot = typeof CAT_SPOT_POSITIONS[number];

function InteractiveCat({ spot, onDone }: { spot:CatSpot; onDone:()=>void }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [isIdle,  setIsIdle]  = useState(false);
  const [clicked, setClicked] = useState(false);
  const timersC = useRef<ReturnType<typeof setTimeout>[]>([]);
  const c = "#bfb6aa";

  const atC = (ms:number, fn:()=>void) => { const t = setTimeout(fn, ms); timersC.current.push(t); };
  const clearC = useCallback(() => { timersC.current.forEach(clearTimeout); timersC.current = []; }, []);

  useEffect(() => {
    atC(40,  () => setVisible(true));
    atC(1400, () => setIsIdle(true));
    const idleMs = Math.round(rnd(12_000, 20_000));
    atC(1400 + idleMs, () => { setIsIdle(false); setLeaving(true); atC(1100, onDone); });
    return clearC;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = useCallback(() => {
    if (clicked || leaving) return;
    setClicked(true);
    clearC();
    setIsIdle(false);
    setLeaving(true);
    setTimeout(onDone, 1000);
  }, [clicked, leaving, clearC, onDone]);

  const fromLeft = spot.entryFrom === "left";
  const dispW = 44;
  // Slide from behind building edge; the container clips during entry/exit
  const slideX = !visible ? (fromLeft ? -dispW : dispW) : leaving ? (fromLeft ? -dispW - 8 : dispW + 8) : 0;
  const op     = !visible || leaving ? 0 : 1;

  return (
    <div style={{
      position:"absolute", left:`${spot.x}%`, bottom:`${spot.y}%`,
      width: dispW + 20, height:52, overflow:"hidden",
      pointerEvents: isIdle ? "auto" : "none",
    }}>
      <div
        role={isIdle ? "button" : undefined}
        tabIndex={isIdle ? 0 : undefined}
        aria-label={isIdle ? "Позвать кошку" : undefined}
        style={{
          transform:`translateX(${slideX}px)`,
          opacity: op,
          transition:"transform 1.4s ease-out, opacity 0.7s ease",
          cursor: isIdle ? "pointer" : "default",
        }}
        onClick={isIdle ? handleClick : undefined}
        onKeyDown={isIdle ? (e)=>{ if(e.key==="Enter"||e.key===" ") handleClick(); } : undefined}
      >
        <svg viewBox="0 0 52 58" width={dispW} height={50} aria-hidden>
          <SvgCat flip={!fromLeft} c={c} isLooking={isIdle}/>
        </svg>
      </div>
    </div>
  );
}

// ─── Crow ─────────────────────────────────────────────────────────────────────
// Phases: flying-in → perched (profile) → looking (turns front) → sitting (tucks legs)
//         → cawing (open beak) → flying-out (turns back, profile)
type CrowPhase = "flying-in" | "perched" | "looking" | "sitting" | "cawing" | "flying-out";
interface CrowInfo { id:string; fromLeft:boolean; perchX:number; perchY:number; }

const CROW_PERCHES = [
  { x:8,  y:40 }, { x:23, y:37 }, { x:44, y:42 },
  { x:63, y:36 }, { x:80, y:41 },
];

function SvgCrow({ phase, fromLeft }: { phase:CrowPhase; fromLeft:boolean }) {
  const c   = "#B8AFA6";
  const BK  = "#C8A870";
  const SW  = 2.0;
  const flying  = phase === "flying-in" || phase === "flying-out";
  const frontal = phase === "looking" || phase === "sitting" || phase === "cawing";
  const tucked  = phase === "sitting"  || phase === "cawing";
  const cawing  = phase === "cawing";

  const wL: React.CSSProperties = {
    transformBox:"fill-box" as React.CSSProperties["transformBox"],
    transformOrigin:"100% 80%", animation:"crowWingL 0.42s ease-in-out infinite",
  };
  const wR: React.CSSProperties = {
    transformBox:"fill-box" as React.CSSProperties["transformBox"],
    transformOrigin:"0% 80%", animation:"crowWingR 0.42s ease-in-out infinite",
  };

  // ── Front-facing view (looking / sitting / cawing) ─────────────────────────
  if (frontal) {
    // CSS transition on leg group: scaleY(0.58) from top = legs fold up toward body
    const legStyle: React.CSSProperties = {
      transform:       tucked ? "scaleY(0.58)" : "scaleY(1)",
      transformBox:    "fill-box" as React.CSSProperties["transformBox"],
      transformOrigin: "50% 0%",
      transition:      "transform 0.8s ease-out",
    };
    return (
      <svg viewBox="0 0 120 108" width={90} height={81} aria-hidden overflow="visible">
        {/* Body: centered upright oval */}
        <ellipse cx="60" cy="66" rx="18" ry="20" stroke={c} strokeWidth={SW} fill="none"/>
        {/* Wings folded — visible as side arcs */}
        <path d="M42,62 Q24,54 18,44 Q26,56 42,68" stroke={c} strokeWidth={SW} fill="none" strokeLinejoin="round"/>
        <path d="M78,62 Q96,54 102,44 Q94,56 78,68" stroke={c} strokeWidth={SW} fill="none" strokeLinejoin="round"/>
        {/* Wing feather hint */}
        <path d="M44,60 Q38,54 44,50" stroke={c} strokeWidth={1.1} fill="none"/>
        <path d="M76,60 Q82,54 76,50" stroke={c} strokeWidth={1.1} fill="none"/>
        {/* Tail at bottom */}
        <path d="M49,84 Q60,97 71,84" stroke={c} strokeWidth={SW} fill="none" strokeLinecap="round"/>
        {/* Head: centered */}
        <circle cx="60" cy="30" r="18" stroke={c} strokeWidth={SW} fill="none"/>
        {/* Eyes: symmetric, pupils looking at viewer */}
        <circle cx="51" cy="26" r="5.5" stroke={c} strokeWidth={1.4} fill="none"/>
        <circle cx="52" cy="26" r="2.4" fill={c}/>
        <circle cx="69" cy="26" r="5.5" stroke={c} strokeWidth={1.4} fill="none"/>
        <circle cx="68" cy="26" r="2.4" fill={c}/>
        {/* Beak: front-facing triangle pointing down */}
        {cawing
          ? <path d="M54,43 L66,43 L60,56 Z" stroke={BK} strokeWidth={1.5} fill="none" strokeLinejoin="round"/>
          : <path d="M54,43 L66,43 L60,50 Z" stroke={BK} strokeWidth={1.5} fill="none" strokeLinejoin="round"/>
        }
        {/* Legs: animate tuck with CSS scaleY from top of group */}
        <g style={legStyle} stroke={BK} strokeWidth="1.9" strokeLinecap="round" fill="none">
          {/* left leg */}
          <line x1="52" y1="84" x2="44" y2="96"/>
          <line x1="44" y1="96" x2="36" y2="99"/>
          <line x1="44" y1="96" x2="44" y2="103"/>
          <line x1="44" y1="96" x2="52" y2="100"/>
          {/* right leg */}
          <line x1="68" y1="84" x2="76" y2="96"/>
          <line x1="76" y1="96" x2="84" y2="99"/>
          <line x1="76" y1="96" x2="76" y2="103"/>
          <line x1="76" y1="96" x2="68" y2="100"/>
        </g>
      </svg>
    );
  }

  // ── Profile view (flying-in, perched, flying-out) ──────────────────────────
  const profileBody = (
    <g>
      {/* body */}
      <ellipse cx="60" cy="62" rx="22" ry="14" stroke={c} strokeWidth={SW} fill="none"/>
      {/* tail */}
      {!flying && <path d="M38,64 Q28,76 34,84 Q38,74 42,84 Q46,74 38,64" stroke={c} strokeWidth={SW} fill="none" strokeLinejoin="round"/>}
      {/* wings */}
      {flying ? (
        <>
          <g style={wL}><path d="M38,58 Q16,36 8,18 Q22,32 32,48 Q20,28 24,14 Q36,30 38,54" stroke={c} strokeWidth={SW} fill="none" strokeLinejoin="round"/></g>
          <g style={wR}><path d="M82,58 Q104,36 112,18 Q98,32 88,48 Q100,28 96,14 Q84,30 82,54" stroke={c} strokeWidth={SW} fill="none" strokeLinejoin="round"/></g>
        </>
      ) : (
        <>
          <path d="M38,60 Q34,50 40,44 Q46,50 44,60" stroke={c} strokeWidth={SW} fill="none" strokeLinejoin="round"/>
          <path d="M82,60 Q86,50 80,44 Q74,50 76,60" stroke={c} strokeWidth={SW} fill="none" strokeLinejoin="round"/>
          <path d="M40,60 Q38,53 43,49" stroke={c} strokeWidth={1.1} fill="none"/>
          <path d="M45,60 Q43,52 49,49" stroke={c} strokeWidth={1.1} fill="none"/>
          <path d="M80,60 Q82,53 77,49" stroke={c} strokeWidth={1.1} fill="none"/>
          <path d="M75,60 Q77,52 71,49" stroke={c} strokeWidth={1.1} fill="none"/>
        </>
      )}
      {/* head */}
      <circle cx="75" cy="34" r="20" stroke={c} strokeWidth={SW} fill="none"/>
      {/* eye (single — profile) */}
      <circle cx="84" cy="28" r="5.5" stroke={c} strokeWidth={1.4} fill="none"/>
      <circle cx="85" cy="28" r="2.5" fill={c}/>
      {/* beak */}
      <path d="M93,30 L110,26 L93,38 Z" stroke={BK} strokeWidth={1.4} fill="none" strokeLinejoin="round"/>
      {/* feet */}
      {!flying && (
        <g stroke={BK} strokeWidth="2.0" strokeLinecap="round" fill="none">
          <line x1="52" y1="75" x2="44" y2="85"/>
          <line x1="44" y1="85" x2="36" y2="88"/>
          <line x1="44" y1="85" x2="44" y2="90"/>
          <line x1="44" y1="85" x2="52" y2="89"/>
          <line x1="68" y1="75" x2="76" y2="85"/>
          <line x1="76" y1="85" x2="84" y2="88"/>
          <line x1="76" y1="85" x2="76" y2="90"/>
          <line x1="76" y1="85" x2="68" y2="89"/>
        </g>
      )}
    </g>
  );

  return (
    <svg viewBox="0 0 120 100" width={90} height={75} aria-hidden overflow="visible">
      {!fromLeft ? <g transform="scale(-1,1) translate(-120,0)">{profileBody}</g> : profileBody}
    </svg>
  );
}

// ─── Easter egg: paper airplane ───────────────────────────────────────────────
function PaperPlane({ active, onDone }: { active:boolean; onDone:()=>void }) {
  const [animName, setAnimName] = useState<string|null>(null);
  const durRef = useRef(5);

  useEffect(() => {
    if (!active) { setAnimName(null); return; }
    const id = `pln_${crypto.randomUUID().slice(0,8)}`;
    const d  = rnd(4.5, 7);
    durRef.current = d;
    const styleEl = document.createElement("style");
    styleEl.id = id;
    styleEl.textContent = `@keyframes ${id}{`+
      `0%   {transform:translateX(0px)   translateY(0px)   rotate(-12deg);opacity:1}`+
      `20%  {transform:translateX(14vw)  translateY(-28px) rotate(-5deg); opacity:1}`+
      `50%  {transform:translateX(38vw)  translateY(-52px) rotate(4deg);  opacity:1}`+
      `78%  {transform:translateX(62vw)  translateY(-22px) rotate(10deg); opacity:1}`+
      `100% {transform:translateX(calc(80vw + 80px)) translateY(12px) rotate(15deg);opacity:0.2}`+
      `}`;
    document.head.appendChild(styleEl);
    setAnimName(id);
    const t = setTimeout(() => { document.getElementById(id)?.remove(); setAnimName(null); onDone(); },
      d * 1000 + 400);
    return () => { clearTimeout(t); document.getElementById(id)?.remove(); };
  }, [active, onDone]);

  if (!animName) return null;
  const c = "#B8AFA6";
  return (
    <div style={{
      position:"absolute", left:"34%", bottom:"50%",
      pointerEvents:"none", zIndex:4,
      animation:`${animName} ${durRef.current.toFixed(1)}s ease-in-out forwards`,
    }}>
      <svg viewBox="0 0 30 22" width={30} height={22} aria-hidden>
        {/* nose points RIGHT (direction of travel) */}
        <path d="M30,10 L0,0 L8,10 L0,20 Z"
              stroke={c} strokeWidth={1.7} fill="none" strokeLinejoin="round"/>
        <line x1="30" y1="10" x2="8" y2="10" stroke={c} strokeWidth={1.2} strokeLinecap="round"/>
        <path d="M8,10 L12,15"                stroke={c} strokeWidth={1.1} strokeLinecap="round"/>
      </svg>
    </div>
  );
}

// ─── Easter egg: window escaper ───────────────────────────────────────────────
type EscaperPhase = "appearing" | "opening" | "ledge" | "looking" | "fleeing";

function WindowEscaper({ active, onDone }: { active:boolean; onDone:()=>void }) {
  const [phase,   setPhase]   = useState<EscaperPhase|null>(null);
  const [lookDir, setLookDir] = useState<"left"|"right"|"front">("front");

  useEffect(() => {
    if (!active) { setPhase(null); return; }
    setPhase("appearing");
    setLookDir("front");
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms:number, fn:()=>void) => timers.push(setTimeout(fn, ms));
    at(900,  () => setPhase("opening"));
    at(1700, () => setPhase("ledge"));
    at(2700, () => { setPhase("looking"); setLookDir("left"); });
    at(3600, () => setLookDir("right"));
    at(4500, () => setLookDir("front")); // sees viewer!
    at(5000, () => setPhase("fleeing"));
    at(6600, () => { setPhase(null); onDone(); });
    return () => timers.forEach(clearTimeout);
  }, [active, onDone]);

  if (!phase) return null;

  const c   = "#9F9589";
  const SW  = 1.6;
  const inW = phase === "appearing" || phase === "opening";
  const onL = phase === "ledge" || phase === "looking" || phase === "fleeing";
  const flt = phase === "fleeing";
  const eyeX = lookDir === "left" ? 3.5 : lookDir === "right" ? 8.5 : 6;
  const spotted = lookDir === "front" && phase === "looking";

  return (
    <div style={{
      position:"absolute", left:"31%", bottom:"44%",
      pointerEvents:"none", zIndex:4, overflow:"visible",
    }}>
      <svg viewBox="-12 -20 72 92" width={54} height={69} aria-hidden overflow="visible">
        {/* Window frame */}
        <rect x="0" y="0" width="30" height="42" rx="1.5"
              stroke={c} strokeWidth={1.6} fill="rgba(180,205,220,0.22)"/>
        <rect x="-2" y="40" width="34" height="3.5" rx="1" fill={c} opacity={0.6}/>
        <line x1="15" y1="0" x2="15" y2="42" stroke={c} strokeWidth={1}/>
        <line x1="0"  y1="20" x2="30" y2="20" stroke={c} strokeWidth={1}/>

        {/* Window panel opens outward */}
        {(phase === "opening" || onL) && (
          <rect x="0" y="0" width="14" height="42" rx="1.5"
                stroke={c} strokeWidth={1.3} fill="rgba(185,205,220,0.12)"
                style={{
                  transformOrigin:"0px 21px",
                  transform:"perspective(90px) rotateY(-68deg)",
                  transition:"transform 0.9s ease",
                }}/>
        )}

        {/* Person in window */}
        {inW && (
          <g style={{ opacity:phase==="appearing"?0.8:0.95, transition:"opacity 0.7s" }}>
            <circle cx="15" cy="12" r="5.5" stroke={c} strokeWidth={SW} fill="none"/>
            <line x1="15" y1="17.5" x2="15" y2="30" stroke={c} strokeWidth={SW} strokeLinecap="round"/>
          </g>
        )}

        {/* Person on ledge */}
        {onL && (
          <g style={{
            transform: flt ? "translate(8px,52px)" : "translate(0,0)",
            transition: flt ? "transform 1.4s cubic-bezier(0.3,0,0.7,1)" : "transform 0.7s ease-out",
            opacity: flt ? 0 : 1,
          }}>
            <g transform="translate(30,6)">
              {/* head */}
              <circle cx="7" cy="4" r="5" stroke={c} strokeWidth={SW} fill="none"/>
              {/* eyes */}
              {phase==="looking" && <circle cx={eyeX} cy="4" r="1.3" fill={c}/>}
              {/* "!" bubble when spotted */}
              {spotted && (
                <>
                  <ellipse cx="20" cy="-4" rx="6" ry="5" fill="white" stroke={c} strokeWidth={1}/>
                  <text x="20" y="-1" textAnchor="middle" fontSize="8" fontWeight="bold" fill={c}>!</text>
                </>
              )}
              {/* body */}
              <line x1="7" y1="9" x2="7" y2="22" stroke={c} strokeWidth={SW} strokeLinecap="round"/>
              {/* arms spread (comedy balance) */}
              <line x1="7" y1="13" x2="-5" y2="10" stroke={c} strokeWidth={SW-0.4} strokeLinecap="round"/>
              <line x1="7" y1="13" x2="19" y2="10" stroke={c} strokeWidth={SW-0.4} strokeLinecap="round"/>
              {/* legs */}
              <line x1="7" y1="22" x2="1"  y2="33" stroke={c} strokeWidth={SW} strokeLinecap="round"/>
              <line x1="7" y1="22" x2="13" y2="33" stroke={c} strokeWidth={SW} strokeLinecap="round"/>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}

function CrowScene({ crow, onDone }: { crow:CrowInfo|null; onDone:()=>void }) {
  const [phase, setPhase] = useState<CrowPhase>("flying-in");

  useEffect(() => {
    if (!crow) return;
    const kIn  = `crIn_${crow.id}`;
    const kOut = `crOut_${crow.id}`;
    // Crow is at left:perchX% — translations must reach actual screen edges
    const px = crow.perchX;
    // fly-in: crow comes FROM the side it started, so it needs to travel perchX% + margin
    const inFrom  = crow.fromLeft
      ? `calc(-${px}vw - 180px)`          // start left of screen edge
      : `calc(${100 - px}vw + 180px)`;    // start right of screen edge
    // fly-out: crow exits to opposite side
    const outTo   = crow.fromLeft
      ? `calc(${100 - px}vw + 180px)`     // exit right screen edge
      : `calc(-${px}vw - 180px)`;         // exit left screen edge
    const styleEl = document.createElement("style");
    styleEl.id = `crow_${crow.id}`;
    styleEl.textContent =
      `@keyframes ${kIn}{from{transform:translateX(${inFrom}) translateY(60px)}to{transform:none}}`+
      `@keyframes ${kOut}{from{transform:none}to{transform:translateX(${outTo}) translateY(-50px)}}`;
    document.head.appendChild(styleEl);
    setPhase("flying-in");

    // Timing: fly-in → perched (profile) → looking (turns front) →
    //         sitting (tucks legs) → cawing (opens beak) → fly-out
    const cum = [2400, 3600, 5000, 7000, 8400, 10000];
    const t1 = setTimeout(() => setPhase("perched"),    cum[0]);
    const t2 = setTimeout(() => setPhase("looking"),    cum[1]);
    const t3 = setTimeout(() => setPhase("sitting"),    cum[2]);
    const t4  = setTimeout(() => setPhase("cawing"),     cum[3]);
    const t5  = setTimeout(() => setPhase("flying-out"), cum[4]);
    const t6  = setTimeout(() => onDone(),               cum[5]);
    return () => {
      [t1,t2,t3,t4,t5,t6].forEach(clearTimeout);
      document.getElementById(`crow_${crow.id}`)?.remove();
    };
  }, [crow, onDone]);

  if (!crow) return null;

  const anim = phase === "flying-in"  ? `crIn_${crow.id} 2.5s ease-out forwards`
             : phase === "flying-out" ? `crOut_${crow.id} 2.1s ease-in forwards`
             : undefined;

  return (
    <div style={{
      position:"absolute", left:`${crow.perchX}%`, bottom:`${crow.perchY}%`,
      animation:anim, willChange:"transform", zIndex:5,
    }}>
      <SvgCrow phase={phase} fromLeft={crow.fromLeft}/>
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
  const isCatStop = type === "cat";
  const isDogPee  = type === "dog" && Math.random() < 0.55; // 55% dogs stop to pee
  const stopFraction = (isCatStop || isDogPee) ? parseFloat(rnd(0.28, 0.65).toFixed(2)) : undefined;
  const pauseMs      = isCatStop ? Math.round(rnd(2000, 3200))
                     : isDogPee  ? Math.round(rnd(2800, 4500)) : undefined;
  const isPeeStop = isDogPee ? true : undefined;
  const humanVariant: HumanVariant | undefined = type === "human"
    ? (["man","man","woman","child"] as HumanVariant[])[Math.floor(Math.random() * 4)]
    : undefined;

  // Human: random stop or turn-around
  let humanStopFraction: number | undefined;
  let humanStopMs: number | undefined;
  let humanReverseFraction: number | undefined;
  if (type === "human") {
    const r = Math.random();
    if (r < 0.28) {           // 28%: stop and stand
      humanStopFraction = parseFloat(rnd(0.25, 0.65).toFixed(2));
      humanStopMs       = Math.round(rnd(2000, 4500));
    } else if (r < 0.46) {   // 18%: turn around
      humanReverseFraction = parseFloat(rnd(0.28, 0.70).toFixed(2));
    }
  }

  return {
    id: crypto.randomUUID(), type, direction, durationS, level,
    stopFraction, pauseMs, isPeeStop, humanVariant,
    humanStopFraction, humanStopMs, humanReverseFraction,
  };
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
  const [actors,         setActors]        = useState<ActiveActor[]>([]);
  const [crowInfo,       setCrowInfo]      = useState<CrowInfo | null>(null);
  const [escaperActive,  setEscaperActive] = useState(false);
  const [planeActive,    setPlaneActive]   = useState(false);
  const [ibirdSpot,      setIbirdSpot]     = useState<BirdPerch | null>(null);
  const [icatSpot,       setIcatSpot]      = useState<CatSpot  | null>(null);
  const [reducedMotion,  setReducedMotion] = useState(false);
  // Mounted flag for createPortal (SSR guard)
  const [mounted,        setMounted]       = useState(false);
  const crowActive       = useRef(false);
  const escaperRunning   = useRef(false);
  const planeRunning     = useRef(false);
  const interactiveActive = useRef(false);  // one interactive event at a time

  const groundTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const birdTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const crowTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const escaperTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const planeTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ibirdTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const icatTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setMounted(true); }, []);

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


  const removeActor = useCallback((id: string) => {
    setActors(prev => prev.filter(a => a.id !== id));
  }, []);

  const handleCrowDone = useCallback(() => {
    setCrowInfo(null);
    crowActive.current = false;
  }, []);

  const handleEscaperDone = useCallback(() => {
    setEscaperActive(false);
    escaperRunning.current = false;
  }, []);

  const handlePlaneDone = useCallback(() => {
    setPlaneActive(false);
    planeRunning.current = false;
  }, []);

  const handleIbirdDone = useCallback(() => {
    setIbirdSpot(null);
    interactiveActive.current = false;
  }, []);

  const handleIcatDone = useCallback(() => {
    setIcatSpot(null);
    interactiveActive.current = false;
  }, []);

  // Crow spawn: once per ~60s, not at night
  const scheduleCrow = useCallback((delay: number) => {
    crowTimer.current = setTimeout(() => {
      if (getTimeMode() !== "night") {
        crowActive.current = true;
        const p = CROW_PERCHES[Math.floor(Math.random() * CROW_PERCHES.length)];
        setCrowInfo({ id: crypto.randomUUID(), fromLeft: Math.random() > 0.5, perchX: p.x, perchY: p.y });
      }
      scheduleCrow(rnd(55_000, 75_000));
    }, delay);
  }, []);

  // Window escaper: once per 5-10 min, not at night, not while crow is active
  const scheduleEscaper = useCallback((delay: number) => {
    escaperTimer.current = setTimeout(() => {
      if (getTimeMode() !== "night" && !crowActive.current && !escaperRunning.current) {
        escaperRunning.current = true;
        setEscaperActive(true);
      }
      scheduleEscaper(rnd(300_000, 600_000));
    }, delay);
  }, []);

  // Paper airplane: once per 2-4 min, not at night
  const schedulePlane = useCallback((delay: number) => {
    planeTimer.current = setTimeout(() => {
      if (getTimeMode() !== "night" && !planeRunning.current) {
        planeRunning.current = true;
        setPlaneActive(true);
      }
      schedulePlane(rnd(120_000, 240_000));
    }, delay);
  }, []);

  // Interactive bird: sits on roof, can be clicked, 2-3 min intervals
  const scheduleIbird = useCallback((delay: number) => {
    ibirdTimer.current = setTimeout(() => {
      if (getTimeMode() !== "night" && !interactiveActive.current) {
        interactiveActive.current = true;
        const spot = BIRD_PERCH_SPOTS[Math.floor(Math.random() * BIRD_PERCH_SPOTS.length)];
        setIbirdSpot(spot);
      }
      scheduleIbird(rnd(120_000, 180_000));
    }, delay);
  }, []);

  // Interactive cat: comes out from behind building, 2-3 min intervals
  const scheduleIcat = useCallback((delay: number) => {
    icatTimer.current = setTimeout(() => {
      if (getTimeMode() !== "night" && !interactiveActive.current) {
        interactiveActive.current = true;
        const spot = CAT_SPOT_POSITIONS[Math.floor(Math.random() * CAT_SPOT_POSITIONS.length)];
        setIcatSpot(spot);
      }
      scheduleIcat(rnd(120_000, 180_000));
    }, delay);
  }, []);

  const scheduleGround = useCallback((delay: number) => {
    groundTimer.current = setTimeout(() => {
      setActors(prev => {
        const a = makeGroundActor(prev);
        return a ? [...prev, a] : prev;
      });
      scheduleGround(rnd(18_000, 34_000));
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
    scheduleCrow(rnd(10_000, 20_000));
    scheduleEscaper(rnd(60_000, 90_000));
    schedulePlane(rnd(20_000, 40_000));
    scheduleIbird(rnd(45_000, 90_000));   // first interactive bird 45-90s after load
    scheduleIcat(rnd(60_000, 120_000));   // first interactive cat 60-120s after load (offset from bird)
    return () => {
      if (groundTimer.current)  clearTimeout(groundTimer.current);
      if (birdTimer.current)    clearTimeout(birdTimer.current);
      if (crowTimer.current)    clearTimeout(crowTimer.current);
      if (escaperTimer.current) clearTimeout(escaperTimer.current);
      if (planeTimer.current)   clearTimeout(planeTimer.current);
      if (ibirdTimer.current)   clearTimeout(ibirdTimer.current);
      if (icatTimer.current)    clearTimeout(icatTimer.current);
    };
  }, [reducedMotion, scheduleGround, scheduleBird, scheduleCrow, scheduleEscaper, schedulePlane, scheduleIbird, scheduleIcat]);

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
      {/* Actor overlay is rendered via portal at document.body to fully escape
          overflow:hidden on AppShell/main (Blink clips fixed descendants of
          overflow:hidden scroll containers on Windows). z-index:1 puts actors
          above the city image (z=0) but below the sidebar wrapper (z=10). */}
      {mounted && !reducedMotion && createPortal(
        <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:1 }}>
          {actors.map(a => (
            <ActorEl key={a.id} actor={a} onFinish={removeActor}/>
          ))}
          {crowInfo && (
            <CrowScene crow={crowInfo} onDone={handleCrowDone}/>
          )}
          <WindowEscaper active={escaperActive} onDone={handleEscaperDone}/>
          <PaperPlane active={planeActive} onDone={handlePlaneDone}/>
          {ibirdSpot && (
            <InteractiveBird key={ibirdSpot.id + Date.now()} spot={ibirdSpot} onDone={handleIbirdDone}/>
          )}
          {icatSpot && (
            <InteractiveCat key={icatSpot.id + Date.now()} spot={icatSpot} onDone={handleIcatDone}/>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
