"use client";

import { useEffect, useRef } from "react";

// ── 3-colour palette ──────────────────────────────────────────────────────────
const PALETTE = [
  { fill: "rgba(180,160,212,0.82)", stroke: "rgba(210,190,240,0.95)", glow: "rgba(180,160,212,0.38)", baseFreq: 440.00, label: "лаванда" },  // lavender
  { fill: "rgba(142,202,180,0.82)", stroke: "rgba(172,232,210,0.95)", glow: "rgba(142,202,180,0.38)", baseFreq: 329.63, label: "сила"      },  // seafoam
  { fill: "rgba(212,144,144,0.82)", stroke: "rgba(242,174,174,0.95)", glow: "rgba(212,144,144,0.38)", baseFreq: 261.63, label: "роза"      },  // rose
] as const;

// ── Sizes by merge count ──────────────────────────────────────────────────────
function bR(mc: number) { return 15 + mc * 9; }

// ── Physics constants ─────────────────────────────────────────────────────────
const GRAVITY   = 820;
const DAMPING   = 0.36;
const FRICTION  = 0.87;
const ITERS     = 4;
const WALL      = 3;

// ── Ball class ────────────────────────────────────────────────────────────────
class Ball {
  static _id = 0;
  id = Ball._id++;
  vx = 0; vy = 0;
  merged = false;
  pulseT = 0;
  r: number;
  hits = new Map<number, number>();  // id → timestamp

  constructor(
    public x: number,
    public y: number,
    public ci: number,          // colour index
    public mc = 0,              // merge count
  ) { this.r = bR(mc); }

  canHit(id: number) { return Date.now() - (this.hits.get(id) ?? 0) > 380; }
  regHit(id: number) { this.hits.set(id, Date.now()); }
}

// ── Flash effect ──────────────────────────────────────────────────────────────
interface Flash { x: number; y: number; r: number; op: number; ci: number }

// ── Component ─────────────────────────────────────────────────────────────────
export function ZenDropsGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    let W = 0, H = 0;
    function resize() { W = canvas!.width = canvas!.offsetWidth; H = canvas!.height = canvas!.offsetHeight; }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // ── Audio ─────────────────────────────────────────────────────────────────
    let ac: AudioContext | null = null;
    let master: GainNode | null = null;
    let verb: ConvolverNode | null = null;

    function bootAudio() {
      if (ac) return;
      ac = new AudioContext();
      master = ac.createGain(); master.gain.value = 0.45;
      const sr = ac.sampleRate, len = Math.floor(sr * 1.8);
      const buf = ac.createBuffer(2, len, sr);
      for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8);
      }
      verb = ac.createConvolver(); verb.buffer = buf;
      const rg = ac.createGain(); rg.gain.value = 0.28;
      verb.connect(rg); rg.connect(ac.destination);
      master.connect(ac.destination);
    }

    function tone(freq: number, dur: number, vol: number, type: OscillatorType = "sine") {
      if (!ac || !master || !verb) return;
      if (ac.state === "suspended") void ac.resume();
      const t = ac.currentTime;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(master!); g.connect(verb!);
      o.start(t); o.stop(t + dur + 0.04);
    }

    // 1. Same-colour merge → crystal tone per colour, lower octave for bigger ball
    function sndMerge(ci: number, newMc: number) {
      const f = PALETTE[ci].baseFreq * Math.pow(0.6, newMc - 1);
      tone(f, 1.6, 0.22);
    }
    // 2. Same-colour contact (different sizes, no merge) → soft ping
    function sndSameContact(ci: number) {
      tone(PALETTE[ci].baseFreq * 1.5, 0.25, 0.07, "triangle");
    }
    // 3. Different-colour contact → muted thud
    function sndDiffContact() {
      tone(160, 0.35, 0.10, "triangle");
    }
    // 4. Hitting a larger ball → deep rumble, lower with each size level
    function sndLargeBallHit(targetMc: number) {
      const f = 200 / (1 + targetMc * 0.35);
      tone(f, 0.7, 0.14, "sine");
    }

    // ── Game state ────────────────────────────────────────────────────────────
    let balls: Ball[] = [];
    let dropBall: Ball | null = null;   // player-controlled held ball
    let dropX = W / 2;
    let dragging = false;
    let holdTime  = 0;      // seconds since player stopped dragging
    let autoFallV = 0;      // auto-fall velocity for held ball (rain mechanic)
    let flashes: Flash[] = [];

    const mergeCounts = [0, 0, 0];   // successful merges per colour
    let elapsedMs = 0;

    // Rain intensity
    let spawnTimer = 0;
    let spawnInterval = 2.8;          // seconds between auto-rain drops
    const SPAWN_MIN = 0.35;

    function randColor() { return Math.floor(Math.random() * 3); }

    function newDropBall() {
      dropX = W * 0.15 + Math.random() * W * 0.70;
      dropBall = new Ball(dropX, bR(0) + 22, randColor());
      holdTime = 0; autoFallV = 0;
    }
    newDropBall();

    function commitDrop() {
      if (!dropBall) return;
      const b = dropBall;
      b.x = dropX;
      b.y = bR(b.mc) + 22;
      b.vy = Math.max(autoFallV, 90);
      b.vx = 0;
      balls.push(b);
      dropBall = null;
      setTimeout(newDropBall, 260);
    }

    // ── Physics step ──────────────────────────────────────────────────────────
    function step(dt: number) {
      const floor = H - WALL;
      balls.forEach(b => {
        if (b.merged) return;
        b.vy += GRAVITY * dt;
        b.x  += b.vx * dt;
        b.y  += b.vy * dt;
        if (b.y + b.r > floor)     { b.y = floor - b.r;     b.vy = -Math.abs(b.vy) * DAMPING; b.vx *= FRICTION; }
        if (b.x - b.r < WALL)      { b.x = WALL + b.r;      b.vx =  Math.abs(b.vx) * DAMPING; }
        if (b.x + b.r > W - WALL)  { b.x = W - WALL - b.r;  b.vx = -Math.abs(b.vx) * DAMPING; }
      });

      for (let it = 0; it < ITERS; it++) {
        for (let i = 0; i < balls.length; i++) {
          const a = balls[i]; if (a.merged) continue;
          for (let j = i + 1; j < balls.length; j++) {
            const b = balls[j]; if (b.merged) continue;
            const dx = b.x - a.x, dy = b.y - a.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            const min = a.r + b.r;
            if (d >= min || d < 0.001) continue;
            const nx = dx / d, ny = dy / d;
            const pen = (min - d) * 0.5;
            a.x -= nx * pen; a.y -= ny * pen;
            b.x += nx * pen; b.y += ny * pen;
            const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (rv < 0) {
              const imp = rv * (1 + DAMPING) * 0.5;
              a.vx += imp * nx; a.vy += imp * ny;
              b.vx -= imp * nx; b.vy -= imp * ny;
            }

            // ── Collision sounds (throttled) ──────────────────────────────
            if (a.canHit(b.id)) {
              a.regHit(b.id); b.regHit(a.id);
              const sameColor = a.ci === b.ci;
              const willMerge = sameColor && a.mc === b.mc;
              if (!willMerge) {
                const bigMc = Math.max(a.mc, b.mc);
                const smallMc = Math.min(a.mc, b.mc);
                if (bigMc >= 2 && bigMc > smallMc + 1) {
                  sndLargeBallHit(bigMc);
                } else if (sameColor) {
                  sndSameContact(a.ci);
                } else {
                  sndDiffContact();
                }
              }
            }
          }
        }
      }
    }

    // ── Merge detection ───────────────────────────────────────────────────────
    function checkMerges() {
      for (let i = 0; i < balls.length; i++) {
        const a = balls[i]; if (a.merged) continue;
        for (let j = i + 1; j < balls.length; j++) {
          const b = balls[j];
          if (b.merged || b.ci !== a.ci || b.mc !== a.mc) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          if (Math.sqrt(dx * dx + dy * dy) > a.r + b.r + 2) continue;

          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          const newMc = a.mc + 1;
          flashes.push({ x: mx, y: my, r: a.r * 1.6, op: 0.92, ci: a.ci });
          sndMerge(a.ci, newMc);
          mergeCounts[a.ci]++;

          a.merged = true; b.merged = true;
          const nb = new Ball(mx, my, a.ci, Math.min(newMc, 7));
          nb.vy = -110; nb.vx = (a.vx + b.vx) * 0.28; nb.pulseT = 1;
          balls.push(nb);
        }
      }
      balls = balls.filter(b => !b.merged);
    }

    // ── Input ─────────────────────────────────────────────────────────────────
    const MARGIN = 0.12;
    function clampX(raw: number) {
      const r = dropBall ? dropBall.r : bR(0);
      return Math.max(W * MARGIN + r, Math.min(W * (1 - MARGIN) - r, raw));
    }
    function rawX(e: MouseEvent | TouchEvent) {
      const rect = canvas!.getBoundingClientRect();
      if ("touches" in e) {
        const t = (e as TouchEvent).touches[0] ?? (e as TouchEvent).changedTouches[0];
        return t.clientX - rect.left;
      }
      return (e as MouseEvent).clientX - rect.left;
    }
    function onDown(e: MouseEvent | TouchEvent) {
      if ("touches" in e) (e as TouchEvent).preventDefault();
      bootAudio();
      dragging = true; holdTime = 0; autoFallV = 0;
      dropX = clampX(rawX(e));
      if (dropBall) { dropBall.x = dropX; dropBall.y = bR(dropBall.mc) + 22; }
    }
    function onMove(e: MouseEvent | TouchEvent) {
      if (!dragging) return;
      if ("touches" in e) (e as TouchEvent).preventDefault();
      dropX = clampX(rawX(e));
      if (dropBall) dropBall.x = dropX;
    }
    function onUp() { if (dragging) { dragging = false; commitDrop(); } }

    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseup",   onUp);
    canvas.addEventListener("touchstart", onDown as EventListener, { passive: false });
    canvas.addEventListener("touchmove",  onMove as EventListener, { passive: false });
    canvas.addEventListener("touchend",   onUp);

    // ── Draw helpers ──────────────────────────────────────────────────────────
    function drawBall(b: Ball, alpha = 1) {
      const pal = PALETTE[b.ci];
      const r   = b.r + (b.pulseT > 0 ? b.pulseT * 10 : 0);
      ctx.save(); ctx.globalAlpha = alpha;
      // Glow
      const g = ctx.createRadialGradient(b.x, b.y, r * 0.25, b.x, b.y, r * 2.3);
      g.addColorStop(0, pal.glow); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath(); ctx.arc(b.x, b.y, r * 2.3, 0, Math.PI * 2);
      ctx.fillStyle = g; ctx.fill();
      // Body
      ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.fillStyle = pal.fill; ctx.strokeStyle = pal.stroke; ctx.lineWidth = 1.6;
      ctx.fill(); ctx.stroke();
      // Shine
      const sh = ctx.createRadialGradient(b.x - r * 0.32, b.y - r * 0.38, 0, b.x, b.y, r);
      sh.addColorStop(0, "rgba(255,255,255,0.38)"); sh.addColorStop(0.55, "rgba(255,255,255,0.06)"); sh.addColorStop(1, "rgba(255,255,255,0)");
      ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.fillStyle = sh; ctx.fill();
      ctx.restore();
    }

    function drawUI() {
      const secs = Math.floor(elapsedMs / 1000);
      const mm = String(Math.floor(secs / 60)).padStart(2, "0");
      const ss = String(secs % 60).padStart(2, "0");

      // Timer
      ctx.save();
      ctx.font = "bold 15px -apple-system, monospace";
      ctx.fillStyle = "rgba(255,255,255,0.38)";
      ctx.textAlign = "center";
      ctx.fillText(`${mm}:${ss}`, W / 2, 26);

      // Per-colour counters
      const dotR = 6, gap = 52;
      const startX = W / 2 - (PALETTE.length - 1) * gap * 0.5;
      PALETTE.forEach((pal, i) => {
        const x = startX + i * gap;
        // dot
        ctx.beginPath(); ctx.arc(x - 20, 42, dotR, 0, Math.PI * 2);
        ctx.fillStyle = pal.fill; ctx.strokeStyle = pal.stroke; ctx.lineWidth = 1.2;
        ctx.fill(); ctx.stroke();
        // number
        ctx.font = "600 13px -apple-system, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.textAlign = "left";
        ctx.fillText(`×${mergeCounts[i]}`, x - 11, 47);
      });

      // Rain intensity indicator (subtle)
      const intensity = Math.min(1, (2.8 - spawnInterval) / (2.8 - SPAWN_MIN));
      if (intensity > 0.05) {
        ctx.globalAlpha = 0.22 * intensity;
        ctx.font = "11px -apple-system";
        ctx.fillStyle = "#AACCFF";
        ctx.textAlign = "right";
        ctx.fillText("🌧 " + Math.round(intensity * 100) + "%", W - 14, 26);
      }
      ctx.restore();
    }

    // ── Main loop ─────────────────────────────────────────────────────────────
    let lastT = 0;

    function loop(ts: number) {
      const dt = Math.min((ts - lastT) / 1000, 0.05);
      lastT = ts;
      elapsedMs += dt * 1000;

      // Rain intensity increases with time
      const elapsed = elapsedMs / 1000;
      spawnInterval = Math.max(SPAWN_MIN, 2.8 * Math.exp(-elapsed * 0.022));

      // Player held ball: after 1.2s of inactivity starts auto-falling (rain drop feel)
      if (dropBall && !dragging) {
        holdTime += dt;
        if (holdTime > 1.2) {
          autoFallV = Math.min(autoFallV + GRAVITY * dt * 0.18, 450);
          dropBall.y += autoFallV * dt;
          if (dropBall.y + dropBall.r > H - 4) commitDrop();
        }
      } else if (dragging) {
        holdTime = 0; autoFallV = 0;
      }

      // Auto-rain drops (separate from player ball, fall straight down)
      spawnTimer += dt;
      if (spawnTimer >= spawnInterval && balls.length < 35) {
        spawnTimer = 0;
        const rx = W * 0.08 + Math.random() * W * 0.84;
        const rb = new Ball(rx, -bR(0) - 4, randColor());
        rb.vy = 45 + Math.random() * 35; // start slow — gravity accelerates them
        balls.push(rb);
      }

      step(dt);
      checkMerges();

      balls.forEach(b => { if (b.pulseT > 0) b.pulseT = Math.max(0, b.pulseT - dt * 2.6); });
      flashes = flashes.filter(f => f.op > 0.02);
      flashes.forEach(f => { f.op *= 0.87; f.r += 1.8; });

      // ── Render ───────────────────────────────────────────────────────────
      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(0, 0, W, H);
      const bg = ctx.createRadialGradient(W / 2, H * 0.65, 0, W / 2, H * 0.5, Math.max(W, H) * 0.65);
      bg.addColorStop(0, "rgba(18,12,32,0.55)"); bg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      // Floor
      ctx.beginPath(); ctx.moveTo(0, H - WALL); ctx.lineTo(W, H - WALL);
      ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 1; ctx.stroke();

      // Drop guide + player ball
      if (dropBall) {
        ctx.save();
        ctx.globalAlpha = 0.11;
        ctx.setLineDash([4, 9]);
        ctx.beginPath(); ctx.moveTo(dropBall.x, dropBall.y + dropBall.r); ctx.lineTo(dropBall.x, H - 4);
        ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 1; ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        drawBall(dropBall, 0.80);
      }

      balls.forEach(b => drawBall(b));

      flashes.forEach(f => {
        const pal = PALETTE[f.ci];
        ctx.save(); ctx.globalAlpha = f.op;
        const fg = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
        fg.addColorStop(0, pal.stroke); fg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = fg; ctx.fill();
        ctx.restore();
      });

      drawUI();

      rafId = requestAnimationFrame(loop);
    }
    let rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseup",   onUp);
      canvas.removeEventListener("touchstart", onDown as EventListener);
      canvas.removeEventListener("touchmove",  onMove as EventListener);
      canvas.removeEventListener("touchend",   onUp);
      ac?.close();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }}
    />
  );
}
