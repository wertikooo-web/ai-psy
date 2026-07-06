"use client";

import { useEffect, useRef } from "react";

// ─── Shape library ────────────────────────────────────────────────────────────
type Shape = "tri" | "diamond" | "kite" | "wide" | "bar";
interface Color { h: number; s: number; l: number }

const SHAPES: Shape[]  = ["tri", "diamond", "kite", "wide", "bar"];
const COLORS: Color[]  = [
  { h: 210, s: 80, l: 72 },
  { h: 265, s: 70, l: 73 },
  { h: 170, s: 65, l: 68 },
  { h: 45,  s: 80, l: 70 },
  { h: 340, s: 72, l: 72 },
  { h: 25,  s: 75, l: 72 },
];

// Pentatonic: C4 D4 E4 G4 A4
const PENTATONIC = [261.63, 293.66, 329.63, 392.00, 440.00];

function shapePoints(shape: Shape, r: number): [number, number][] {
  switch (shape) {
    case "tri":     return [[0, -r], [r * 0.87, r * 0.5], [-r * 0.87, r * 0.5]];
    case "diamond": return [[0, -r * 1.25], [r * 0.42, 0], [0, r * 1.25], [-r * 0.42, 0]];
    case "kite":    return [[0, -r * 1.15], [r * 0.62, r * 0.15], [0, r * 0.72], [-r * 0.62, r * 0.15]];
    case "wide":    return [[0, -r * 0.45], [r * 0.98, r * 0.82], [-r * 0.98, r * 0.82]];
    case "bar":     return [[r * 0.22, -r * 0.78], [r * 0.22, r * 0.78], [-r * 0.22, r * 0.78], [-r * 0.22, -r * 0.78]];
  }
}

interface PalItem    { shape: Shape; color: Color }
interface PlacedShard {
  shape: Shape; color: Color;
  relX: number; relY: number; size: number;
  pulseOffset: number;   // random phase for micro-pulsation
  age: number;           // 0 → ANIM_DUR: clone grow animation
  settled: boolean;
}
interface Shockwave { r: number; maxR: number; op: number; hue: number }

const SYMMETRY  = 8;
const PAL_H     = 72;
const SHARD_R   = 11;
const PLACE_R   = 14;
const ANIM_DUR  = 0.45;  // clone grow duration (s)
const ROT_SPEED = 2 * Math.PI / 180;  // 2°/sec — slow kaleidoscope rotation

function rndItem<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function makePalette(): PalItem[] {
  return Array.from({ length: 6 }, () => ({ shape: rndItem(SHAPES), color: rndItem(COLORS) }));
}

// ─── Component ────────────────────────────────────────────────────────────────
export function InnerLightGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    let W = 0, H = 0, canvasH = 0, cx = 0, cy = 0;

    function resize() {
      W = canvas!.width  = canvas!.offsetWidth;
      H = canvas!.height = canvas!.offsetHeight;
      canvasH = H - PAL_H;
      cx = W / 2; cy = canvasH / 2;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // ── Audio ─────────────────────────────────────────────────────────────────
    let ac: AudioContext | null = null;
    let master: GainNode | null = null;
    let delayNode: DelayNode | null = null;
    let delayFb: GainNode | null = null;
    let noiseBuf: AudioBuffer | null = null;
    let dragOsc: OscillatorNode | null = null;
    let dragGain: GainNode | null = null;

    function bootAudio() {
      if (ac) return;
      ac = new AudioContext();
      master = ac.createGain(); master.gain.value = 0.4;
      delayNode = ac.createDelay(1.0); delayNode.delayTime.value = 0.32;
      delayFb = ac.createGain(); delayFb.gain.value = 0.36;
      delayNode.connect(delayFb); delayFb.connect(delayNode);
      delayNode.connect(master);
      master.connect(ac.destination);
      // Pre-bake noise buffer for flute (not used here but keeps audio consistent)
      const len = Math.floor(ac.sampleRate * 0.8);
      noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }

    function startDragHum() {
      if (!ac || !master || dragOsc) return;
      if (ac.state === "suspended") void ac.resume();
      dragOsc = ac.createOscillator();
      dragGain = ac.createGain();
      dragOsc.type = "sine";
      dragOsc.frequency.value = 120 + Math.random() * 80;
      dragGain.gain.setValueAtTime(0, ac.currentTime);
      dragGain.gain.linearRampToValueAtTime(0.05, ac.currentTime + 0.28);
      dragOsc.connect(dragGain); dragGain.connect(master);
      dragOsc.start();
    }

    function stopDragHum() {
      if (!ac || !dragGain || !dragOsc) return;
      const t = ac.currentTime;
      dragGain.gain.setValueAtTime(dragGain.gain.value, t);
      dragGain.gain.linearRampToValueAtTime(0, t + 0.35);
      dragOsc.stop(t + 0.38);
      dragOsc = null; dragGain = null;
    }

    function playBell(relX: number, relY: number) {
      if (!ac || !master || !delayNode) return;
      if (ac.state === "suspended") void ac.resume();
      const dist     = Math.sqrt(relX * relX + relY * relY);
      const maxDist  = Math.min(cx, cy) * 0.85;
      const noteIdx  = Math.min(PENTATONIC.length - 1, Math.floor((dist / (maxDist + 1)) * PENTATONIC.length));
      const freq     = PENTATONIC[noteIdx];
      const now      = ac.currentTime;

      // High sine — crystal bell
      const o1 = ac.createOscillator(), g1 = ac.createGain();
      o1.type = "sine"; o1.frequency.setValueAtTime(freq * 2, now);
      g1.gain.setValueAtTime(0, now);
      g1.gain.linearRampToValueAtTime(0.17, now + 0.01);
      g1.gain.exponentialRampToValueAtTime(0.001, now + 1.9);
      o1.connect(g1); g1.connect(master); g1.connect(delayNode);
      o1.start(now); o1.stop(now + 2.1);

      // Lower harmonic — body
      const o2 = ac.createOscillator(), g2 = ac.createGain();
      o2.type = "triangle"; o2.frequency.setValueAtTime(freq, now);
      g2.gain.setValueAtTime(0, now);
      g2.gain.linearRampToValueAtTime(0.09, now + 0.012);
      g2.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
      o2.connect(g2); g2.connect(master); g2.connect(delayNode);
      o2.start(now); o2.stop(now + 1.5);
    }

    // ── State ─────────────────────────────────────────────────────────────────
    let palette     = makePalette();
    let selected    = 0;
    let placed:     PlacedShard[] = [];
    let shockwaves: Shockwave[]   = [];
    let isDragging  = false;
    let dragX = -999, dragY = -999;
    let hoverX = -999, hoverY = -999;

    const TRAIL_LEN = 32;
    const trailX    = new Float32Array(TRAIL_LEN);
    const trailY    = new Float32Array(TRAIL_LEN);
    let trailHead   = 0, trailFilled = 0;

    let globalAngle = 0;
    let pulseT = 0, lastTs = 0;
    let showHint = true;
    let rafId = 0;

    // ── Draw one shape at current ctx origin ──────────────────────────────────
    function drawShapeAt(shape: Shape, r: number, col: Color, alpha: number) {
      const pts = shapePoints(shape, r);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();

      ctx.shadowColor = `hsla(${col.h},${col.s}%,${col.l}%,${alpha * 0.85})`;
      ctx.shadowBlur  = r * 2.4;
      ctx.fillStyle   = `hsla(${col.h},${col.s}%,${col.l}%,${alpha * 0.78})`;
      ctx.fill();
      ctx.shadowBlur  = 0;
      ctx.strokeStyle = `hsla(${col.h},${col.s + 8}%,${col.l + 12}%,${alpha * 0.95})`;
      ctx.lineWidth   = 0.9;
      ctx.stroke();

      const g = ctx.createRadialGradient(-r * 0.25, -r * 0.3, 0, 0, 0, r);
      g.addColorStop(0, `rgba(255,255,255,${alpha * 0.4})`);
      g.addColorStop(1, `rgba(255,255,255,0)`);
      ctx.fillStyle = g; ctx.fill();
    }

    // ── Stamp one shard with D8 symmetry + global rotation ────────────────────
    function stampShard(
      shape: Shape, color: Color, size: number,
      relX: number, relY: number, alpha: number,
    ) {
      ctx.globalCompositeOperation = "screen";
      for (let k = 0; k < SYMMETRY; k++) {
        const θ = k * (2 * Math.PI / SYMMETRY) + globalAngle;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(θ); ctx.translate(relX, relY);
        drawShapeAt(shape, size, color, alpha); ctx.restore();
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(θ); ctx.scale(1, -1); ctx.translate(relX, relY);
        drawShapeAt(shape, size, color, alpha); ctx.restore();
      }
      ctx.globalCompositeOperation = "source-over";
    }

    // ── Palette geometry ──────────────────────────────────────────────────────
    function palSlotX(i: number) { return (W / palette.length) * i + (W / palette.length) / 2; }
    const palY = () => H - PAL_H / 2;
    const hitPalette  = (y: number) => y >= H - PAL_H;
    const palIdx      = (x: number) => Math.min(palette.length - 1, Math.floor(x / (W / palette.length)));

    function drawPalette() {
      ctx.fillStyle = "rgba(6,6,14,0.92)"; ctx.fillRect(0, H - PAL_H, W, PAL_H);
      ctx.beginPath(); ctx.moveTo(0, H - PAL_H); ctx.lineTo(W, H - PAL_H);
      ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.font = "10px -apple-system, sans-serif"; ctx.textAlign = "center";
      ctx.fillText("ОСКОЛКИ", W / 2, H - PAL_H + 11);
      palette.forEach((item, i) => {
        const x = palSlotX(i), y = palY(), isSel = i === selected;
        if (isSel) {
          ctx.beginPath(); ctx.arc(x, y, SHARD_R + 9, 0, Math.PI * 2);
          ctx.strokeStyle = `hsla(${item.color.h},80%,80%,0.55)`;
          ctx.lineWidth = 1.5; ctx.stroke();
          const sg = ctx.createRadialGradient(x, y, 0, x, y, SHARD_R + 12);
          sg.addColorStop(0, `hsla(${item.color.h},70%,70%,0.2)`);
          sg.addColorStop(1, `hsla(${item.color.h},70%,70%,0)`);
          ctx.beginPath(); ctx.arc(x, y, SHARD_R + 12, 0, Math.PI * 2);
          ctx.fillStyle = sg; ctx.fill();
        }
        ctx.save(); ctx.translate(x, y);
        drawShapeAt(item.shape, SHARD_R, item.color, isSel ? 1 : 0.5);
        ctx.restore();
      });
    }

    // ── Background ────────────────────────────────────────────────────────────
    function drawBackground(T: number) {
      ctx.fillStyle = "#040508"; ctx.fillRect(0, 0, W, canvasH);
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, canvasH) * 0.62);
      bg.addColorStop(0, "rgba(10,12,24,0.6)"); bg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, canvasH);

      const numRings = 4, maxR = Math.min(cx, cy) * 0.82;
      for (let i = 1; i <= numRings; i++) {
        ctx.beginPath(); ctx.arc(cx, cy, maxR * (i / numRings), 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.022)"; ctx.lineWidth = 0.8; ctx.stroke();
      }
      for (let k = 0; k < SYMMETRY; k++) {
        const θ = k * Math.PI / SYMMETRY;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(θ) * 10, cy + Math.sin(θ) * 10);
        ctx.lineTo(cx + Math.cos(θ) * maxR, cy + Math.sin(θ) * maxR);
        ctx.moveTo(cx - Math.cos(θ) * 10, cy - Math.sin(θ) * 10);
        ctx.lineTo(cx - Math.cos(θ) * maxR, cy - Math.sin(θ) * maxR);
        ctx.strokeStyle = "rgba(255,255,255,0.015)"; ctx.stroke();
      }

      const pulse = 0.55 + 0.45 * Math.sin(T * 1.6);
      const cr = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30);
      cr.addColorStop(0, `rgba(200,220,255,${0.55 * pulse})`);
      cr.addColorStop(0.4, `rgba(150,180,255,${0.2 * pulse})`);
      cr.addColorStop(1, "rgba(100,140,255,0)");
      ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2);
      ctx.fillStyle = cr; ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(220,235,255,${0.8 * pulse})`; ctx.fill();
    }

    // ── Place shard ───────────────────────────────────────────────────────────
    function placeShard(x: number, y: number) {
      if (selected < 0) return;
      const item   = palette[selected];
      const relX   = x - cx, relY = y - cy;
      bootAudio();
      placed.push({
        shape: item.shape, color: item.color,
        relX, relY, size: PLACE_R,
        pulseOffset: Math.random() * Math.PI * 2,
        age: 0, settled: false,
      });
      shockwaves.push({ r: 8, maxR: Math.max(W, canvasH) * 0.68, op: 0.75, hue: item.color.h });
      playBell(relX, relY);
      showHint = false;
      palette = palette.map((p, i) =>
        i === selected ? { shape: rndItem(SHAPES), color: rndItem(COLORS) } : p
      );
    }

    // ── Events ────────────────────────────────────────────────────────────────
    function onMouseDown(e: MouseEvent) {
      const r = canvas!.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (hitPalette(y)) {
        selected = palIdx(x);
        isDragging = true; dragX = x; dragY = y;
        trailFilled = 0;
        bootAudio(); startDragHum();
      }
    }
    function onMouseMove(e: MouseEvent) {
      const r = canvas!.getBoundingClientRect();
      hoverX = e.clientX - r.left; hoverY = e.clientY - r.top;
      if (isDragging) {
        dragX = hoverX; dragY = hoverY;
        trailX[trailHead] = dragX; trailY[trailHead] = dragY;
        trailHead = (trailHead + 1) % TRAIL_LEN;
        if (trailFilled < TRAIL_LEN) trailFilled++;
      }
    }
    function onMouseUp(e: MouseEvent) {
      if (!isDragging) return;
      const r = canvas!.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      isDragging = false; stopDragHum(); trailFilled = 0;
      if (!hitPalette(y)) placeShard(x, y);
    }
    function onMouseClick(e: MouseEvent) {
      if (isDragging) return;
      const r = canvas!.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (!hitPalette(y)) placeShard(x, y);
      else { selected = palIdx(x); bootAudio(); }
    }
    function onMouseLeave() {
      if (isDragging) { isDragging = false; stopDragHum(); trailFilled = 0; }
      hoverX = -999; hoverY = -999;
    }
    function onTouchStart(e: TouchEvent) {
      const r = canvas!.getBoundingClientRect();
      const t = e.touches[0]; if (!t) return;
      const x = t.clientX - r.left, y = t.clientY - r.top;
      hoverX = x; hoverY = y;
      if (hitPalette(y)) {
        selected = palIdx(x); isDragging = true; dragX = x; dragY = y;
        trailFilled = 0; bootAudio(); startDragHum();
      } else {
        placeShard(x, y);
      }
    }
    function onTouchMove(e: TouchEvent) {
      const r = canvas!.getBoundingClientRect();
      const t = e.touches[0]; if (!t) return;
      hoverX = t.clientX - r.left; hoverY = t.clientY - r.top;
      if (isDragging) {
        dragX = hoverX; dragY = hoverY;
        trailX[trailHead] = dragX; trailY[trailHead] = dragY;
        trailHead = (trailHead + 1) % TRAIL_LEN;
        if (trailFilled < TRAIL_LEN) trailFilled++;
      }
    }
    function onTouchEnd(e: TouchEvent) {
      if (!isDragging) return;
      const r = canvas!.getBoundingClientRect();
      const t = e.changedTouches[0]; if (!t) return;
      const x = t.clientX - r.left, y = t.clientY - r.top;
      isDragging = false; stopDragHum(); trailFilled = 0;
      if (!hitPalette(y)) placeShard(x, y);
    }

    canvas.addEventListener("mousedown",  onMouseDown);
    canvas.addEventListener("mousemove",  onMouseMove);
    canvas.addEventListener("mouseup",    onMouseUp);
    canvas.addEventListener("click",      onMouseClick);
    canvas.addEventListener("mouseleave", onMouseLeave);
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove",  onTouchMove,  { passive: true });
    canvas.addEventListener("touchend",   onTouchEnd,   { passive: true });

    // ── RAF loop ──────────────────────────────────────────────────────────────
    function loop(ts: number) {
      const dt  = Math.min((ts - lastTs) / 1000, 0.05);
      lastTs    = ts;
      pulseT   += dt;
      const T   = pulseT;

      // Slow kaleidoscope rotation
      globalAngle += ROT_SPEED * dt;

      drawBackground(T);

      // Shockwaves — expand before shards so they appear behind
      shockwaves = shockwaves.filter(s => s.op > 0.01);
      for (const sw of shockwaves) {
        ctx.beginPath(); ctx.arc(cx, cy, sw.r, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${sw.hue},80%,78%,${sw.op * 0.5})`;
        ctx.lineWidth   = 3 * sw.op; ctx.stroke();
        // Second ring (slightly slower)
        ctx.beginPath(); ctx.arc(cx, cy, sw.r * 0.72, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${sw.hue},70%,85%,${sw.op * 0.28})`;
        ctx.lineWidth   = 1.5; ctx.stroke();
        sw.r  += (sw.maxR - sw.r) * 3.2 * dt;
        sw.op *= Math.pow(0.91, 60 * dt);
      }

      // Update + render placed shards
      for (const p of placed) {
        if (!p.settled) {
          p.age += dt;
          if (p.age >= ANIM_DUR) p.settled = true;
        }
        const animT  = p.settled ? 1 : Math.min(1, p.age / ANIM_DUR);
        // Ease out cubic
        const eased  = 1 - Math.pow(1 - animT, 3);
        const pulse  = 0.82 + 0.18 * Math.sin(T * 1.8 + p.pulseOffset);
        stampShard(p.shape, p.color, p.size, p.relX * eased, p.relY * eased, pulse);
      }

      // Drag trail
      if (isDragging && trailFilled > 1) {
        const item = palette[selected];
        ctx.globalCompositeOperation = "screen";
        for (let i = 1; i < trailFilled; i++) {
          const idx0 = (trailHead - i - 1 + TRAIL_LEN) % TRAIL_LEN;
          const idx1 = (trailHead - i     + TRAIL_LEN) % TRAIL_LEN;
          const frac = 1 - i / trailFilled;
          ctx.beginPath();
          ctx.moveTo(trailX[idx0], trailY[idx0]);
          ctx.lineTo(trailX[idx1], trailY[idx1]);
          ctx.strokeStyle = `hsla(${item.color.h},${item.color.s}%,${item.color.l + 14}%,${frac * 0.7})`;
          ctx.lineWidth   = frac * 7;
          ctx.lineCap     = "round";
          ctx.stroke();
        }
        ctx.globalCompositeOperation = "source-over";
      }

      // Ghost preview (hover on canvas, or active drag over canvas)
      const ghX = isDragging ? dragX : hoverX;
      const ghY = isDragging ? dragY : hoverY;
      if (ghX > 0 && ghY > 0 && !hitPalette(ghY)) {
        stampShard(palette[selected].shape, palette[selected].color, PLACE_R, ghX - cx, ghY - cy, 0.24);
      }

      drawPalette();

      if (showHint && placed.length === 0) {
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.font      = "13px -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Выберите осколок внизу — затем разместите его на холсте", cx, cy + Math.min(cx, cy) * 0.6);
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.font      = "11px -apple-system, sans-serif";
        ctx.fillText("Узор отразится симметрично и сложится в мандалу", cx, cy + Math.min(cx, cy) * 0.6 + 18);
      }

      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      canvas.removeEventListener("mousedown",  onMouseDown);
      canvas.removeEventListener("mousemove",  onMouseMove);
      canvas.removeEventListener("mouseup",    onMouseUp);
      canvas.removeEventListener("click",      onMouseClick);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove",  onTouchMove);
      canvas.removeEventListener("touchend",   onTouchEnd);
      if (dragOsc) { try { dragOsc.stop(); } catch { /* already stopped */ } }
      ac?.close();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block", touchAction: "none", cursor: "crosshair" }}
    />
  );
}
