"use client";

import { useEffect, useRef } from "react";

// ── Pentatonic scale ──────────────────────────────────────────────────────────
const FREQS = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];

// ── Pastel palette ────────────────────────────────────────────────────────────
const PAL = [
  { mid: "#C89EC8", glow: "rgba(200,158,200," }, // muted violet
  { mid: "#8CBAD4", glow: "rgba(140,186,212," }, // dusty sky
  { mid: "#8ECAB4", glow: "rgba(142,202,180," }, // seafoam
  { mid: "#B4A0D4", glow: "rgba(180,160,212," }, // lavender
  { mid: "#D4B48C", glow: "rgba(212,180,140," }, // warm sand
  { mid: "#8CB48C", glow: "rgba(140,180,140," }, // sage
  { mid: "#D49090", glow: "rgba(212,144,144," }, // dusty rose
];

// ── Types ─────────────────────────────────────────────────────────────────────
interface Pal { mid: string; glow: string }

class Ripple {
  r: number; op: number;
  constructor(public x: number, public y: number, startR: number, public pal: Pal) {
    this.r = startR; this.op = 0.7;
  }
  update() { this.r += 2.4; this.op *= 0.92; }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.strokeStyle = this.pal.glow + this.op + ")";
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }
  get alive() { return this.op > 0.02; }
}

class Note {
  r: number; freq: number; pal: Pal;
  op = 0; fading = false; pulseT = 0;
  ripples: Ripple[] = [];
  constructor(public id: number, public x: number, public y: number, freqIdx: number) {
    this.freq = FREQS[freqIdx % FREQS.length];
    this.pal  = PAL[freqIdx % PAL.length];
    this.r    = 24 + Math.random() * 18;
  }
  trigger(pal: Pal) {
    this.ripples.push(new Ripple(this.x, this.y, this.r, pal));
    this.pulseT = 1;
  }
  update() {
    if (!this.fading && this.op < 1) this.op = Math.min(1, this.op + 0.06);
    if (this.fading) this.op = Math.max(0, this.op - 0.018);
    if (this.pulseT > 0) this.pulseT = Math.max(0, this.pulseT - 0.045);
    this.ripples = this.ripples.filter(r => r.alive);
    this.ripples.forEach(r => r.update());
  }
  draw(ctx: CanvasRenderingContext2D) {
    const op = this.op;
    const r  = this.r + this.pulseT * 7;
    this.ripples.forEach(rp => rp.draw(ctx));

    // Outer halo
    const halo = ctx.createRadialGradient(this.x, this.y, r * 0.6, this.x, this.y, r * 2.5);
    halo.addColorStop(0, this.pal.glow + (op * 0.15) + ")");
    halo.addColorStop(1, this.pal.glow + "0)");
    ctx.beginPath(); ctx.arc(this.x, this.y, r * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = halo; ctx.fill();

    // Fill
    ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fillStyle = this.pal.glow + (op * 0.12) + ")"; ctx.fill();

    // Ring
    ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = this.pal.glow + (op * 0.7) + ")";
    ctx.lineWidth = 1.8; ctx.stroke();

    // Shine
    const shine = ctx.createRadialGradient(
      this.x - r * 0.3, this.y - r * 0.3, 0, this.x, this.y, r,
    );
    shine.addColorStop(0, "rgba(255,255,255," + (op * 0.28) + ")");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fillStyle = shine; ctx.fill();
  }
  get dead() { return this.fading && this.op < 0.01; }
}

const TRAIL = 20;
class Particle {
  cx: number; cy: number; dvx: number; dvy: number;
  orbitR: number; orbitSpd: number; phase: number;
  phase2: number; spd2: number; amp2: number;
  r: number; pal: Pal;
  x = 0; y = 0;
  trail: { x: number; y: number }[] = [];
  hits = new Map<number, number>(); // noteId → timestamp

  constructor(i: number, W: number, H: number) {
    this.pal      = PAL[i % PAL.length];
    this.cx       = W * 0.15 + Math.random() * W * 0.7;
    this.cy       = H * 0.15 + Math.random() * H * 0.7;
    this.orbitR   = 60 + Math.random() * 120;
    this.orbitSpd = (0.3 + Math.random() * 0.5) * (Math.random() < 0.5 ? 1 : -1);
    this.phase    = Math.random() * Math.PI * 2;
    this.phase2   = Math.random() * Math.PI * 2;
    this.spd2     = this.orbitSpd * (1.4 + Math.random());
    this.amp2     = 25 + Math.random() * 45;
    this.dvx      = (Math.random() - 0.5) * 0.3;
    this.dvy      = (Math.random() - 0.5) * 0.3;
    this.r        = 5 + Math.random() * 2.5;
    this._pos();
  }
  _pos() {
    this.x = this.cx + Math.cos(this.phase) * this.orbitR + Math.sin(this.phase2) * this.amp2;
    this.y = this.cy + Math.sin(this.phase) * this.orbitR + Math.cos(this.phase2 * 0.7) * this.amp2 * 0.6;
  }
  update(dt: number, W: number, H: number) {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > TRAIL) this.trail.shift();
    this.phase  += this.orbitSpd * dt;
    this.phase2 += this.spd2 * dt;
    this.cx += this.dvx; this.cy += this.dvy;
    const m = 110;
    if (this.cx < m || this.cx > W - m) { this.dvx *= -1; this.cx = Math.max(m, Math.min(W - m, this.cx)); }
    if (this.cy < m || this.cy > H - m) { this.dvy *= -1; this.cy = Math.max(m, Math.min(H - m, this.cy)); }
    this._pos();
  }
  canHit(id: number) { return Date.now() - (this.hits.get(id) ?? 0) > 650; }
  registerHit(id: number) { this.hits.set(id, Date.now()); }
  draw(ctx: CanvasRenderingContext2D) {
    const n = this.trail.length;
    for (let i = 0; i < n; i++) {
      const t = this.trail[i];
      const f = i / n;
      const r2 = this.r * f * 0.65;
      if (r2 < 0.5) continue;
      ctx.beginPath(); ctx.arc(t.x, t.y, r2, 0, Math.PI * 2);
      ctx.fillStyle = this.pal.glow + (f * 0.3) + ")"; ctx.fill();
    }
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * 4.5);
    g.addColorStop(0,   this.pal.glow + "0.4)");
    g.addColorStop(0.4, this.pal.glow + "0.15)");
    g.addColorStop(1,   this.pal.glow + "0)");
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 4.5, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF"; ctx.fill();
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = this.pal.mid; ctx.fill();
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export function SoundsGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    let W = 0, H = 0;
    function resize() {
      W = canvas!.width  = canvas!.offsetWidth;
      H = canvas!.height = canvas!.offsetHeight;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // State
    let particles: Particle[] = [];
    let notes: Note[] = [];
    let serial = 0, freqCur = 0;
    let rafId = 0;
    let showHint = true;

    // Audio
    let ac: AudioContext | null = null;
    let masterGain: GainNode | null = null;
    let reverb: ConvolverNode | null = null;

    function initAudio() {
      if (ac) return;
      ac = new AudioContext();
      masterGain = ac.createGain(); masterGain.gain.value = 0.5;
      const sr = ac.sampleRate, len = sr * 2;
      const buf = ac.createBuffer(2, len, sr);
      for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
      }
      reverb = ac.createConvolver(); reverb.buffer = buf;
      const rg = ac.createGain(); rg.gain.value = 0.32;
      reverb.connect(rg); rg.connect(ac.destination);
      masterGain.connect(ac.destination);
    }

    function playZen(freq: number) {
      if (!ac || !masterGain || !reverb) return;
      if (ac.state === "suspended") ac.resume();
      const now = ac.currentTime;
      const osc = ac.createOscillator(), g = ac.createGain();
      osc.type = "sine"; osc.frequency.setValueAtTime(freq, now);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.2, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
      osc.connect(g); g.connect(masterGain); g.connect(reverb);
      osc.start(now); osc.stop(now + 2.1);
    }

    function initParticles() {
      particles = Array.from({ length: 6 }, (_, i) => new Particle(i, W || 800, H || 600));
    }
    initParticles();

    function addNote(x: number, y: number) {
      initAudio();
      const active = notes.filter(n => !n.fading);
      if (active.length >= 10) active[0].fading = true;
      notes.push(new Note(serial++, x, y, freqCur++));
      showHint = false;
    }

    function onClick(e: MouseEvent) {
      const r = canvas!.getBoundingClientRect();
      addNote(e.clientX - r.left, e.clientY - r.top);
    }
    function onTouch(e: TouchEvent) {
      e.preventDefault();
      const r = canvas!.getBoundingClientRect();
      Array.from(e.changedTouches).forEach(t => addNote(t.clientX - r.left, t.clientY - r.top));
    }
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("touchstart", onTouch, { passive: false });

    let lastT = 0;
    function loop(ts: number) {
      const dt = Math.min((ts - lastT) / 1000, 0.05);
      lastT = ts;

      // Background
      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(0, 0, W, H);
      const cg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.5);
      cg.addColorStop(0, "rgba(28,18,48,0.5)"); cg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H);

      // Notes
      notes = notes.filter(n => !n.dead);
      notes.forEach(n => { n.update(); n.draw(ctx); });

      // Particles
      particles.forEach(p => {
        p.update(dt, W, H);
        notes.forEach(n => {
          if (n.fading) return;
          const dx = p.x - n.x, dy = p.y - n.y;
          if (Math.sqrt(dx * dx + dy * dy) < n.r && p.canHit(n.id)) {
            p.registerHit(n.id);
            playZen(n.freq);
            n.trigger(p.pal);
          }
        });
        p.draw(ctx);
      });

      // Hint
      if (showHint) {
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.font = "13px -apple-system,sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Кликните на экран, чтобы разместить ноту", W / 2, H - 28);
      }

      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("touchstart", onTouch);
      ro.disconnect();
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
