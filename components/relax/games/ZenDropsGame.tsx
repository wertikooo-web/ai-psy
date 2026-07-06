"use client";

import { useEffect, useRef } from "react";

// ── Pastel palette ────────────────────────────────────────────────────────────
const COLORS = [
  { fill: "rgba(200,158,200,0.75)", stroke: "rgba(200,158,200,0.9)", glow: "rgba(200,158,200,0.3)" },
  { fill: "rgba(140,186,212,0.75)", stroke: "rgba(140,186,212,0.9)", glow: "rgba(140,186,212,0.3)" },
  { fill: "rgba(142,202,180,0.75)", stroke: "rgba(142,202,180,0.9)", glow: "rgba(142,202,180,0.3)" },
  { fill: "rgba(180,160,212,0.75)", stroke: "rgba(180,160,212,0.9)", glow: "rgba(180,160,212,0.3)" },
  { fill: "rgba(212,180,140,0.75)", stroke: "rgba(212,180,140,0.9)", glow: "rgba(212,180,140,0.3)" },
  { fill: "rgba(140,180,140,0.75)", stroke: "rgba(140,180,140,0.9)", glow: "rgba(140,180,140,0.3)" },
];
const MAX_LEVEL = COLORS.length - 1;

// ── Sizes per level ───────────────────────────────────────────────────────────
function levelRadius(level: number) { return 14 + level * 10; }

interface Col { fill: string; stroke: string; glow: string }

// ── Ball ──────────────────────────────────────────────────────────────────────
class Ball {
  static _serial = 0;
  id: number;
  vx = 0; vy = 0;
  merging = false;
  fadeOut = 0; // 0 = alive, 1 = fully faded
  merged = false;
  col: Col;
  r: number;
  pulseT = 0;

  constructor(public x: number, public y: number, public level: number) {
    this.id  = Ball._serial++;
    this.r   = levelRadius(level);
    this.col = COLORS[level % COLORS.length];
  }
}

// ── World constants ───────────────────────────────────────────────────────────
const GRAVITY  = 900;
const DAMPING  = 0.38;
const FRICTION = 0.88;
const ITERS    = 4;
const DROP_X_MARGIN = 0.12; // fraction of W

// ── Component ─────────────────────────────────────────────────────────────────
export function ZenDropsGame() {
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

    // Game state
    let balls: Ball[] = [];
    let nextLevel = 0;
    let dropBall: Ball | null = null; // the ball being aimed before drop
    let dropX = 0;
    let dragging = false;
    let rafId = 0;
    let merges: { x: number; y: number; r: number; op: number; col: Col }[] = [];

    function nextBallLevel() {
      // weighted: lower levels more common
      const r = Math.random();
      if (r < 0.55) return 0;
      if (r < 0.80) return 1;
      if (r < 0.92) return 2;
      return 3;
    }

    function spawnDropBall() {
      nextLevel = nextBallLevel();
      dropX = W / 2;
      dropBall = new Ball(dropX, levelRadius(nextLevel) + 18, nextLevel);
    }
    spawnDropBall();

    // ── Physics ───────────────────────────────────────────────────────────────
    function step(dt: number) {
      const floor = H - 4;
      const WALL  = 3;

      balls.forEach(b => {
        if (b.merged) return;
        b.vy += GRAVITY * dt;
        b.x  += b.vx * dt;
        b.y  += b.vy * dt;

        // Floor
        if (b.y + b.r > floor) {
          b.y  = floor - b.r;
          b.vy = -Math.abs(b.vy) * DAMPING;
          b.vx *= FRICTION;
        }
        // Walls
        if (b.x - b.r < WALL) { b.x = WALL + b.r; b.vx = Math.abs(b.vx) * DAMPING; }
        if (b.x + b.r > W - WALL) { b.x = W - WALL - b.r; b.vx = -Math.abs(b.vx) * DAMPING; }
      });

      // Resolve collisions
      for (let iter = 0; iter < ITERS; iter++) {
        for (let i = 0; i < balls.length; i++) {
          const a = balls[i]; if (a.merged) continue;
          for (let j = i + 1; j < balls.length; j++) {
            const b = balls[j]; if (b.merged) continue;
            const dx = b.x - a.x, dy = b.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minD = a.r + b.r;
            if (dist < minD && dist > 0.001) {
              const nx = dx / dist, ny = dy / dist;
              const pen = (minD - dist) * 0.5;
              a.x -= nx * pen; a.y -= ny * pen;
              b.x += nx * pen; b.y += ny * pen;
              const rv  = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
              if (rv < 0) {
                const j2  = rv * (1 + DAMPING) * 0.5;
                a.vx += j2 * nx; a.vy += j2 * ny;
                b.vx -= j2 * nx; b.vy -= j2 * ny;
              }
            }
          }
        }
      }
    }

    // ── Merge detection ───────────────────────────────────────────────────────
    function checkMerges() {
      for (let i = 0; i < balls.length; i++) {
        const a = balls[i]; if (a.merged || a.merging) continue;
        for (let j = i + 1; j < balls.length; j++) {
          const b = balls[j]; if (b.merged || b.merging || b.level !== a.level) continue;
          if (a.level >= MAX_LEVEL) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          if (Math.sqrt(dx * dx + dy * dy) < a.r + b.r + 2) {
            // merge flash effect
            merges.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, r: a.r * 1.4, op: 0.9, col: a.col });
            a.merged = true; b.merged = true;
            const nx = new Ball((a.x + b.x) / 2, (a.y + b.y) / 2, a.level + 1);
            nx.vy = -120; nx.vx = (a.vx + b.vx) * 0.3;
            nx.pulseT = 1;
            balls.push(nx);
          }
        }
      }
      balls = balls.filter(b => !b.merged);
    }

    // ── Drop ──────────────────────────────────────────────────────────────────
    function drop() {
      if (!dropBall) return;
      const b     = dropBall;
      b.x  = dropX;
      b.y  = levelRadius(b.level) + 18;
      b.vy = 80;
      b.vx = 0;
      balls.push(b);
      dropBall = null;
      setTimeout(spawnDropBall, 320);
    }

    // ── Input ─────────────────────────────────────────────────────────────────
    function getClientX(e: MouseEvent | TouchEvent): number {
      if ("touches" in e) return e.touches[0]?.clientX ?? (e as TouchEvent).changedTouches[0].clientX;
      return (e as MouseEvent).clientX;
    }
    function clampDropX(e: MouseEvent | TouchEvent) {
      const rect = canvas!.getBoundingClientRect();
      const r    = dropBall ? dropBall.r : levelRadius(nextLevel);
      const lx   = getClientX(e) - rect.left;
      return Math.max(W * DROP_X_MARGIN + r, Math.min(W * (1 - DROP_X_MARGIN) - r, lx));
    }

    function onDown(e: MouseEvent | TouchEvent) {
      if ("touches" in e) (e as TouchEvent).preventDefault();
      dragging = true;
      dropX = clampDropX(e);
      if (dropBall) dropBall.x = dropX;
    }
    function onMove(e: MouseEvent | TouchEvent) {
      if (!dragging) return;
      if ("touches" in e) (e as TouchEvent).preventDefault();
      dropX = clampDropX(e);
      if (dropBall) dropBall.x = dropX;
    }
    function onUp() { if (dragging) { dragging = false; drop(); } }

    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseup",   onUp);
    canvas.addEventListener("touchstart", onDown as EventListener, { passive: false });
    canvas.addEventListener("touchmove",  onMove as EventListener, { passive: false });
    canvas.addEventListener("touchend",   onUp);

    // ── Draw ──────────────────────────────────────────────────────────────────
    function drawBall(b: Ball, alpha = 1) {
      const r = b.r + (b.pulseT > 0 ? b.pulseT * 8 : 0);
      ctx.save();
      ctx.globalAlpha = alpha;

      // glow
      const grad = ctx.createRadialGradient(b.x, b.y, r * 0.3, b.x, b.y, r * 2);
      grad.addColorStop(0, b.col.glow);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath(); ctx.arc(b.x, b.y, r * 2, 0, Math.PI * 2);
      ctx.fillStyle = grad; ctx.fill();

      // body
      ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.fillStyle   = b.col.fill;
      ctx.strokeStyle = b.col.stroke;
      ctx.lineWidth   = 1.5;
      ctx.fill(); ctx.stroke();

      // shine
      const sh = ctx.createRadialGradient(b.x - r * 0.3, b.y - r * 0.38, 0, b.x, b.y, r);
      sh.addColorStop(0, "rgba(255,255,255,0.35)");
      sh.addColorStop(0.5, "rgba(255,255,255,0.05)");
      sh.addColorStop(1, "rgba(255,255,255,0)");
      ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.fillStyle = sh; ctx.fill();

      ctx.restore();
    }

    let lastT = 0;
    let dropLineAlpha = 0;

    function loop(ts: number) {
      const dt = Math.min((ts - lastT) / 1000, 0.05);
      lastT = ts;

      step(dt);
      checkMerges();

      // pulse update
      balls.forEach(b => { if (b.pulseT > 0) b.pulseT = Math.max(0, b.pulseT - dt * 2.5); });

      // merge flashes
      merges = merges.filter(m => m.op > 0.01);
      merges.forEach(m => { m.op *= 0.88; m.r += 1.5; });

      // ── Background ──────────────────────────────────────────────────────
      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(0, 0, W, H);
      const bg = ctx.createRadialGradient(W / 2, H * 0.7, 0, W / 2, H * 0.5, Math.max(W, H) * 0.6);
      bg.addColorStop(0, "rgba(20,14,36,0.6)"); bg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      // Floor line
      ctx.beginPath(); ctx.moveTo(0, H - 4); ctx.lineTo(W, H - 4);
      ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 1; ctx.stroke();

      // ── Drop guide ──────────────────────────────────────────────────────
      if (dropBall) {
        dropLineAlpha = Math.min(1, dropLineAlpha + dt * 4);
        ctx.save();
        ctx.globalAlpha = dropLineAlpha * 0.15;
        ctx.setLineDash([4, 8]);
        ctx.beginPath();
        ctx.moveTo(dropBall.x, dropBall.y + dropBall.r);
        ctx.lineTo(dropBall.x, H - 4);
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        drawBall(dropBall, 0.85);
      }

      // ── Balls ────────────────────────────────────────────────────────────
      balls.forEach(b => drawBall(b));

      // ── Merge flashes ────────────────────────────────────────────────────
      merges.forEach(m => {
        ctx.save();
        ctx.globalAlpha = m.op;
        const g2 = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
        g2.addColorStop(0, m.col.stroke);
        g2.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = g2; ctx.fill();
        ctx.restore();
      });

      // ── Hint ─────────────────────────────────────────────────────────────
      if (balls.length === 0) {
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.font = "13px -apple-system,sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Перетащите и отпустите, чтобы уронить шарик", W / 2, H - 28);
      }

      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseup",   onUp);
      canvas.removeEventListener("touchstart", onDown as EventListener);
      canvas.removeEventListener("touchmove",  onMove as EventListener);
      canvas.removeEventListener("touchend",   onUp);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }}
    />
  );
}
