"use client";

import { useEffect, useRef, useState } from "react";

// ── Pentatonic scale ──────────────────────────────────────────────────────────
const FREQS = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];

// ── Pastel palette ────────────────────────────────────────────────────────────
const PAL = [
  { mid: "#C89EC8", glow: "rgba(200,158,200," },
  { mid: "#8CBAD4", glow: "rgba(140,186,212," },
  { mid: "#8ECAB4", glow: "rgba(142,202,180," },
  { mid: "#B4A0D4", glow: "rgba(180,160,212," },
  { mid: "#D4B48C", glow: "rgba(212,180,140," },
  { mid: "#8CB48C", glow: "rgba(140,180,140," },
  { mid: "#D49090", glow: "rgba(212,144,144," },
];

interface Pal { mid: string; glow: string }

// ── Preset definitions ────────────────────────────────────────────────────────
type Preset = "kalimba" | "marimba" | "pong" | "bowl" | "pad" | "flute" | "bell";
const PRESETS: { id: Preset; label: string; sub: string }[] = [
  { id: "kalimba", label: "Дзен-Калимба",     sub: "хрустальный" },
  { id: "marimba", label: "Тёплая Маримба",   sub: "заземляющий" },
  { id: "pong",    label: "Неоновый Понг",     sub: "ретро-фокус" },
  { id: "bowl",    label: "Тибетская Чаша",   sub: "медитация" },
  { id: "pad",     label: "Космический Пад",  sub: "растворение" },
  { id: "flute",   label: "Воздушная Флейта", sub: "дыхание" },
  { id: "bell",    label: "Серебряный Звонок", sub: "ресурс" },
];

// ── Types ─────────────────────────────────────────────────────────────────────
class Ripple {
  r: number; op: number;
  constructor(public x: number, public y: number, startR: number, public pal: Pal) {
    this.r = startR; this.op = 0.7;
  }
  update() { this.r += 2.4; this.op *= 0.92; }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.strokeStyle = this.pal.glow + this.op + ")"; ctx.lineWidth = 1.8; ctx.stroke();
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
  trigger(pal: Pal) { this.ripples.push(new Ripple(this.x, this.y, this.r, pal)); this.pulseT = 1; }
  update() {
    if (!this.fading && this.op < 1) this.op = Math.min(1, this.op + 0.06);
    if (this.fading) this.op = Math.max(0, this.op - 0.018);
    if (this.pulseT > 0) this.pulseT = Math.max(0, this.pulseT - 0.045);
    this.ripples = this.ripples.filter(r => r.alive);
    this.ripples.forEach(r => r.update());
  }
  draw(ctx: CanvasRenderingContext2D) {
    const op = this.op, r = this.r + this.pulseT * 7;
    this.ripples.forEach(rp => rp.draw(ctx));
    const halo = ctx.createRadialGradient(this.x, this.y, r * 0.6, this.x, this.y, r * 2.5);
    halo.addColorStop(0, this.pal.glow + (op * 0.15) + ")");
    halo.addColorStop(1, this.pal.glow + "0)");
    ctx.beginPath(); ctx.arc(this.x, this.y, r * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = halo; ctx.fill();
    ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fillStyle = this.pal.glow + (op * 0.12) + ")"; ctx.fill();
    ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = this.pal.glow + (op * 0.7) + ")"; ctx.lineWidth = 1.8; ctx.stroke();
    const shine = ctx.createRadialGradient(this.x - r * 0.3, this.y - r * 0.3, 0, this.x, this.y, r);
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
  hits = new Map<number, number>();

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
    this.phase  += this.orbitSpd * dt; this.phase2 += this.spd2 * dt;
    this.cx += this.dvx; this.cy += this.dvy;
    const m = 110;
    if (this.cx < m || this.cx > W - m) { this.dvx *= -1; this.cx = Math.max(m, Math.min(W - m, this.cx)); }
    if (this.cy < m || this.cy > H - m) { this.dvy *= -1; this.cy = Math.max(m, Math.min(H - m, this.cy)); }
    this._pos();
  }
  canHit(id: number)    { return Date.now() - (this.hits.get(id) ?? 0) > 650; }
  registerHit(id: number) { this.hits.set(id, Date.now()); }
  draw(ctx: CanvasRenderingContext2D) {
    const n = this.trail.length;
    for (let i = 0; i < n; i++) {
      const t = this.trail[i], f = i / n, r2 = this.r * f * 0.65;
      if (r2 < 0.5) continue;
      ctx.beginPath(); ctx.arc(t.x, t.y, r2, 0, Math.PI * 2);
      ctx.fillStyle = this.pal.glow + (f * 0.3) + ")"; ctx.fill();
    }
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * 4.5);
    g.addColorStop(0, this.pal.glow + "0.4)"); g.addColorStop(0.4, this.pal.glow + "0.15)"); g.addColorStop(1, this.pal.glow + "0)");
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 4.5, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fillStyle = "#FFFFFF"; ctx.fill();
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 0.6, 0, Math.PI * 2); ctx.fillStyle = this.pal.mid; ctx.fill();
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export function SoundsGame() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const [preset,     setPreset]     = useState<Preset>("kalimba");
  const [showPanel,  setShowPanel]  = useState(false);
  const presetRef    = useRef<Preset>("kalimba");
  useEffect(() => { presetRef.current = preset; }, [preset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    let W = 0, H = 0;
    function resize() { W = canvas!.width = canvas!.offsetWidth; H = canvas!.height = canvas!.offsetHeight; }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let particles: Particle[] = [];
    let notes: Note[] = [];
    let serial = 0, freqCur = 0;
    let rafId = 0, showHint = true;

    // ── Audio ─────────────────────────────────────────────────────────────────
    let ac: AudioContext | null = null;
    let masterGain: GainNode | null = null;
    let reverb: ConvolverNode | null = null;
    let noiseBuf: AudioBuffer | null = null;

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
      // Noise buffer for flute
      const nlen = Math.floor(sr * 0.9);
      noiseBuf = ac.createBuffer(1, nlen, sr);
      const nd = noiseBuf.getChannelData(0);
      for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;
    }

    function playNote(freq: number) {
      if (!ac || !masterGain) return;
      if (ac.state === "suspended") void ac.resume();
      const now = ac.currentTime;
      const p = presetRef.current;

      switch (p) {
        case "kalimba": {
          const o = ac.createOscillator(), g = ac.createGain();
          const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 350;
          o.type = "sine"; o.frequency.setValueAtTime(freq, now);
          g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.2, now + 0.005);
          g.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
          o.connect(g); g.connect(hp); hp.connect(masterGain); g.connect(reverb!);
          o.start(now); o.stop(now + 2.1);
          break;
        }
        case "marimba": {
          const o = ac.createOscillator(), g = ac.createGain();
          const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 800;
          o.type = "triangle"; o.frequency.setValueAtTime(freq, now);
          g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.22, now + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
          o.connect(g); g.connect(lp); lp.connect(masterGain); g.connect(reverb!);
          o.start(now); o.stop(now + 1.6);
          break;
        }
        case "pong": {
          const o = ac.createOscillator(), g = ac.createGain();
          o.type = "square"; o.frequency.setValueAtTime(freq, now);
          g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.12, now + 0.005);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          o.connect(g); g.connect(masterGain);
          o.start(now); o.stop(now + 0.28);
          break;
        }
        case "bowl": {
          for (const df of [0, 4]) {
            const o = ac.createOscillator(), g = ac.createGain();
            o.type = "sine"; o.frequency.setValueAtTime(freq + df, now);
            g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.12, now + 0.025);
            g.gain.exponentialRampToValueAtTime(0.001, now + 3.5);
            o.connect(g); g.connect(masterGain); g.connect(reverb!);
            o.start(now); o.stop(now + 3.6);
          }
          break;
        }
        case "pad": {
          const o = ac.createOscillator(), g = ac.createGain();
          const lp = ac.createBiquadFilter(); lp.type = "lowpass";
          lp.frequency.setValueAtTime(180, now);
          lp.frequency.linearRampToValueAtTime(1400, now + 0.5);
          lp.frequency.exponentialRampToValueAtTime(280, now + 2.5);
          o.type = "sawtooth"; o.frequency.setValueAtTime(freq, now);
          g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.18, now + 0.2);
          g.gain.exponentialRampToValueAtTime(0.001, now + 2.8);
          o.connect(g); g.connect(lp); lp.connect(masterGain); g.connect(reverb!);
          o.start(now); o.stop(now + 3.0);
          break;
        }
        case "flute": {
          const o = ac.createOscillator(), g = ac.createGain();
          o.type = "sine"; o.frequency.setValueAtTime(freq, now);
          g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.18, now + 0.08);
          g.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
          o.connect(g); g.connect(masterGain); g.connect(reverb!);
          o.start(now); o.stop(now + 2.0);
          if (noiseBuf) {
            const ns = ac.createBufferSource(), ng = ac.createGain();
            const hp = ac.createBiquadFilter(); hp.type = "bandpass"; hp.frequency.value = freq * 0.95; hp.Q.value = 1.5;
            ns.buffer = noiseBuf;
            ng.gain.setValueAtTime(0, now); ng.gain.linearRampToValueAtTime(0.055, now + 0.08);
            ng.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
            ns.connect(hp); hp.connect(ng); ng.connect(masterGain);
            ns.start(now); ns.stop(now + 0.9);
          }
          break;
        }
        case "bell": {
          const partials: [number, number, number][] = [[freq * 2, 0.16, 1.4], [freq * 2.756, 0.08, 0.75]];
          for (const [f, vol, rel] of partials) {
            const o = ac.createOscillator(), g = ac.createGain();
            o.type = "sine"; o.frequency.setValueAtTime(f, now);
            g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(vol, now + 0.005);
            g.gain.exponentialRampToValueAtTime(0.001, now + rel);
            o.connect(g); g.connect(masterGain); g.connect(reverb!);
            o.start(now); o.stop(now + rel + 0.1);
          }
          break;
        }
      }
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
    function hitNote(x: number, y: number): boolean {
      for (let i = notes.length - 1; i >= 0; i--) {
        const n = notes[i]; if (n.fading) continue;
        const dx = x - n.x, dy = y - n.y;
        if (dx * dx + dy * dy <= n.r * n.r) { n.fading = true; return true; }
      }
      return false;
    }
    function onClick(e: MouseEvent) {
      const r = canvas!.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (!hitNote(x, y)) addNote(x, y);
    }
    function onTouch(e: TouchEvent) {
      e.preventDefault();
      const r = canvas!.getBoundingClientRect();
      Array.from(e.changedTouches).forEach(t => {
        const x = t.clientX - r.left, y = t.clientY - r.top;
        if (!hitNote(x, y)) addNote(x, y);
      });
    }
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("touchstart", onTouch, { passive: false });

    let lastT = 0;
    function loop(ts: number) {
      const dt = Math.min((ts - lastT) / 1000, 0.05);
      lastT = ts;
      ctx.fillStyle = "#0a0a0f"; ctx.fillRect(0, 0, W, H);
      const cg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.5);
      cg.addColorStop(0, "rgba(28,18,48,0.5)"); cg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H);
      notes = notes.filter(n => !n.dead);
      notes.forEach(n => { n.update(); n.draw(ctx); });
      particles.forEach(p => {
        p.update(dt, W, H);
        notes.forEach(n => {
          if (n.fading) return;
          const dx = p.x - n.x, dy = p.y - n.y;
          if (Math.sqrt(dx * dx + dy * dy) < n.r && p.canHit(n.id)) {
            p.registerHit(n.id); playNote(n.freq); n.trigger(p.pal);
          }
        });
        p.draw(ctx);
      });
      if (showHint) {
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.font = "13px -apple-system,sans-serif"; ctx.textAlign = "center";
        ctx.fillText("Кликните на экран, чтобы разместить ноту", W / 2, H - 28);
      }
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("touchstart", onTouch);
      ro.disconnect(); ac?.close();
    };
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#0a0a0f" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }}
      />

      {/* Preset button */}
      <button
        onClick={() => setShowPanel(s => !s)}
        style={{
          position: "absolute", top: 10, right: 10,
          background: showPanel ? "rgba(168,148,230,0.22)" : "rgba(255,255,255,0.07)",
          border: `1px solid ${showPanel ? "rgba(168,148,230,0.45)" : "rgba(255,255,255,0.13)"}`,
          borderRadius: 8, color: showPanel ? "#D4C8F0" : "rgba(255,255,255,0.5)",
          fontSize: 12, fontWeight: 500, padding: "5px 11px 5px 9px",
          cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
          fontFamily: "-apple-system, sans-serif", transition: "all 0.18s",
          userSelect: "none", zIndex: 10,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
        </svg>
        Синтезатор
      </button>

      {/* Preset panel */}
      {showPanel && (
        <div style={{
          position: "absolute", top: 44, right: 10,
          background: "rgba(10,8,20,0.97)",
          border: "1px solid rgba(168,148,230,0.22)",
          borderRadius: 14, padding: "12px 14px",
          backdropFilter: "blur(16px)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.55)",
          display: "flex", flexDirection: "column", gap: 4,
          fontFamily: "-apple-system, sans-serif", zIndex: 20,
          minWidth: 200,
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
            Инструмент
          </div>
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              style={{
                background: preset === p.id ? "rgba(168,148,230,0.22)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${preset === p.id ? "rgba(168,148,230,0.45)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 8, padding: "6px 10px",
                cursor: "pointer", transition: "all 0.15s",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: preset === p.id ? 600 : 400, color: preset === p.id ? "#D4C8F0" : "rgba(255,255,255,0.55)" }}>
                {p.label}
              </span>
              <span style={{ fontSize: 10, color: preset === p.id ? "rgba(168,148,230,0.7)" : "rgba(255,255,255,0.2)", letterSpacing: "0.04em" }}>
                {p.sub}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
