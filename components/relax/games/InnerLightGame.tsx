"use client";

import { useEffect, useRef } from "react";

// ─── Shape library ────────────────────────────────────────────────────────────
type Shape = "tri" | "diamond" | "kite" | "wide" | "bar";
interface Color { h: number; s: number; l: number }

const SHAPES: Shape[]  = ["tri", "diamond", "kite", "wide", "bar"];
const COLORS: Color[]  = [
  { h: 210, s: 80, l: 72 }, // sky blue
  { h: 265, s: 70, l: 73 }, // violet
  { h: 170, s: 65, l: 68 }, // teal
  { h: 45,  s: 80, l: 70 }, // gold
  { h: 340, s: 72, l: 72 }, // rose
  { h: 25,  s: 75, l: 72 }, // peach
];

function shapePoints(shape: Shape, r: number): [number, number][] {
  switch (shape) {
    case "tri":     return [[0, -r], [r * 0.87, r * 0.5], [-r * 0.87, r * 0.5]];
    case "diamond": return [[0, -r * 1.25], [r * 0.42, 0], [0, r * 1.25], [-r * 0.42, 0]];
    case "kite":    return [[0, -r * 1.15], [r * 0.62, r * 0.15], [0, r * 0.72], [-r * 0.62, r * 0.15]];
    case "wide":    return [[0, -r * 0.45], [r * 0.98, r * 0.82], [-r * 0.98, r * 0.82]];
    case "bar":     return [[r * 0.22, -r * 0.78], [r * 0.22, r * 0.78], [-r * 0.22, r * 0.78], [-r * 0.22, -r * 0.78]];
  }
}

interface PalItem { shape: Shape; color: Color }
interface Placed  { shape: Shape; color: Color; relX: number; relY: number; size: number }

const SYMMETRY = 8; // D8: 8 rotations + 8 reflections = 16 copies
const PAL_H    = 72;
const SHARD_R  = 11;
const PLACE_R  = 14;

function rndItem<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function makePalette(): PalItem[] {
  return Array.from({ length: 6 }, () => ({
    shape: rndItem(SHAPES),
    color: rndItem(COLORS),
  }));
}

// ─── Component ────────────────────────────────────────────────────────────────
export function InnerLightGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    let W = 0, H = 0;
    let canvasH = 0; // usable canvas height (above palette)
    let cx = 0, cy = 0;

    function resize() {
      W = canvas!.width  = canvas!.offsetWidth;
      H = canvas!.height = canvas!.offsetHeight;
      canvasH = H - PAL_H;
      cx = W / 2;
      cy = canvasH / 2;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let palette      = makePalette();
    let selected     = 0;
    let placed: Placed[] = [];
    let hoverX       = -999;
    let hoverY       = -999;
    let inCanvas     = false;
    let showHint     = true;
    let rafId        = 0;
    let pulseT       = 0;
    let lastTs       = 0;

    // ── Draw one shape at current ctx origin ──────────────────────────────────
    function drawShapeAt(shape: Shape, r: number, col: Color, alpha: number) {
      const pts = shapePoints(shape, r);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();

      const fill   = `hsla(${col.h},${col.s}%,${col.l}%,${alpha * 0.72})`;
      const stroke = `hsla(${col.h},${col.s + 10}%,${col.l + 10}%,${alpha * 0.9})`;

      // Soft glow
      ctx.shadowColor = `hsla(${col.h},${col.s}%,${col.l}%,${alpha * 0.6})`;
      ctx.shadowBlur  = r * 1.8;
      ctx.fillStyle   = fill;
      ctx.fill();
      ctx.shadowBlur  = 0;
      ctx.strokeStyle = stroke;
      ctx.lineWidth   = 0.9;
      ctx.stroke();

      // Inner highlight
      const grad = ctx.createRadialGradient(-r * 0.25, -r * 0.3, 0, 0, 0, r);
      grad.addColorStop(0, `rgba(255,255,255,${alpha * 0.35})`);
      grad.addColorStop(1, `rgba(255,255,255,0)`);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // ── Stamp one placed shard with D8 symmetry (16 copies) ──────────────────
    function stampShard(item: Placed, alpha: number) {
      const { shape, color, relX, relY, size } = item;
      const r = size;

      for (let k = 0; k < SYMMETRY; k++) {
        const θ = k * (2 * Math.PI / SYMMETRY);
        // Rotation copy
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(θ);
        ctx.translate(relX, relY);
        drawShapeAt(shape, r, color, alpha);
        ctx.restore();

        // Reflection copy (mirror across x-axis at this rotation)
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(θ);
        ctx.scale(1, -1);
        ctx.translate(relX, relY);
        drawShapeAt(shape, r, color, alpha);
        ctx.restore();
      }
    }

    // ── Palette item geometry ─────────────────────────────────────────────────
    function palSlotX(i: number) {
      const total = palette.length;
      const slot  = W / total;
      return slot * i + slot / 2;
    }
    const palY = () => H - PAL_H / 2;

    function drawPalette() {
      // Strip background
      ctx.fillStyle = "rgba(6,6,14,0.88)";
      ctx.fillRect(0, H - PAL_H, W, PAL_H);
      ctx.beginPath();
      ctx.moveTo(0, H - PAL_H);
      ctx.lineTo(W, H - PAL_H);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Divider hint
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.font = "10px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("ОСКОЛКИ", W / 2, H - PAL_H + 11);

      // Shard items
      palette.forEach((item, i) => {
        const x = palSlotX(i);
        const y = palY();
        const isSelected = i === selected;

        if (isSelected) {
          // Selection ring
          ctx.beginPath();
          ctx.arc(x, y, SHARD_R + 9, 0, Math.PI * 2);
          ctx.strokeStyle = `hsla(${item.color.h},80%,80%,0.55)`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          // Selection bg glow
          const sg = ctx.createRadialGradient(x, y, 0, x, y, SHARD_R + 12);
          sg.addColorStop(0, `hsla(${item.color.h},70%,70%,0.18)`);
          sg.addColorStop(1, `hsla(${item.color.h},70%,70%,0)`);
          ctx.beginPath(); ctx.arc(x, y, SHARD_R + 12, 0, Math.PI * 2);
          ctx.fillStyle = sg; ctx.fill();
        }

        ctx.save();
        ctx.translate(x, y);
        drawShapeAt(item.shape, SHARD_R, item.color, isSelected ? 1 : 0.5);
        ctx.restore();
      });
    }

    // ── Background + central glow ─────────────────────────────────────────────
    function drawBackground(T: number) {
      ctx.fillStyle = "#040508";
      ctx.fillRect(0, 0, W, canvasH);

      // Deep radial vignette
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, canvasH) * 0.6);
      bg.addColorStop(0, "rgba(10,12,24,0.6)");
      bg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, canvasH);

      // Subtle grid lines (very faint circular guides)
      const numRings = 4;
      const maxR = Math.min(cx, cy) * 0.82;
      for (let i = 1; i <= numRings; i++) {
        const r = maxR * (i / numRings);
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.025)";
        ctx.lineWidth = 0.8; ctx.stroke();
      }
      // Axis lines
      for (let k = 0; k < SYMMETRY; k++) {
        const θ = k * Math.PI / SYMMETRY;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(θ) * 10, cy + Math.sin(θ) * 10);
        ctx.lineTo(cx + Math.cos(θ) * maxR, cy + Math.sin(θ) * maxR);
        ctx.moveTo(cx - Math.cos(θ) * 10, cy - Math.sin(θ) * 10);
        ctx.lineTo(cx - Math.cos(θ) * maxR, cy - Math.sin(θ) * maxR);
        ctx.strokeStyle = "rgba(255,255,255,0.018)";
        ctx.stroke();
      }

      // Central pulse
      const pulse = 0.55 + 0.45 * Math.sin(T * 1.6);
      const cr = ctx.createRadialGradient(cx, cy, 0, cx, cy, 32);
      cr.addColorStop(0, `rgba(200,220,255,${0.55 * pulse})`);
      cr.addColorStop(0.4, `rgba(150,180,255,${0.2 * pulse})`);
      cr.addColorStop(1, "rgba(100,140,255,0)");
      ctx.beginPath(); ctx.arc(cx, cy, 32, 0, Math.PI * 2);
      ctx.fillStyle = cr; ctx.fill();

      // Center dot
      ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(220,235,255,${0.8 * pulse})`; ctx.fill();
    }

    // ── Events ────────────────────────────────────────────────────────────────
    function hitPalette(y: number) { return y >= H - PAL_H; }

    function paletteIndex(x: number): number {
      const slot = W / palette.length;
      return Math.min(palette.length - 1, Math.floor(x / slot));
    }

    function onClick(ex: number, ey: number) {
      if (hitPalette(ey)) {
        selected = paletteIndex(ex);
        return;
      }
      // Place on canvas
      if (selected < 0) return;
      const item = palette[selected];
      placed.push({
        shape: item.shape, color: item.color,
        relX: ex - cx, relY: ey - cy,
        size: PLACE_R,
      });
      showHint = false;
      // Replace used palette item with fresh one
      palette = palette.map((p, i) =>
        i === selected ? { shape: rndItem(SHAPES), color: rndItem(COLORS) } : p
      );
    }

    function onMouseMove(e: MouseEvent) {
      const r = canvas!.getBoundingClientRect();
      hoverX = e.clientX - r.left;
      hoverY = e.clientY - r.top;
      inCanvas = !hitPalette(hoverY);
    }
    function onMouseLeave() { inCanvas = false; }
    function onMouseClick(e: MouseEvent) {
      const r = canvas!.getBoundingClientRect();
      onClick(e.clientX - r.left, e.clientY - r.top);
    }
    function onTouchStart(e: TouchEvent) {
      const r = canvas!.getBoundingClientRect();
      const t = e.touches[0]; if (!t) return;
      hoverX = t.clientX - r.left;
      hoverY = t.clientY - r.top;
      inCanvas = !hitPalette(hoverY);
      onClick(hoverX, hoverY);
    }
    function onTouchMove(e: TouchEvent) {
      const r = canvas!.getBoundingClientRect();
      const t = e.touches[0]; if (!t) return;
      hoverX = t.clientX - r.left;
      hoverY = t.clientY - r.top;
      inCanvas = !hitPalette(hoverY);
    }

    canvas.addEventListener("mousemove",  onMouseMove);
    canvas.addEventListener("mouseleave", onMouseLeave);
    canvas.addEventListener("click",      onMouseClick);
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove",  onTouchMove,  { passive: true });

    // ── RAF loop ──────────────────────────────────────────────────────────────
    function loop(ts: number) {
      const dt = Math.min((ts - lastTs) / 1000, 0.05);
      lastTs = ts;
      pulseT += dt;
      const T = pulseT;

      drawBackground(T);

      // Placed shards
      for (const p of placed) stampShard(p, 1);

      // Ghost preview
      if (inCanvas && selected >= 0) {
        const ghost: Placed = {
          shape: palette[selected].shape,
          color: palette[selected].color,
          relX: hoverX - cx,
          relY: hoverY - cy,
          size: PLACE_R,
        };
        stampShard(ghost, 0.28);
      }

      // Clip palette area from overlay
      drawPalette();

      // Hint text
      if (showHint && placed.length === 0) {
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.font = "13px -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Выберите осколок внизу — затем разместите его на холсте", cx, cy + Math.min(cx, cy) * 0.6);
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.font = "11px -apple-system, sans-serif";
        ctx.fillText("Узор отразится симметрично и сложится в мандалу", cx, cy + Math.min(cx, cy) * 0.6 + 18);
      }

      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      canvas.removeEventListener("mousemove",  onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      canvas.removeEventListener("click",      onMouseClick);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove",  onTouchMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block", touchAction: "none", cursor: "crosshair" }}
    />
  );
}
