"use client";

import { useEffect, useRef } from "react";

// ── Tunables ──────────────────────────────────────────────────────────────────
const N          = 1100;   // particle count
const EGG_R      = 68;     // egg base radius
const OBS_COUNT  = 4;      // obstacle blobs
const ATTRACT    = 0.14;   // how strongly particles chase cursor
const DAMP       = 0.91;
const WANDER     = 0.28;   // wander force
const MAX_SPD    = 5.2;

// ── State ─────────────────────────────────────────────────────────────────────
type Phase = "swarming" | "climaxing" | "complete";

interface P {
  x: number; y: number;
  vx: number; vy: number;
  wa: number;     // wander angle
  hv: number;     // hue variant 0-1
  fade: number;   // 1=alive, fades during climax
}
interface Obs {
  x: number; y: number; r: number;
  vx: number; vy: number; ph: number;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function TheWayGame() {
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

    // ── Shared mutable state (in ref so no stale closures) ───────────────────
    let phase: Phase = "swarming";
    let mx = 0, my = 0;           // mouse / touch position
    let mMoved = false;
    let eggX = 0, eggY = 0;       // set in loop after W/H known
    let climaxT = 0;
    let completeT = 0;
    let winnerIdx = -1;
    let frame = 0;

    // Particles
    const ps: P[] = [];
    function initParticles() {
      ps.length = 0;
      eggX = W / 2; eggY = H / 2;
      mx = W * 0.15; my = H * 0.5;          // start hint position
      for (let i = 0; i < N; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = 100 + Math.random() * 220;
        ps.push({
          x: eggX + Math.cos(a) * d,
          y: eggY + Math.sin(a) * d,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          wa: Math.random() * Math.PI * 2,
          hv: Math.random(),
          fade: 1,
        });
      }
    }

    // Obstacles
    const obs: Obs[] = [];
    function initObs() {
      obs.length = 0;
      eggX = W / 2; eggY = H / 2;
      for (let i = 0; i < OBS_COUNT; i++) {
        const a = (i / OBS_COUNT) * Math.PI * 2 + 0.6;
        const d = 155 + (i % 2) * 65;
        obs.push({
          x: eggX + Math.cos(a) * d,
          y: eggY + Math.sin(a) * d,
          r: 38 + Math.random() * 22,
          vx: (Math.random() - 0.5) * 0.45,
          vy: (Math.random() - 0.5) * 0.45,
          ph: Math.random() * Math.PI * 2,
        });
      }
    }

    // First init (W/H may be 0 here, done again in first loop frame)
    initParticles(); initObs();

    // ── Mouse / touch ────────────────────────────────────────────────────────
    function setMouse(e: MouseEvent | TouchEvent) {
      const rect = canvas!.getBoundingClientRect();
      if ("touches" in e) {
        const t = (e as TouchEvent).touches[0] ?? (e as TouchEvent).changedTouches[0];
        mx = t.clientX - rect.left; my = t.clientY - rect.top;
      } else {
        mx = (e as MouseEvent).clientX - rect.left;
        my = (e as MouseEvent).clientY - rect.top;
      }
      mMoved = true;
    }
    canvas.addEventListener("mousemove", setMouse);
    canvas.addEventListener("touchmove", setMouse as EventListener, { passive: true });
    canvas.addEventListener("touchstart", setMouse as EventListener, { passive: true });

    function onClick() {
      if (phase === "complete" && completeT > 4) {
        phase = "swarming"; climaxT = 0; completeT = 0; winnerIdx = -1; frame = 0;
        initParticles(); initObs();
      }
    }
    canvas.addEventListener("click", onClick);

    // ── Helpers ───────────────────────────────────────────────────────────────
    function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }

    // ── Per-frame drawing functions ───────────────────────────────────────────

    function drawEgg(t: number, golden = 0) {
      const pulse = 1 + Math.sin(t * 0.0018) * 0.08;
      const r     = EGG_R * pulse * (1 + golden * 0.28);

      // Outer halo rings (4)
      for (let layer = 0; layer < 4; layer++) {
        const lr  = r * (2.8 - layer * 0.45);
        const alp = (0.055 - layer * 0.01) * (1 + golden * 0.6);
        const rr  = Math.round(255);
        const gg  = Math.round(golden > 0 ? 200 + golden * 30 : 180);
        const bb  = Math.round(golden > 0 ? 80 - golden * 60 : 140);
        const g   = ctx.createRadialGradient(eggX, eggY, r * 0.3, eggX, eggY, lr);
        g.addColorStop(0, `rgba(${rr},${gg},${bb},${alp + 0.02})`);
        g.addColorStop(1, `rgba(${rr},${gg},${bb},0)`);
        ctx.beginPath(); ctx.arc(eggX, eggY, lr, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();
      }

      // Body gradient
      const rC = 255, gC = Math.round(golden > 0 ? 200 + golden * 40 : 195), bC = Math.round(golden > 0 ? 100 - golden * 90 : 165);
      const body = ctx.createRadialGradient(eggX - r * 0.22, eggY - r * 0.28, r * 0.05, eggX, eggY, r);
      body.addColorStop(0, `rgba(${rC},${gC+22},${bC+20},0.97)`);
      body.addColorStop(0.45, `rgba(${rC},${gC},${bC},0.82)`);
      body.addColorStop(1, `rgba(${Math.round(rC*0.72)},${Math.round(gC*0.6)},${Math.max(0, bC-40)},0.38)`);
      ctx.beginPath(); ctx.arc(eggX, eggY, r, 0, Math.PI * 2);
      ctx.fillStyle = body; ctx.fill();

      // Rim
      ctx.beginPath(); ctx.arc(eggX, eggY, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,${gC + 20},${bC},0.55)`;
      ctx.lineWidth = 1.6; ctx.stroke();
    }

    function drawEmbryoSymbol(progress: number) {
      if (progress <= 0) return;
      ctx.save();
      ctx.globalAlpha = progress;

      // Six petals (like a flower of life)
      const pr = EGG_R * 0.45;
      ctx.strokeStyle = `rgba(255,240,160,0.65)`;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const px = eggX + Math.cos(a) * pr * 0.72;
        const py = eggY + Math.sin(a) * pr * 0.72;
        ctx.beginPath(); ctx.arc(px, py, pr * 0.72, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Center circle
      ctx.beginPath(); ctx.arc(eggX, eggY, pr * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      // Inner dot
      ctx.fillStyle = `rgba(255,235,150,0.9)`;
      ctx.beginPath(); ctx.arc(eggX, eggY, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    function updateObs() {
      obs.forEach(ob => {
        ob.x += ob.vx; ob.y += ob.vy;
        ob.ph += 0.007;
        // Bounce
        if (ob.x - ob.r < 0 || ob.x + ob.r > W) ob.vx *= -1;
        if (ob.y - ob.r < 0 || ob.y + ob.r > H) ob.vy *= -1;
        // Stay away from egg
        const dx = ob.x - eggX, dy = ob.y - eggY;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < EGG_R * 2.8) { ob.x += dx / d * 1.2; ob.y += dy / d * 1.2; }
      });
    }

    function drawObs() {
      obs.forEach(ob => {
        const pulse = 1 + Math.sin(ob.ph) * 0.12;
        const r     = ob.r * pulse;
        const g     = ctx.createRadialGradient(ob.x, ob.y, r * 0.15, ob.x, ob.y, r);
        g.addColorStop(0, "rgba(6,1,3,0.80)");
        g.addColorStop(0.55, "rgba(10,2,5,0.55)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath(); ctx.arc(ob.x, ob.y, r, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();
        // Faint border
        ctx.beginPath(); ctx.arc(ob.x, ob.y, r * 0.7, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(90,20,40,0.18)";
        ctx.lineWidth = 1; ctx.stroke();
      });
    }

    // ── Particle physics ──────────────────────────────────────────────────────
    function updateParticles() {
      eggX = W / 2; eggY = H / 2;

      ps.forEach(p => {
        if (p.fade <= 0) return;

        // Wander
        p.wa += (Math.random() - 0.5) * WANDER;
        const wox = Math.cos(p.wa) * 32;
        const woy = Math.sin(p.wa) * 32;

        // Attract toward cursor + wander
        const tx = mx + wox, ty = my + woy;
        const dx = tx - p.x, dy = ty - p.y;
        const d  = Math.sqrt(dx * dx + dy * dy) + 0.5;
        p.vx += (dx / d) * ATTRACT;
        p.vy += (dy / d) * ATTRACT;

        // Avoid obstacles
        obs.forEach(ob => {
          const ox = p.x - ob.x, oy = p.y - ob.y;
          const od = Math.sqrt(ox * ox + oy * oy) + 0.5;
          const minD = ob.r * 1.15;
          if (od < minD) {
            const f = ((minD - od) / minD) * 3.2;
            p.vx += (ox / od) * f;
            p.vy += (oy / od) * f;
          }
        });

        // Dampen + clamp speed
        p.vx *= DAMP; p.vy *= DAMP;
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (spd > MAX_SPD) { p.vx = p.vx / spd * MAX_SPD; p.vy = p.vy / spd * MAX_SPD; }

        p.x += p.vx; p.y += p.vy;
        // Keep in bounds
        p.x = clamp(p.x, 0, W); p.y = clamp(p.y, 0, H);
      });
    }

    // Draw all particles in 5 speed-bucketed batches (fast)
    function drawParticles() {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      // Speed bucket → alpha + size
      const BUCKETS = 5;
      type Bucket = { pts: P[]; alpha: number; sz: number };
      const buckets: Bucket[] = Array.from({ length: BUCKETS }, (_, i) => ({
        pts: [], alpha: 0.14 + i * 0.10, sz: 1.1 + i * 0.25,
      }));

      ps.forEach(p => {
        if (p.fade <= 0) return;
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const bi  = Math.min(Math.floor(spd / (MAX_SPD / BUCKETS)), BUCKETS - 1);
        buckets[bi].pts.push(p);
      });

      buckets.forEach(({ pts, alpha, sz }) => {
        if (!pts.length) return;

        // Glow halo pass (softer, bigger)
        ctx.fillStyle = `rgba(255,220,140,${alpha * 0.4})`;
        ctx.beginPath();
        pts.forEach(p => {
          const fade = p.fade;
          if (fade <= 0) return;
          ctx.moveTo(p.x + sz * 2.5 * fade, p.y);
          ctx.arc(p.x, p.y, sz * 2.5 * fade, 0, Math.PI * 2);
        });
        ctx.fill();

        // Core pass
        ctx.fillStyle = `rgba(255,235,180,${Math.min(alpha * 1.8, 0.9)})`;
        ctx.beginPath();
        pts.forEach(p => {
          const fade = p.fade;
          if (fade <= 0) return;
          const r = sz * fade;
          ctx.moveTo(p.x + r, p.y);
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        });
        ctx.fill();

        // Tail streaks (direction of motion)
        ctx.strokeStyle = `rgba(255,220,140,${alpha * 0.55})`;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        pts.forEach(p => {
          if (p.fade <= 0) return;
          const spd2 = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          if (spd2 < 0.5) return;
          const tailLen = Math.min(spd2 * 2.2, 14);
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - (p.vx / spd2) * tailLen, p.y - (p.vy / spd2) * tailLen);
        });
        ctx.stroke();
      });

      ctx.restore();
    }

    // ── Climax & complete sequences ───────────────────────────────────────────
    function runClimax(dt: number): boolean {
      climaxT += dt;
      const ph1 = Math.min(climaxT / 1.8, 1);   // fade others
      const ph2 = Math.max(0, Math.min((climaxT - 1.6) / 1.4, 1)); // flash

      // Move winner toward egg center
      if (winnerIdx >= 0) {
        const p = ps[winnerIdx];
        p.x += (eggX - p.x) * 0.06;
        p.y += (eggY - p.y) * 0.06;
      }

      // Fade non-winners
      ps.forEach((p, i) => {
        if (i !== winnerIdx) p.fade = Math.max(0, 1 - ph1 * 1.35);
      });

      // Golden flash
      if (ph2 > 0) {
        const fl = Math.sin(ph2 * Math.PI);
        ctx.fillStyle = `rgba(255,215,100,${fl * 0.42})`;
        ctx.fillRect(0, 0, W, H);
      }

      return climaxT >= 3.0;
    }

    function runComplete(dt: number) {
      completeT += dt;
      const goldT   = Math.min(completeT / 2.0, 1);
      const symbolT = Math.max(0, Math.min((completeT - 0.6) / 1.6, 1));
      const textT   = Math.max(0, Math.min((completeT - 1.8) / 1.4, 1));
      const hintT   = Math.max(0, Math.min((completeT - 5.0) / 1.5, 0.55));

      drawEgg(completeT * 1000, goldT);
      drawEmbryoSymbol(symbolT);

      if (textT > 0) {
        ctx.save();
        ctx.globalAlpha = textT;
        ctx.textAlign   = "center";
        ctx.font        = "bold 21px Georgia, 'Times New Roman', serif";
        ctx.fillStyle   = "rgba(255,235,150,0.95)";
        ctx.shadowColor = "rgba(255,200,80,0.9)";
        ctx.shadowBlur  = 28;
        ctx.fillText("Чудо жизни начинается с тебя", W / 2, H * 0.74);
        ctx.restore();
      }

      if (hintT > 0) {
        ctx.save();
        ctx.globalAlpha = hintT;
        ctx.textAlign   = "center";
        ctx.font        = "13px -apple-system, sans-serif";
        ctx.fillStyle   = "rgba(255,200,120,0.7)";
        ctx.fillText("Нажмите, чтобы начать снова", W / 2, H * 0.74 + 36);
        ctx.restore();
      }
    }

    // ── Check trigger ─────────────────────────────────────────────────────────
    function checkTrigger() {
      if (!mMoved) return;
      let best = -1, bestD = Infinity, near = 0;
      ps.forEach((p, i) => {
        const dx = p.x - eggX, dy = p.y - eggY;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < EGG_R * 1.25) {
          near++;
          if (d < bestD) { bestD = d; best = i; }
        }
      });
      if (near >= 70 && best >= 0) {
        phase = "climaxing";
        winnerIdx = best;
        climaxT = 0;
      }
    }

    // ── Floating hint for new players ─────────────────────────────────────────
    function drawHint(t: number) {
      if (mMoved) return;
      const alpha = 0.4 + Math.sin(t * 0.002) * 0.18;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign   = "center";
      ctx.font        = "14px -apple-system, sans-serif";
      ctx.fillStyle   = "rgba(255,220,160,0.85)";
      ctx.fillText("Ведите рой к центру", W / 2, H * 0.88);
      ctx.restore();
    }

    // ── Main RAF loop ─────────────────────────────────────────────────────────
    let lastT = 0, rafId = 0;

    function loop(ts: number) {
      const dt = Math.min((ts - lastT) / 1000, 0.06);
      lastT = ts;
      frame++;

      // Re-centre egg after first resize
      eggX = W / 2; eggY = H / 2;

      // Partial erase → creates particle trails
      ctx.fillStyle = "rgba(4,1,0,0.22)";
      ctx.fillRect(0, 0, W, H);

      // Animated warm background blobs
      const blobs = [
        { ax: 0.28, ay: 0.32, cr: 0.38, r: "rgba(38,8,4,", s: 0.00016, sp: 0.00014, p: 0 },
        { ax: 0.72, ay: 0.68, cr: 0.32, r: "rgba(28,4,14,", s: 0.00013, sp: 0.00011, p: 2 },
      ];
      blobs.forEach(b => {
        const ox = Math.sin(ts * b.s + b.p) * 42;
        const oy = Math.cos(ts * b.sp + b.p) * 32;
        const bx = W * b.ax + ox, by = H * b.ay + oy, br = W * b.cr;
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        g.addColorStop(0, b.r + "0.55)");
        g.addColorStop(1, b.r + "0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      });

      if (phase === "swarming") {
        updateObs();
        drawObs();
        drawEgg(ts);
        updateParticles();
        drawParticles();
        checkTrigger();
        drawHint(ts);
      } else if (phase === "climaxing") {
        updateObs();
        drawObs();
        drawEgg(ts);
        drawParticles();
        const done = runClimax(dt);
        if (done) { phase = "complete"; completeT = 0; }
      } else {
        // Complete: clean dark bg each frame
        ctx.fillStyle = "rgba(4,1,0,0.4)";
        ctx.fillRect(0, 0, W, H);
        runComplete(dt);
      }

      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      canvas.removeEventListener("mousemove", setMouse);
      canvas.removeEventListener("touchmove", setMouse as EventListener);
      canvas.removeEventListener("touchstart", setMouse as EventListener);
      canvas.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }}
    />
  );
}
