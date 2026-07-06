"use client";

import { useEffect, useRef, useState } from "react";

// ── Palette ───────────────────────────────────────────────────────────────────
const PALETTE = [
  { fill: "rgba(180,160,212,0.82)", stroke: "rgba(210,190,240,0.95)", glow: "rgba(180,160,212,0.38)", baseFreq: 440.00 },
  { fill: "rgba(142,202,180,0.82)", stroke: "rgba(172,232,210,0.95)", glow: "rgba(142,202,180,0.38)", baseFreq: 329.63 },
  { fill: "rgba(212,144,144,0.82)", stroke: "rgba(242,174,174,0.95)", glow: "rgba(212,144,144,0.38)", baseFreq: 261.63 },
] as const;

function bR(mc: number) { return 15 + mc * 9; }

const GRAVITY_BASE = 410;
const DAMPING  = 0.36;
const FRICTION = 0.87;
const ITERS    = 4;
const WALL     = 3;

type FreqKey  = "slow" | "normal" | "fast";
type SpeedKey = "slow" | "normal" | "fast";
type LevelKey = 1 | 2 | 3;

const FREQ_INT:  Record<FreqKey,  number> = { slow: 4.2, normal: 2.2, fast: 0.9 };
const SPEED_MUL: Record<SpeedKey, number> = { slow: 0.55, normal: 1.0, fast: 1.65 };

// ── Ball ──────────────────────────────────────────────────────────────────────
class Ball {
  static _id = 0;
  id = Ball._id++;
  vx = 0; vy = 0; merged = false; pulseT = 0; r: number;
  hits = new Map<number, number>();
  constructor(public x: number, public y: number, public ci: number, public mc = 0) {
    this.r = bR(mc);
  }
  canHit(id: number) { return Date.now() - (this.hits.get(id) ?? 0) > 380; }
  regHit(id: number) { this.hits.set(id, Date.now()); }
}

interface DropSlot { ball: Ball; done: boolean }
interface Flash    { x: number; y: number; r: number; op: number; ci: number }

// ── Component ─────────────────────────────────────────────────────────────────
export function ZenDropsGame() {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const [showCfg,   setShowCfg]   = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [freq,     setFreq]     = useState<FreqKey>("normal");
  const [speed,    setSpeed]    = useState<SpeedKey>("normal");
  const [level,    setLevel]    = useState<LevelKey>(1);
  const [escalate, setEscalate] = useState(false);

  // Settings live-ref so game loop reads latest without re-creating
  const cfgRef = useRef({ freq, speed, level, escalate });
  useEffect(() => { cfgRef.current = { freq, speed, level, escalate }; }, [freq, speed, level, escalate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    let W = 0, H = 0;
    let FL = 0, FR = 0, FW = 0; // field left / right / width
    let cursorX = 0;

    function resize() {
      W  = canvas!.width  = canvas!.offsetWidth;
      H  = canvas!.height = canvas!.offsetHeight;
      FW = Math.round(W / 3);
      FL = Math.round((W - FW) / 2);
      FR = FL + FW;
      if (cursorX === 0) cursorX = FL + FW / 2;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // ── Audio ─────────────────────────────────────────────────────────────────
    let ac: AudioContext | null = null;
    let master: GainNode | null = null;
    let verb: ConvolverNode | null = null;

    function bootAudio() {
      if (ac) return;
      ac = new AudioContext(); master = ac.createGain(); master.gain.value = 0.45;
      const sr = ac.sampleRate, len = Math.floor(sr * 1.8);
      const buf = ac.createBuffer(2, len, sr);
      for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1)*Math.pow(1-i/len,2.8); }
      verb = ac.createConvolver(); verb.buffer = buf;
      const rg = ac.createGain(); rg.gain.value = 0.28;
      verb.connect(rg); rg.connect(ac.destination); master.connect(ac.destination);
    }
    function tone(f: number, dur: number, vol: number, type: OscillatorType = "sine") {
      if (!ac || !master || !verb) return;
      if (ac.state === "suspended") void ac.resume();
      const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t+0.012); g.gain.exponentialRampToValueAtTime(0.001, t+dur);
      o.connect(g); g.connect(master!); g.connect(verb!); o.start(t); o.stop(t+dur+0.04);
    }
    const sndMerge       = (ci: number, mc: number) => tone(PALETTE[ci].baseFreq * Math.pow(0.6, mc-1), 1.6, 0.22);
    const sndBigHit      = (mc: number)              => tone(200 / (1 + mc*0.35), 0.7, 0.14);

    // ── Game state ────────────────────────────────────────────────────────────
    let balls: Ball[]      = [];
    let slots: DropSlot[]  = [];
    let flashes: Flash[]   = [];
    const merges           = [0, 0, 0];
    let elapsedMs          = 0;
    let waitTimer          = 0;     // time waiting for next batch
    let batchTimer         = 0;     // time within current batch spawn
    let batchSpawned       = 0;     // how many spawned in current batch
    let inBatch            = false;

    function randColor() { return Math.floor(Math.random() * 3); }
    function clampX(x: number, r: number) { return Math.max(FL + r + 3, Math.min(FR - r - 3, x)); }

    function addSlot(xHint?: number) {
      const r = bR(0);
      const x = xHint !== undefined ? xHint : FL + FW / 2;
      slots.push({ ball: new Ball(x, r + 72, randColor()), done: false });
    }
    addSlot(FL + FW / 2); // initial

    function commitSlot(s: DropSlot) {
      if (s.done) return;
      s.done = true;
      const b  = s.ball;
      const sm = SPEED_MUL[cfgRef.current.speed];
      b.vy = 60 * sm;
      b.vx = 0;
      balls.push(b);
    }

    // ── Physics ───────────────────────────────────────────────────────────────
    function step(dt: number) {
      const grav = GRAVITY_BASE * SPEED_MUL[cfgRef.current.speed];
      const floor = H - WALL;
      balls.forEach(b => {
        if (b.merged) return;
        b.vy += grav * dt; b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.y + b.r > floor) { b.y = floor - b.r; b.vy = -Math.abs(b.vy)*DAMPING; b.vx *= FRICTION; }
        if (b.x - b.r < FL)   { b.x = FL + b.r;    b.vx =  Math.abs(b.vx)*DAMPING; }
        if (b.x + b.r > FR)   { b.x = FR - b.r;    b.vx = -Math.abs(b.vx)*DAMPING; }
      });
      for (let it = 0; it < ITERS; it++) {
        for (let i = 0; i < balls.length; i++) {
          const a = balls[i]; if (a.merged) continue;
          for (let j = i+1; j < balls.length; j++) {
            const b = balls[j]; if (b.merged) continue;
            const dx = b.x-a.x, dy = b.y-a.y, d = Math.sqrt(dx*dx+dy*dy), mn = a.r+b.r;
            if (d >= mn || d < 0.001) continue;
            const nx = dx/d, ny = dy/d, pen = (mn-d)*0.5;
            a.x -= nx*pen; a.y -= ny*pen; b.x += nx*pen; b.y += ny*pen;
            const rv = (b.vx-a.vx)*nx + (b.vy-a.vy)*ny;
            if (rv < 0) { const imp=rv*(1+DAMPING)*0.5; a.vx+=imp*nx; a.vy+=imp*ny; b.vx-=imp*nx; b.vy-=imp*ny; }
            if (a.canHit(b.id)) {
              a.regHit(b.id); b.regHit(a.id);
              const same=a.ci===b.ci, willMerge=same&&a.mc===b.mc;
              if (!willMerge) {
                const big=Math.max(a.mc,b.mc), small=Math.min(a.mc,b.mc);
                if (big>=2&&big>small+1) sndBigHit(big);
              }
            }
          }
        }
      }
    }

    function checkMerges() {
      for (let i = 0; i < balls.length; i++) {
        const a = balls[i]; if (a.merged) continue;
        for (let j = i+1; j < balls.length; j++) {
          const b = balls[j]; if (b.merged||b.ci!==a.ci||b.mc!==a.mc) continue;
          if (Math.sqrt((b.x-a.x)**2+(b.y-a.y)**2) > a.r+b.r+2) continue;
          const mx=(a.x+b.x)/2, my=(a.y+b.y)/2, nmc=a.mc+1;
          flashes.push({x:mx,y:my,r:a.r*1.6,op:0.92,ci:a.ci});
          sndMerge(a.ci,nmc); merges[a.ci]++;
          a.merged=true; b.merged=true;
          const nb=new Ball(mx,my,a.ci,Math.min(nmc,7)); nb.vy=-110; nb.vx=(a.vx+b.vx)*0.28; nb.pulseT=1;
          balls.push(nb);
        }
      }
      balls = balls.filter(b=>!b.merged);
    }

    // ── Input ─────────────────────────────────────────────────────────────────
    function rawX(e: MouseEvent|TouchEvent): number {
      const r = canvas!.getBoundingClientRect();
      if ("touches" in e) { const t=(e as TouchEvent).touches[0]??(e as TouchEvent).changedTouches[0]; return t.clientX-r.left; }
      return (e as MouseEvent).clientX - r.left;
    }
    function onMove(e: MouseEvent|TouchEvent) {
      const cx = rawX(e);
      if (cx >= FL && cx <= FR) cursorX = cx;
    }
    function onDown(e: MouseEvent|TouchEvent) {
      if ("touches" in e) (e as TouchEvent).preventDefault();
      bootAudio();
      const cx = rawX(e);
      if (cx < FL || cx > FR) return;
      cursorX = cx;
      const s = slots.find(sl => !sl.done);
      if (s) { s.ball.x = clampX(cx, s.ball.r); commitSlot(s); }
    }

    function onKey(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      e.preventDefault();
      bootAudio();
      const s = slots.find(sl => !sl.done);
      if (s) { s.ball.x = clampX(cursorX, s.ball.r); commitSlot(s); }
    }

    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("touchstart", onDown as EventListener, { passive: false });
    canvas.addEventListener("touchmove",  onMove as EventListener, { passive: false });
    window.addEventListener("keydown", onKey);

    // ── Draw ──────────────────────────────────────────────────────────────────
    function drawBall(b: Ball, alpha = 1) {
      const pal=PALETTE[b.ci], r=b.r+(b.pulseT>0?b.pulseT*10:0);
      ctx.save(); ctx.globalAlpha=alpha;
      const g=ctx.createRadialGradient(b.x,b.y,r*.25,b.x,b.y,r*2.3);
      g.addColorStop(0,pal.glow); g.addColorStop(1,"rgba(0,0,0,0)");
      ctx.beginPath(); ctx.arc(b.x,b.y,r*2.3,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
      ctx.beginPath(); ctx.arc(b.x,b.y,r,0,Math.PI*2);
      ctx.fillStyle=pal.fill; ctx.strokeStyle=pal.stroke; ctx.lineWidth=1.6; ctx.fill(); ctx.stroke();
      const sh=ctx.createRadialGradient(b.x-r*.32,b.y-r*.38,0,b.x,b.y,r);
      sh.addColorStop(0,"rgba(255,255,255,0.38)"); sh.addColorStop(.55,"rgba(255,255,255,0.06)"); sh.addColorStop(1,"rgba(255,255,255,0)");
      ctx.beginPath(); ctx.arc(b.x,b.y,r,0,Math.PI*2); ctx.fillStyle=sh; ctx.fill();
      ctx.restore();
    }

    function drawField() {
      // Darken sides
      ctx.fillStyle = "rgba(0,0,0,0.48)";
      ctx.fillRect(0, 0, FL, H);
      ctx.fillRect(FR, 0, W - FR, H);
      // Dashed field borders
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.07)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 9]);
      ctx.beginPath(); ctx.moveTo(FL, 0); ctx.lineTo(FL, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(FR, 0); ctx.lineTo(FR, H); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    function drawUI() {
      const cx = (FL + FR) / 2;
      const s  = Math.floor(elapsedMs / 1000);
      ctx.save();
      ctx.font = "bold 14px -apple-system, monospace";
      ctx.fillStyle = "rgba(255,255,255,0.32)";
      ctx.textAlign = "center";
      ctx.fillText(`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`, cx, 24);
      // Per-colour counters
      const dotR=5, gap=44, startX=cx-(PALETTE.length-1)*gap*0.5;
      PALETTE.forEach((pal, i) => {
        const x = startX + i*gap;
        ctx.beginPath(); ctx.arc(x-14, 39, dotR, 0, Math.PI*2);
        ctx.fillStyle=pal.fill; ctx.strokeStyle=pal.stroke; ctx.lineWidth=1.1; ctx.fill(); ctx.stroke();
        ctx.font = "500 12px -apple-system"; ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.textAlign = "left"; ctx.fillText(`×${merges[i]}`, x-7, 43);
      });
      ctx.restore();
    }

    // ── Main loop ─────────────────────────────────────────────────────────────
    let lastT = 0, rafId = 0;

    function loop(ts: number) {
      const dt  = Math.min((ts - lastT) / 1000, 0.05);
      lastT = ts;
      elapsedMs += dt * 1000;

      const cfg = cfgRef.current;

      // First active slot follows cursor
      const firstActive = slots.find(s => !s.done);
      if (firstActive && cursorX > 0) {
        firstActive.ball.x = clampX(cursorX, firstActive.ball.r);
      }

      // Remove committed slots
      slots = slots.filter(s => !s.done);

      // Batch spawn logic — with optional very gradual escalation
      // factor decays 0.02% per second → after 10min ≈11% faster, after 60min ≈ 2× faster
      const escalateFactor = cfg.escalate
        ? Math.max(0.3, Math.pow(0.9998, elapsedMs / 1000))
        : 1;
      const effectiveFreqInt = FREQ_INT[cfg.freq] * escalateFactor;

      if (!inBatch && slots.length === 0) {
        waitTimer += dt;
        if (waitTimer >= effectiveFreqInt) {
          waitTimer = 0; inBatch = true; batchTimer = 0; batchSpawned = 0;
        }
      }
      if (inBatch) {
        batchTimer += dt;
        const toSpawn = cfg.level;
        const xPos = toSpawn === 1
          ? [FL + FW / 2]
          : toSpawn === 2
          ? [FL + FW * 0.33, FL + FW * 0.67]
          : [FL + FW * 0.25, FL + FW * 0.50, FL + FW * 0.75];
        while (batchSpawned < toSpawn && batchTimer >= batchSpawned * 0.48) {
          addSlot(xPos[batchSpawned]); batchSpawned++;
        }
        if (batchSpawned >= toSpawn) inBatch = false;
      }

      step(dt);
      checkMerges();
      balls.forEach(b => { if (b.pulseT > 0) b.pulseT = Math.max(0, b.pulseT - dt * 2.6); });
      flashes = flashes.filter(f => f.op > 0.02);
      flashes.forEach(f => { f.op *= 0.87; f.r += 1.8; });

      // ── Render ─────────────────────────────────────────────────────────────
      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(0, 0, W, H);
      const bg = ctx.createRadialGradient(W/2, H*.65, 0, W/2, H*.5, Math.max(W,H)*.65);
      bg.addColorStop(0,"rgba(18,12,32,0.55)"); bg.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

      // Floor line
      ctx.beginPath(); ctx.moveTo(FL, H-WALL); ctx.lineTo(FR, H-WALL);
      ctx.strokeStyle="rgba(255,255,255,0.05)"; ctx.lineWidth=1; ctx.stroke();

      drawField();

      // Drop guides + held balls
      slots.forEach(s => {
        if (s.done) return;
        const b = s.ball;
        ctx.save();
        ctx.globalAlpha = 0.09;
        ctx.setLineDash([3, 9]);
        ctx.beginPath(); ctx.moveTo(b.x, b.y+b.r); ctx.lineTo(b.x, H-4);
        ctx.strokeStyle="#FFFFFF"; ctx.lineWidth=1; ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        drawBall(b, 0.78);
      });

      balls.forEach(b => drawBall(b));

      flashes.forEach(f => {
        const pal=PALETTE[f.ci]; ctx.save(); ctx.globalAlpha=f.op;
        const fg=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,f.r);
        fg.addColorStop(0,pal.stroke); fg.addColorStop(1,"rgba(0,0,0,0)");
        ctx.beginPath(); ctx.arc(f.x,f.y,f.r,0,Math.PI*2); ctx.fillStyle=fg; ctx.fill();
        ctx.restore();
      });

      drawUI();
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("touchstart", onDown as EventListener);
      canvas.removeEventListener("touchmove",  onMove as EventListener);
      window.removeEventListener("keydown", onKey);
      ac?.close();
    };
  }, []);

  // ── HTML Settings overlay ─────────────────────────────────────────────────
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#0a0a0f" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }}
      />

      {/* Settings toggle */}
      <button
        onClick={() => setShowCfg(s => !s)}
        style={{
          position: "absolute", top: 10, right: 10,
          background: showCfg ? "rgba(168,148,230,0.22)" : "rgba(255,255,255,0.07)",
          border: `1px solid ${showCfg ? "rgba(168,148,230,0.45)" : "rgba(255,255,255,0.13)"}`,
          borderRadius: 8, color: showCfg ? "#D4C8F0" : "rgba(255,255,255,0.5)",
          fontSize: 12, fontWeight: 500, padding: "5px 11px 5px 9px",
          cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
          fontFamily: "-apple-system, sans-serif", transition: "all 0.18s",
          userSelect: "none",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        Настройки
      </button>

      {/* ── Intro overlay ──────────────────────────────────────────────────── */}
      {showIntro && (
        <div
          onClick={() => setShowIntro(false)}
          style={{
            position: "absolute", inset: 0,
            background: "rgba(4,3,12,0.88)",
            backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 30, cursor: "pointer",
            fontFamily: "-apple-system, sans-serif",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "rgba(14,10,28,0.97)",
              border: "1px solid rgba(168,148,230,0.22)",
              borderRadius: 20, padding: "28px 28px 22px",
              maxWidth: 340, width: "90%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
            }}
          >
            {/* Title */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#D4C8F0", letterSpacing: "0.04em" }}>
                Zen Droplets
              </div>
              <div style={{ fontSize: 11, color: "rgba(168,148,230,0.6)", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                как играть
              </div>
            </div>

            {/* Step 1 */}
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(168,148,230,0.15)", border: "1px solid rgba(168,148,230,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#A898E0", fontSize: 14, fontWeight: 700 }}>1</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#E0D8F8", marginBottom: 3 }}>Кликни или нажми Пробел — шар упадёт</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", lineHeight: 1.5 }}>Шар следует за курсором. Клик мышью, тап или <kbd style={{ background: "rgba(168,148,230,0.18)", border: "1px solid rgba(168,148,230,0.3)", borderRadius: 4, padding: "1px 5px", fontSize: 11, color: "#C4B8E8", fontFamily: "monospace" }}>Space</kbd> — бросить</div>
              </div>
            </div>

            {/* Step 2 — visual merge demo */}
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(142,202,180,0.15)", border: "1px solid rgba(142,202,180,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#8ECAB4", fontSize: 14, fontWeight: 700 }}>2</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#E0D8F8", marginBottom: 6 }}>Одинаковые → сливаются в больший</div>
                {/* Visual: two small + arrow + one big */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  {/* Two small balls */}
                  <svg width="52" height="26" viewBox="0 0 52 26">
                    <circle cx="13" cy="13" r="11" fill="rgba(142,202,180,0.75)" stroke="rgba(172,232,210,0.9)" strokeWidth="1.2"/>
                    <circle cx="39" cy="13" r="11" fill="rgba(142,202,180,0.75)" stroke="rgba(172,232,210,0.9)" strokeWidth="1.2"/>
                  </svg>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 16 }}>→</div>
                  {/* One big ball */}
                  <svg width="38" height="38" viewBox="0 0 38 38">
                    <circle cx="19" cy="19" r="17" fill="rgba(142,202,180,0.75)" stroke="rgba(172,232,210,0.9)" strokeWidth="1.5"/>
                  </svg>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.4 }}>новый<br/>шар</div>
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", lineHeight: 1.5 }}>Одинаковый цвет + одинаковый размер = слияние. Шары растут через <span style={{ color: "rgba(168,148,230,0.8)" }}>8 уровней</span></div>
              </div>
            </div>

            {/* Step 3 */}
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 20 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(212,144,144,0.15)", border: "1px solid rgba(212,144,144,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#D49090", fontSize: 14, fontWeight: 700 }}>3</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#E0D8F8", marginBottom: 3 }}>Цель — вырасти до максимума</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", lineHeight: 1.5 }}>Стремись создать шар 8-го уровня. Нет проигрыша — только медитация 🌊</div>
              </div>
            </div>

            {/* Size progression visual */}
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 14px", marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Рост шаров (8 уровней)</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 5, justifyContent: "space-between" }}>
                {[15,24,33,42,51,60,69,78].map((r, i) => {
                  const scale = r / 78;
                  const hues = [257, 160, 357];
                  const h = hues[i % 3];
                  return (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <svg width={Math.round(scale * 26 + 4)} height={Math.round(scale * 26 + 4)} viewBox="0 0 30 30">
                        <circle cx="15" cy="15" r={13 * scale + 2} fill={`hsla(${h},50%,70%,0.7)`} stroke={`hsla(${h},60%,80%,0.8)`} strokeWidth="1"/>
                      </svg>
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.28)" }}>{i + 1}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Start button */}
            <button
              onClick={() => setShowIntro(false)}
              style={{
                width: "100%", padding: "11px", borderRadius: 12,
                background: "linear-gradient(135deg, rgba(168,148,230,0.28) 0%, rgba(130,200,180,0.18) 100%)",
                border: "1px solid rgba(168,148,230,0.4)",
                color: "#D4C8F0", fontSize: 14, fontWeight: 700,
                letterSpacing: "0.04em", cursor: "pointer",
                fontFamily: "-apple-system, sans-serif",
              }}
            >
              Начать
            </button>
          </div>
        </div>
      )}

      {/* Settings panel */}
      {showCfg && (
        <div style={{
          position: "absolute", top: 44, right: 10,
          background: "rgba(12,8,22,0.97)",
          border: "1px solid rgba(168,148,230,0.22)",
          borderRadius: 14, padding: "14px 16px", minWidth: 215,
          backdropFilter: "blur(16px)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column", gap: 13,
          fontFamily: "-apple-system, sans-serif",
          zIndex: 20,
        }}>
          <CfgRow label="Частота капель">
            {(["slow","normal","fast"] as FreqKey[]).map(k => (
              <SegBtn key={k} active={freq===k} onClick={() => setFreq(k)}>
                {k==="slow"?"Редко":k==="normal"?"Средне":"Часто"}
              </SegBtn>
            ))}
          </CfgRow>

          <CfgRow label="Скорость падения">
            {(["slow","normal","fast"] as SpeedKey[]).map(k => (
              <SegBtn key={k} active={speed===k} onClick={() => setSpeed(k)}>
                {k==="slow"?"Медленно":k==="normal"?"Нормально":"Быстро"}
              </SegBtn>
            ))}
          </CfgRow>

          <CfgRow label="Уровень (капель за раз)">
            {([1,2,3] as LevelKey[]).map(lv => (
              <SegBtn key={lv} active={level===lv} onClick={() => setLevel(lv)}>
                {lv===1?"1 — Одна":lv===2?"2 — Две":"3 — Три"}
              </SegBtn>
            ))}
          </CfgRow>

          <CfgRow label="Нарастание темпа">
            <SegBtn active={!escalate} onClick={() => setEscalate(false)}>Постоянный</SegBtn>
            <SegBtn active={escalate}  onClick={() => setEscalate(true)}>Нарастающий</SegBtn>
          </CfgRow>
        </div>
      )}
    </div>
  );
}

// ── UI sub-components ─────────────────────────────────────────────────────────
function CfgRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.32)",
        textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6,
      }}>{label}</div>
      <div style={{ display: "flex", gap: 4 }}>{children}</div>
    </div>
  );
}

function SegBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "5px 4px", borderRadius: 8,
      border: `1px solid ${active ? "rgba(168,148,230,0.5)" : "rgba(255,255,255,0.1)"}`,
      background: active ? "rgba(168,148,230,0.22)" : "rgba(255,255,255,0.04)",
      color: active ? "#D4C8F0" : "rgba(255,255,255,0.42)",
      fontSize: 11, fontWeight: active ? 600 : 400,
      cursor: "pointer", transition: "all 0.15s",
      fontFamily: "-apple-system, sans-serif", whiteSpace: "nowrap",
    }}>{children}</button>
  );
}
