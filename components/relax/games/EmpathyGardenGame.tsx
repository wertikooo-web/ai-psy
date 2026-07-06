"use client";

import { useEffect, useRef } from "react";

function rnd(lo: number, hi: number) { return lo + Math.random() * (hi - lo); }

// ─── Types ────────────────────────────────────────────────────────────────────
interface Seg { x1: number; y1: number; x2: number; y2: number; depth: number; }

interface Seed {
  id: number; x: number; y: number; vx: number; vy: number;
  r: number; rot: number; rotV: number;
  spikes: number[];       // relative spike lengths for jagged polygon
  attracted: boolean;
  flashT: number;         // countdown from 0.7 → 0: white flash
  dead: boolean;
}

interface Flower {
  seg: Seg;
  travelT: number;        // 0→1 along branch
  travelDur: number;
  bloomT: number;         // 0→1 bloom open
  x: number; y: number;
  targetR: number;
  traveling: boolean;
  hue: number;
  petals: number;
}

// ─── Deterministic tree ───────────────────────────────────────────────────────
function buildTree(cx: number, baseY: number, trunkH: number): Seg[] {
  const segs: Seg[] = [];
  const SPREADS = [0.52, 0.46, 0.42, 0.38, 0.34];
  const RATIOS  = [0.68, 0.70, 0.68, 0.65, 0.62];

  function branch(x1: number, y1: number, angle: number, len: number, depth: number) {
    if (depth > 4 || len < 8) return;
    const x2 = x1 + Math.cos(angle) * len;
    const y2 = y1 + Math.sin(angle) * len;
    segs.push({ x1, y1, x2, y2, depth });
    branch(x2, y2, angle - SPREADS[depth], len * RATIOS[depth], depth + 1);
    branch(x2, y2, angle + SPREADS[depth], len * RATIOS[depth], depth + 1);
  }

  branch(cx, baseY, -Math.PI / 2, trunkH, 0);
  return segs;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function EmpathyGardenGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    let W = 0, H = 0;
    let segs: Seg[] = [];
    let rootX = 0, rootY = 0;

    function resize() {
      W = canvas!.width  = canvas!.offsetWidth;
      H = canvas!.height = canvas!.offsetHeight;
      rootX = W / 2;
      rootY = H * 0.75;
      segs = buildTree(rootX, rootY, H * 0.37);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Cursor state
    let curX = W / 2, curY = H / 2;
    let cursorActive = false;

    // Trail ring buffer
    const TRAIL_LEN = 40;
    const trailX = new Float32Array(TRAIL_LEN);
    const trailY = new Float32Array(TRAIL_LEN);
    let trailHead = 0;
    let trailFilled = 0;

    let seeds: Seed[] = [];
    let flowers: Flower[] = [];
    let seedIdCtr = 0;
    let rafId = 0;
    let lastT = 0;
    let spawnTimer = 3.0;
    let showHint = true;

    // ── Spawn ────────────────────────────────────────────────────────────────
    function spawnSeed() {
      const edge = Math.floor(Math.random() * 4);
      let x = 0, y = 0;
      if (edge === 0)      { x = rnd(0, W); y = -24; }
      else if (edge === 1) { x = W + 24; y = rnd(0, H); }
      else if (edge === 2) { x = rnd(0, W); y = H + 24; }
      else                 { x = -24; y = rnd(0, H); }

      const n = 6 + Math.floor(Math.random() * 4);
      const spikes: number[] = [];
      for (let i = 0; i < n; i++) spikes.push(0.38 + Math.random() * 0.62);

      seeds.push({
        id: seedIdCtr++,
        x, y,
        vx: rnd(-12, 12), vy: rnd(-12, 12),
        r: rnd(6, 12),
        rot: Math.random() * Math.PI * 2,
        rotV: rnd(-0.6, 0.6),
        spikes,
        attracted: false,
        flashT: 0,
        dead: false,
      });
    }

    // Seed positions that look natural (not from edges)
    function spawnInitialSeed(i: number) {
      const angle = (i / 7) * Math.PI * 2 + Math.random() * 0.5;
      const dist  = rnd(W * 0.25, Math.min(W, H) * 0.42);
      const cx    = W / 2, cy = H / 2;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      const n = 6 + Math.floor(Math.random() * 4);
      const spikes: number[] = [];
      for (let j = 0; j < n; j++) spikes.push(0.38 + Math.random() * 0.62);
      seeds.push({
        id: seedIdCtr++, x, y,
        vx: rnd(-8, 8), vy: rnd(-8, 8),
        r: rnd(7, 13), rot: Math.random() * Math.PI * 2, rotV: rnd(-0.5, 0.5),
        spikes, attracted: false, flashT: 0, dead: false,
      });
    }
    for (let i = 0; i < 7; i++) spawnInitialSeed(i);

    // Pre-add a few decorative flowers at roots and lower branches
    function addDecorFlower(seg: Seg, hue: number) {
      flowers.push({
        seg, travelT: 1, travelDur: 1, bloomT: 1,
        x: seg.x2, y: seg.y2,
        targetR: 8 - seg.depth,
        traveling: false, hue, petals: 5 + Math.floor(Math.random() * 3),
      });
    }
    const rootSegs = segs.filter(s => s.depth === 1);
    if (rootSegs[0]) addDecorFlower(rootSegs[0], 200);
    if (rootSegs[1]) addDecorFlower(rootSegs[1], 280);
    const depth2 = segs.filter(s => s.depth === 2);
    if (depth2[0]) addDecorFlower(depth2[0], 45);
    if (depth2[3]) addDecorFlower(depth2[3], 320);

    // ── Event handlers ────────────────────────────────────────────────────────
    function onMove(e: MouseEvent) {
      const r = canvas!.getBoundingClientRect();
      curX = e.clientX - r.left;
      curY = e.clientY - r.top;
      cursorActive = true;
    }
    function onTouchMove(e: TouchEvent) {
      const r = canvas!.getBoundingClientRect();
      const t = e.touches[0];
      if (!t) return;
      curX = t.clientX - r.left;
      curY = t.clientY - r.top;
      cursorActive = true;
      showHint = false;
    }
    function onTouchStart(e: TouchEvent) {
      const r = canvas!.getBoundingClientRect();
      const t = e.touches[0];
      if (!t) return;
      curX = t.clientX - r.left;
      curY = t.clientY - r.top;
      cursorActive = true;
      showHint = false;
    }
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("touchmove",  onTouchMove,  { passive: true });
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });

    // ── Pick a branch for flower to travel ────────────────────────────────────
    function pickFlowerSeg(): Seg {
      const candidates = segs.filter(s => s.depth >= 2 && s.depth <= 4);
      if (!candidates.length) return segs[segs.length - 1];
      return candidates[Math.floor(Math.random() * candidates.length)];
    }

    // ── Transform seed → flower ───────────────────────────────────────────────
    function triggerTransform(seed: Seed) {
      seed.dead = true;
      seed.flashT = 0.75;
      showHint = false;
      const seg = pickFlowerSeg();
      const hue = [200, 265, 42, 310, 170, 340][Math.floor(Math.random() * 6)];
      const depth = seg.depth;
      flowers.push({
        seg,
        travelT: 0, travelDur: 1.8 + Math.random() * 1.0,
        bloomT: 0,
        x: seg.x1, y: seg.y1,
        targetR: Math.max(3, 9 - depth),
        traveling: true,
        hue,
        petals: 5 + Math.floor(Math.random() * 4),
      });
    }

    // ── Draw seed (jagged dark polygon) ──────────────────────────────────────
    function drawSeed(seed: Seed, alpha: number) {
      if (seed.flashT > 0) {
        const fa = Math.min(1, seed.flashT * 2.5);
        const rr = seed.r * (1 + (0.75 - seed.flashT) * 1.5);
        const g = ctx.createRadialGradient(seed.x, seed.y, 0, seed.x, seed.y, rr * 2.5);
        g.addColorStop(0, `rgba(255,255,255,${fa * alpha})`);
        g.addColorStop(1, `rgba(255,255,255,0)`);
        ctx.beginPath(); ctx.arc(seed.x, seed.y, rr * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();
        return;
      }

      ctx.save();
      ctx.translate(seed.x, seed.y);
      ctx.rotate(seed.rot);

      const n = seed.spikes.length;

      // Outer halo
      const halo = ctx.createRadialGradient(0, 0, seed.r * 0.4, 0, 0, seed.r * 2.2);
      halo.addColorStop(0, `rgba(65,45,80,${alpha * 0.28})`);
      halo.addColorStop(1, `rgba(30,15,40,0)`);
      ctx.beginPath(); ctx.arc(0, 0, seed.r * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = halo; ctx.fill();

      // Jagged polygon (alternating outer spike / inner valley)
      ctx.beginPath();
      for (let i = 0; i < n * 2; i++) {
        const angle  = (i / (n * 2)) * Math.PI * 2;
        const isSpike = i % 2 === 0;
        const r = isSpike ? seed.r * seed.spikes[Math.floor(i / 2)] : seed.r * 0.4;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle   = `rgba(28,18,40,${alpha * 0.9})`;
      ctx.strokeStyle = `rgba(80,55,100,${alpha * 0.55})`;
      ctx.lineWidth   = 0.6;
      ctx.fill();
      ctx.stroke();

      // Attracted glow tint
      if (seed.attracted) {
        ctx.beginPath();
        for (let i = 0; i < n * 2; i++) {
          const angle   = (i / (n * 2)) * Math.PI * 2;
          const isSpike  = i % 2 === 0;
          const r = isSpike ? seed.r * seed.spikes[Math.floor(i / 2)] : seed.r * 0.4;
          const px = Math.cos(angle) * r;
          const py = Math.sin(angle) * r;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = `rgba(130,100,200,${alpha * 0.15})`;
        ctx.fill();
      }

      ctx.restore();
    }

    // ── Draw geometric flower ─────────────────────────────────────────────────
    function drawFlower(f: Flower) {
      const r = f.targetR * f.bloomT;
      if (r < 0.5) return;

      ctx.save();
      ctx.translate(f.x, f.y);

      // Halo
      const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 3);
      gl.addColorStop(0, `hsla(${f.hue},75%,70%,0.22)`);
      gl.addColorStop(1, `hsla(${f.hue},75%,70%,0)`);
      ctx.beginPath(); ctx.arc(0, 0, r * 3, 0, Math.PI * 2);
      ctx.fillStyle = gl; ctx.fill();

      // Petals
      for (let i = 0; i < f.petals; i++) {
        const ang = (i / f.petals) * Math.PI * 2;
        ctx.save();
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.78, r * 0.27, r * 0.48, 0, 0, Math.PI * 2);
        ctx.fillStyle   = `hsla(${f.hue},75%,76%,0.75)`;
        ctx.strokeStyle = `hsla(${f.hue},85%,88%,0.5)`;
        ctx.lineWidth   = 0.7;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Center dot
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.26, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${f.hue + 30},90%,90%,0.92)`;
      ctx.fill();

      ctx.restore();
    }

    // ── Draw tree ─────────────────────────────────────────────────────────────
    function drawTree(T: number) {
      ctx.save();
      for (const seg of segs) {
        const d = seg.depth;
        const w = Math.max(0.5, 3.8 - d * 0.75);
        const hue   = 215 + d * 9;
        const light = 58 + d * 5;
        const alpha = 0.38 + (4 - d) * 0.09;

        ctx.shadowColor = `hsla(${hue},60%,${light}%,0.55)`;
        ctx.shadowBlur  = 5 + (4 - d);

        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.strokeStyle = `hsla(${hue},60%,${light}%,${alpha})`;
        ctx.lineWidth   = w;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.restore();

      // Root pulse (warm gold)
      const pulse = 0.65 + 0.35 * Math.sin(T * 1.8);
      const rg = ctx.createRadialGradient(rootX, rootY, 0, rootX, rootY, 44);
      rg.addColorStop(0, `rgba(255,195,70,${0.45 * pulse})`);
      rg.addColorStop(0.5, `rgba(255,160,40,${0.18 * pulse})`);
      rg.addColorStop(1, `rgba(255,120,20,0)`);
      ctx.beginPath(); ctx.arc(rootX, rootY, 44, 0, Math.PI * 2);
      ctx.fillStyle = rg; ctx.fill();
    }

    // ── Main loop ─────────────────────────────────────────────────────────────
    function loop(ts: number) {
      const dt = Math.min((ts - lastT) / 1000, 0.05);
      lastT = ts;
      const T = ts / 1000;

      // ── Background ────────────────────────────────────────────────────────
      ctx.fillStyle = "#04060e";
      ctx.fillRect(0, 0, W, H);

      // Atmospheric vignette
      const vg = ctx.createRadialGradient(W / 2, H * 0.38, 0, W / 2, H * 0.38, Math.max(W, H) * 0.68);
      vg.addColorStop(0, "rgba(8,12,28,0.55)");
      vg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

      // ── Spawn seeds ───────────────────────────────────────────────────────
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        if (seeds.filter(s => !s.dead).length < 20) spawnSeed();
        spawnTimer = rnd(2.8, 5.5);
      }

      // ── Update seeds ──────────────────────────────────────────────────────
      let attractedCount = 0;
      seeds = seeds.filter(s => !s.dead || s.flashT > 0);

      for (const seed of seeds) {
        // Still flashing (already dead physically)
        if (seed.flashT > 0) { seed.flashT -= dt; continue; }
        if (seed.dead) continue;

        seed.rot += seed.rotV * dt;

        const dxC = curX - seed.x;
        const dyC = curY - seed.y;
        const distC = Math.sqrt(dxC * dxC + dyC * dyC);

        const ATTR_R = 190;
        if (distC < ATTR_R && cursorActive) {
          seed.attracted = true;
          attractedCount++;
          const t = 1 - distC / ATTR_R;
          const force = 75 * t * t * (distC < 50 ? 0.15 : 1);
          seed.vx += (dxC / (distC + 0.1)) * force * dt;
          seed.vy += (dyC / (distC + 0.1)) * force * dt;
        } else {
          if (distC > ATTR_R * 1.4) seed.attracted = false;
          // Gentle drift toward screen center
          seed.vx += (W / 2 - seed.x) * 0.012 * dt;
          seed.vy += (H / 2 - seed.y) * 0.012 * dt;
        }

        // Speed cap + damping
        const spd = Math.sqrt(seed.vx * seed.vx + seed.vy * seed.vy);
        if (spd > 130) { seed.vx = (seed.vx / spd) * 130; seed.vy = (seed.vy / spd) * 130; }
        seed.vx *= 0.955;
        seed.vy *= 0.955;

        seed.x += seed.vx * dt;
        seed.y += seed.vy * dt;

        // Wrap edges
        if      (seed.x < -35) seed.x = W + 25;
        else if (seed.x > W + 35) seed.x = -25;
        if      (seed.y < -35) seed.y = H + 25;
        else if (seed.y > H + 35) seed.y = -25;

        // Root collision
        const dxR = seed.x - rootX, dyR = seed.y - rootY;
        if (seed.attracted && Math.sqrt(dxR * dxR + dyR * dyR) < 38) {
          triggerTransform(seed);
        }
      }

      // ── Update flowers ────────────────────────────────────────────────────
      for (const f of flowers) {
        if (f.traveling) {
          f.travelT += dt / f.travelDur;
          if (f.travelT >= 1) {
            f.travelT = 1; f.traveling = false;
            f.x = f.seg.x2; f.y = f.seg.y2;
          } else {
            f.x = f.seg.x1 + (f.seg.x2 - f.seg.x1) * f.travelT;
            f.y = f.seg.y1 + (f.seg.y2 - f.seg.y1) * f.travelT;
          }
        } else if (f.bloomT < 1) {
          f.bloomT = Math.min(1, f.bloomT + dt * 0.55);
        }
      }

      // ── Render ────────────────────────────────────────────────────────────
      drawTree(T);

      for (const f of flowers) drawFlower(f);
      for (const seed of seeds) drawSeed(seed, 1);

      // Trail
      trailX[trailHead] = curX;
      trailY[trailHead] = curY;
      trailHead = (trailHead + 1) % TRAIL_LEN;
      if (trailFilled < TRAIL_LEN) trailFilled++;

      if (cursorActive && trailFilled > 1) {
        const weight = Math.min(attractedCount / 12, 1);
        const trailAlpha = 0.28 - weight * 0.1;

        for (let i = 1; i < trailFilled; i++) {
          const idx0 = (trailHead - i - 1 + TRAIL_LEN) % TRAIL_LEN;
          const idx1 = (trailHead - i     + TRAIL_LEN) % TRAIL_LEN;
          const frac  = 1 - i / trailFilled;
          ctx.beginPath();
          ctx.moveTo(trailX[idx0], trailY[idx0]);
          ctx.lineTo(trailX[idx1], trailY[idx1]);
          ctx.strokeStyle = `rgba(160,210,255,${frac * trailAlpha})`;
          ctx.lineWidth   = frac * 1.8;
          ctx.stroke();
        }
      }

      // Cursor
      if (cursorActive) {
        const weight = Math.min(attractedCount / 12, 1);
        const pulse  = 1 + 0.35 * Math.sin(T * 4.5);
        const baseR  = 3.5 + weight * 1.5;

        // Outer glow
        const cg = ctx.createRadialGradient(curX, curY, 0, curX, curY, 22 + weight * 12);
        cg.addColorStop(0, `rgba(190,235,255,${0.45 - weight * 0.12})`);
        cg.addColorStop(1, `rgba(100,180,255,0)`);
        ctx.beginPath(); ctx.arc(curX, curY, 22 + weight * 12, 0, Math.PI * 2);
        ctx.fillStyle = cg; ctx.fill();

        // Pulse ring
        ctx.beginPath();
        ctx.arc(curX, curY, (baseR + 8) * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(170,225,255,${0.25 - weight * 0.07})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Core dot
        ctx.beginPath();
        ctx.arc(curX, curY, baseR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(240,250,255,${0.92 - weight * 0.18})`;
        ctx.fill();
      }

      // Hint
      if (showHint) {
        ctx.fillStyle = "rgba(255,255,255,0.16)";
        ctx.font = "13px -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Двигайте курсором — тёмные семена потянутся за вами", W / 2, H - 32);
        ctx.fillText("Приведите их к корням дерева, чтобы расцвели цветы", W / 2, H - 14);
      }

      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("touchmove",  onTouchMove);
      canvas.removeEventListener("touchstart", onTouchStart);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block", touchAction: "none", cursor: "none" }}
    />
  );
}
