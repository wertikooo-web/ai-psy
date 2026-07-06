"use client";

import { useEffect, useRef, useState } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────
const N         = 900;
const EGG_R     = 70;
const ATTRACT   = 0.10;
const DAMP      = 0.90;
const WANDER    = 0.30;
const MAX_SPD   = 3.5;
const TRIGGER_N = 120;  // particles near egg → climax

// 8 orbital obstacles in 3 concentric rings
const OBS_RINGS = [
  { rk: 158, sz: 30, spd: 0.00080, ph: 0.0 },
  { rk: 158, sz: 33, spd: -0.00070, ph: 2.1 },
  { rk: 158, sz: 27, spd: 0.00090, ph: 4.2 },
  { rk: 252, sz: 42, spd: -0.00050, ph: 0.8 },
  { rk: 252, sz: 46, spd: 0.00040, ph: 3.2 },
  { rk: 252, sz: 40, spd: -0.00055, ph: 5.5 },
  { rk: 332, sz: 55, spd: 0.00028, ph: 1.6 },
  { rk: 332, sz: 58, spd: -0.00020, ph: 4.7 },
];

type Phase = "swarming" | "climaxing" | "complete";

interface P { x: number; y: number; vx: number; vy: number; wa: number; fade: number }

// ── Narrative milestones ──────────────────────────────────────────────────────
const MILESTONES = [
  { ratio: 0.28, text: "Они чувствуют цель..." },
  { ratio: 0.55, text: "Продолжайте..." },
  { ratio: 0.80, text: "Ещё немного!" },
  { ratio: 0.94, text: "Вот он..." },
];

// ── Component ─────────────────────────────────────────────────────────────────
interface Props { onBack?: () => void }

export function TheWayGame({ onBack }: Props) {
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const [showIntro, setShowIntro] = useState(true);
  const activeRef     = useRef(false);

  function handleStart() {
    activeRef.current = true;
    setShowIntro(false);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    let W = 0, H = 0;
    function resize() { W = canvas!.width = canvas!.offsetWidth; H = canvas!.height = canvas!.offsetHeight; }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // ── Game state ────────────────────────────────────────────────────────────
    let phase: Phase   = "swarming";
    let mx = -9999, my = -9999;
    let mMoved         = false;
    let eggX = 0, eggY = 0;
    let climaxT        = 0;
    let completeT      = 0;
    let winnerIdx      = -1;
    let elapsedS       = 0;      // total play time
    let nearCount      = 0;      // particles within trigger zone
    let milestoneIdx   = 0;
    let msText         = "";
    let msT            = 0;      // countdown to hide milestone text
    let idleT          = 0;      // time since last mouse movement
    let hintAlpha      = 0;      // guide hint

    const ps: P[] = [];

    function init() {
      phase = "swarming"; climaxT = 0; completeT = 0; winnerIdx = -1;
      elapsedS = 0; nearCount = 0; milestoneIdx = 0; msText = ""; msT = 0;
      idleT = 0; hintAlpha = 0; mMoved = false;
      ps.length = 0;
      eggX = W / 2; eggY = H / 2;
      mx = W * 0.12; my = H * 0.5;
      for (let i = 0; i < N; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = 200 + Math.random() * 320;
        ps.push({ x: eggX + Math.cos(a)*d, y: eggY + Math.sin(a)*d,
                  vx: (Math.random()-0.5)*1.5, vy: (Math.random()-0.5)*1.5,
                  wa: Math.random()*Math.PI*2, fade: 1 });
      }
    }

    // ── Input ─────────────────────────────────────────────────────────────────
    function setMouse(e: MouseEvent | TouchEvent) {
      if (!activeRef.current) return;
      const rect = canvas!.getBoundingClientRect();
      if ("touches" in e) {
        const t = (e as TouchEvent).touches[0] ?? (e as TouchEvent).changedTouches[0];
        mx = t.clientX - rect.left; my = t.clientY - rect.top;
      } else { mx = (e as MouseEvent).clientX - rect.left; my = (e as MouseEvent).clientY - rect.top; }
      mMoved = true; idleT = 0;
    }
    function onClick() {
      if (!activeRef.current) return;
      if (phase === "complete" && completeT > 5) init();
    }
    canvas.addEventListener("mousemove", setMouse);
    canvas.addEventListener("touchmove",  setMouse as EventListener, { passive: true });
    canvas.addEventListener("touchstart", setMouse as EventListener, { passive: true });
    canvas.addEventListener("click", onClick);

    // ── Orbital obstacles ─────────────────────────────────────────────────────
    const obsT = new Float64Array(OBS_RINGS.length).map((_, i) => OBS_RINGS[i].ph); // mutable phases

    function getObs(i: number, t: number) {
      const o = OBS_RINGS[i];
      const ph = o.ph + t * o.spd * 1000;
      return { x: eggX + Math.cos(ph) * o.rk, y: eggY + Math.sin(ph) * o.rk, r: o.sz };
    }

    // ── Physics ───────────────────────────────────────────────────────────────
    function updateParticles(t: number) {
      eggX = W / 2; eggY = H / 2;
      ps.forEach(p => {
        if (p.fade <= 0) return;
        // Wander
        p.wa += (Math.random()-0.5) * WANDER;
        const wox = Math.cos(p.wa) * 28, woy = Math.sin(p.wa) * 28;
        // Attraction to cursor
        const tx = mx + wox, ty = my + woy;
        const dx = tx - p.x, dy = ty - p.y;
        const d  = Math.sqrt(dx*dx+dy*dy) + 0.5;
        p.vx += (dx/d) * ATTRACT;
        p.vy += (dy/d) * ATTRACT;
        // Orbital obstacles repulsion
        for (let i = 0; i < OBS_RINGS.length; i++) {
          const o = getObs(i, t);
          const ox = p.x - o.x, oy = p.y - o.y;
          const od = Math.sqrt(ox*ox+oy*oy) + 0.5;
          const minD = o.r * 1.2;
          if (od < minD) { const f = ((minD-od)/minD) * 3.8; p.vx += (ox/od)*f; p.vy += (oy/od)*f; }
        }
        // Damp + clamp
        p.vx *= DAMP; p.vy *= DAMP;
        const spd = Math.sqrt(p.vx*p.vx+p.vy*p.vy);
        if (spd > MAX_SPD) { p.vx = p.vx/spd*MAX_SPD; p.vy = p.vy/spd*MAX_SPD; }
        p.x += p.vx; p.y += p.vy;
        p.x = Math.max(0, Math.min(W, p.x)); p.y = Math.max(0, Math.min(H, p.y));
      });
    }

    function checkTrigger() {
      if (!mMoved) return;
      let best = -1, bestD = Infinity, near = 0;
      ps.forEach((p, i) => {
        const dx = p.x-eggX, dy = p.y-eggY, d = Math.sqrt(dx*dx+dy*dy);
        if (d < EGG_R*1.5) { near++; if (d < bestD) { bestD = d; best = i; } }
      });
      nearCount = near;
      if (near >= TRIGGER_N && best >= 0) { phase = "climaxing"; winnerIdx = best; climaxT = 0; }
    }

    function checkMilestones() {
      if (milestoneIdx >= MILESTONES.length) return;
      const ratio = nearCount / TRIGGER_N;
      const m = MILESTONES[milestoneIdx];
      if (ratio >= m.ratio) { msText = m.text; msT = 3.5; milestoneIdx++; }
    }

    // ── Drawing ───────────────────────────────────────────────────────────────
    function drawEgg(golden = 0) {
      const pulse = 1 + Math.sin(elapsedS * 1.4) * 0.06;
      const r = EGG_R * pulse * (1 + golden * 0.28);
      // Halo layers
      for (let l = 0; l < 4; l++) {
        const lr = r * (2.6 - l*0.42);
        const alp = (0.052 - l*0.009) * (1 + golden*0.7);
        const rr = 255, gg = Math.round(golden>0 ? 195+golden*35 : 180), bb = Math.round(golden>0 ? 75-golden*65 : 140);
        const g = ctx.createRadialGradient(eggX, eggY, r*.3, eggX, eggY, lr);
        g.addColorStop(0, `rgba(${rr},${gg},${bb},${alp+0.02})`);
        g.addColorStop(1, `rgba(${rr},${gg},${bb},0)`);
        ctx.beginPath(); ctx.arc(eggX, eggY, lr, 0, Math.PI*2); ctx.fillStyle=g; ctx.fill();
      }
      // Body
      const rC=255, gC=Math.round(golden>0?198+golden*42:192), bC=Math.round(golden>0?95-golden*85:162);
      const body = ctx.createRadialGradient(eggX-r*.22, eggY-r*.28, r*.05, eggX, eggY, r);
      body.addColorStop(0, `rgba(${rC},${gC+24},${bC+20},0.97)`);
      body.addColorStop(.45, `rgba(${rC},${gC},${bC},0.82)`);
      body.addColorStop(1, `rgba(${Math.round(rC*.72)},${Math.round(gC*.6)},${Math.max(0,bC-40)},0.36)`);
      ctx.beginPath(); ctx.arc(eggX, eggY, r, 0, Math.PI*2); ctx.fillStyle=body; ctx.fill();
      ctx.beginPath(); ctx.arc(eggX, eggY, r, 0, Math.PI*2);
      ctx.strokeStyle=`rgba(255,${gC+18},${bC},0.52)`; ctx.lineWidth=1.5; ctx.stroke();
    }

    function drawProgressArc() {
      const ratio = Math.min(nearCount / TRIGGER_N, 1);
      if (ratio <= 0) return;
      const start = -Math.PI/2;
      const end = start + ratio * Math.PI*2;
      const rr = 255, gg = Math.floor(155+ratio*75), bb = Math.floor(90-ratio*70);
      const alp = 0.38 + ratio*0.52;
      ctx.save();
      ctx.strokeStyle = `rgba(${rr},${gg},${bb},${alp})`;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = `rgba(${rr},${gg},${bb},0.6)`;
      ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(eggX, eggY, EGG_R+12, start, end); ctx.stroke();
      ctx.restore();
      // Count label
      if (nearCount > 5) {
        ctx.save();
        ctx.globalAlpha = 0.5 + ratio*0.4;
        ctx.font = "11px -apple-system, monospace";
        ctx.fillStyle = `rgba(255,${gg},${Math.max(bb,50)},0.85)`;
        ctx.textAlign = "center";
        ctx.fillText(`${nearCount} / ${TRIGGER_N}`, eggX, eggY + EGG_R + 30);
        ctx.restore();
      }
    }

    function drawObs(t: number) {
      for (let i = 0; i < OBS_RINGS.length; i++) {
        const o = getObs(i, t);
        const pulse = 1 + Math.sin(t * 0.8 + i*0.7) * 0.10;
        const r = o.r * pulse;
        const g = ctx.createRadialGradient(o.x, o.y, r*.1, o.x, o.y, r);
        g.addColorStop(0, "rgba(5,1,2,0.85)"); g.addColorStop(.5,"rgba(10,2,5,0.55)"); g.addColorStop(1,"rgba(0,0,0,0)");
        ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI*2); ctx.fillStyle=g; ctx.fill();
        // Membrane ring
        ctx.beginPath(); ctx.arc(o.x, o.y, r*.65, 0, Math.PI*2);
        ctx.strokeStyle="rgba(80,15,35,0.22)"; ctx.lineWidth=1; ctx.stroke();
      }
    }

    function drawParticles() {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const BUCKETS = 5;
      type Bkt = { pts: P[]; a: number; sz: number };
      const bkts: Bkt[] = Array.from({length:BUCKETS},(_,i)=>({pts:[],a:0.12+i*.09,sz:1.0+i*.22}));
      ps.forEach(p => {
        if (p.fade <= 0) return;
        const spd = Math.sqrt(p.vx*p.vx+p.vy*p.vy);
        const bi = Math.min(Math.floor(spd/(MAX_SPD/BUCKETS)),BUCKETS-1);
        bkts[bi].pts.push(p);
      });
      bkts.forEach(({pts,a,sz}) => {
        if (!pts.length) return;
        // Glow
        ctx.fillStyle = `rgba(255,215,135,${a*.38})`;
        ctx.beginPath();
        pts.forEach(p => { ctx.moveTo(p.x+sz*2.4,p.y); ctx.arc(p.x,p.y,sz*2.4,0,Math.PI*2); });
        ctx.fill();
        // Core head
        ctx.fillStyle = `rgba(255,232,175,${Math.min(a*1.9,0.92)})`;
        ctx.beginPath();
        pts.forEach(p => { const r=sz*p.fade; ctx.moveTo(p.x+r,p.y); ctx.arc(p.x,p.y,r,0,Math.PI*2); });
        ctx.fill();
        // Velocity tail
        ctx.strokeStyle = `rgba(255,210,130,${a*.52})`;
        ctx.lineWidth = 0.65;
        ctx.beginPath();
        pts.forEach(p => {
          if (p.fade<=0) return;
          const spd2=Math.sqrt(p.vx*p.vx+p.vy*p.vy); if(spd2<0.4) return;
          const tl = Math.min(spd2*2.8, 16);
          ctx.moveTo(p.x,p.y); ctx.lineTo(p.x-(p.vx/spd2)*tl, p.y-(p.vy/spd2)*tl);
        });
        ctx.stroke();
      });
      ctx.restore();
    }

    function drawMilestoneText(dt: number) {
      if (msT <= 0 || !msText) return;
      msT -= dt;
      const alpha = Math.min(msT, 1) * Math.min((3.5-msT)/0.4, 1);
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha) * 0.88;
      ctx.textAlign = "center";
      ctx.font = "italic 18px Georgia, serif";
      ctx.fillStyle = "rgba(255,220,140,0.95)";
      ctx.shadowColor = "rgba(255,180,60,0.7)"; ctx.shadowBlur = 14;
      ctx.fillText(msText, W/2, H*0.82);
      ctx.restore();
    }

    function drawHint(dt: number) {
      if (!activeRef.current || phase !== "swarming") return;
      if (mMoved && nearCount > 5) { hintAlpha = Math.max(0, hintAlpha-dt*0.5); }
      else { idleT += dt; hintAlpha = Math.min(1, hintAlpha + (idleT>4 ? dt*0.6 : -dt*0.5)); }
      if (hintAlpha < 0.02) return;
      ctx.save();
      ctx.globalAlpha = hintAlpha * 0.55;
      ctx.textAlign = "center";
      ctx.font = "14px -apple-system, sans-serif";
      ctx.fillStyle = "rgba(255,215,150,0.88)";
      ctx.fillText(!mMoved ? "Двигайте мышью — ведите рой к центру" : "Ведите их через барьеры к яйцеклетке", W/2, H*0.91);
      ctx.restore();
    }

    function drawTimer() {
      if (!activeRef.current || phase !== "swarming") return;
      const m = Math.floor(elapsedS/60), s = Math.floor(elapsedS%60);
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.font = "11px -apple-system, monospace";
      ctx.fillStyle = "rgba(255,200,120,0.8)";
      ctx.textAlign = "left";
      ctx.fillText(`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`, 16, H-16);
      ctx.restore();
    }

    function drawFlowerSymbol(progress: number) {
      if (progress <= 0) return;
      ctx.save(); ctx.globalAlpha = progress;
      const pr = EGG_R * 0.46;
      ctx.strokeStyle = "rgba(255,240,155,0.65)"; ctx.lineWidth = 1.2;
      for (let i = 0; i < 6; i++) {
        const a = (i/6)*Math.PI*2;
        const px = eggX + Math.cos(a)*pr*.72, py = eggY + Math.sin(a)*pr*.72;
        ctx.beginPath(); ctx.arc(px, py, pr*.72, 0, Math.PI*2); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(eggX, eggY, pr*.72, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = "rgba(255,232,145,0.92)";
      ctx.beginPath(); ctx.arc(eggX, eggY, 5, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    function runClimax(dt: number): boolean {
      climaxT += dt;
      const ph1 = Math.min(climaxT/1.8, 1);
      const ph2 = Math.max(0, Math.min((climaxT-1.5)/1.6, 1));
      if (winnerIdx >= 0) {
        const p = ps[winnerIdx];
        p.x += (eggX-p.x)*0.07; p.y += (eggY-p.y)*0.07;
      }
      ps.forEach((p,i) => { if (i !== winnerIdx) p.fade = Math.max(0, 1-ph1*1.4); });
      if (ph2 > 0) {
        const fl = Math.sin(ph2*Math.PI);
        ctx.fillStyle = `rgba(255,210,90,${fl*0.38})`; ctx.fillRect(0,0,W,H);
      }
      return climaxT >= 3.2;
    }

    function runComplete(dt: number) {
      completeT += dt;
      const goldT   = Math.min(completeT/1.8, 1);
      const symbolT = Math.max(0, Math.min((completeT-0.6)/1.8, 1));
      const textT   = Math.max(0, Math.min((completeT-1.6)/1.4, 1));
      const hintT   = Math.max(0, Math.min((completeT-6.0)/1.5, 0.55));
      const timeT   = Math.max(0, Math.min((completeT-3.0)/1.2, 1));
      drawEgg(goldT);
      drawFlowerSymbol(symbolT);
      if (textT > 0) {
        ctx.save(); ctx.globalAlpha = textT;
        ctx.textAlign = "center";
        ctx.font = "bold 22px Georgia, 'Times New Roman', serif";
        ctx.fillStyle = "rgba(255,232,145,0.96)";
        ctx.shadowColor = "rgba(255,190,70,0.95)"; ctx.shadowBlur = 30;
        ctx.fillText("Чудо жизни начинается с тебя", W/2, H*0.72);
        ctx.restore();
      }
      if (timeT > 0) {
        const m2=Math.floor(elapsedS/60), s2=Math.floor(elapsedS%60);
        ctx.save(); ctx.globalAlpha = timeT * 0.5;
        ctx.textAlign = "center";
        ctx.font = "13px -apple-system, sans-serif";
        ctx.fillStyle = "rgba(255,210,130,0.75)";
        ctx.fillText(`Ваш путь: ${String(m2).padStart(2,"0")}:${String(s2).padStart(2,"0")}`, W/2, H*0.72+34);
        ctx.restore();
      }
      if (hintT > 0) {
        ctx.save(); ctx.globalAlpha = hintT;
        ctx.textAlign = "center";
        ctx.font = "12px -apple-system, sans-serif";
        ctx.fillStyle = "rgba(255,190,110,0.65)";
        ctx.fillText("Нажмите, чтобы начать снова", W/2, H*0.72+62);
        ctx.restore();
      }
    }

    // ── Main loop ─────────────────────────────────────────────────────────────
    let lastT = 0, rafId = 0;

    function loop(ts: number) {
      const dt = Math.min((ts-lastT)/1000, 0.06);
      lastT = ts;

      eggX = W/2; eggY = H/2;

      if (activeRef.current && phase === "swarming") elapsedS += dt;

      // Partial erase → trails
      ctx.fillStyle = "rgba(4,1,0,0.21)"; ctx.fillRect(0,0,W,H);

      // Warm bg blobs
      const blobDef = [
        {ax:0.30,ay:0.35,cr:0.38,r:"rgba(36,7,4,"},
        {ax:0.70,ay:0.65,cr:0.33,r:"rgba(26,4,14,"},
      ];
      blobDef.forEach(b => {
        const ox=Math.sin(ts*.00015+b.ax*2)*40, oy=Math.cos(ts*.00012+b.ay*2)*30;
        const bx=W*b.ax+ox, by=H*b.ay+oy, br=Math.max(W,H)*b.cr;
        const g=ctx.createRadialGradient(bx,by,0,bx,by,br);
        g.addColorStop(0,b.r+"0.52)"); g.addColorStop(1,b.r+"0)");
        ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
      });

      if (!activeRef.current) {
        // Ambient: draw egg + slow particles drift without physics
        drawEgg(0);
        drawParticles();
      } else if (phase === "swarming") {
        drawObs(ts/1000);
        drawEgg(0);
        drawProgressArc();
        updateParticles(ts/1000);
        drawParticles();
        checkTrigger();
        checkMilestones();
        drawMilestoneText(dt);
        drawHint(dt);
        drawTimer();
      } else if (phase === "climaxing") {
        drawObs(ts/1000);
        drawEgg(0);
        drawParticles();
        const done = runClimax(dt);
        if (done) { phase = "complete"; completeT = 0; }
      } else {
        ctx.fillStyle="rgba(4,1,0,0.38)"; ctx.fillRect(0,0,W,H);
        runComplete(dt);
      }

      rafId = requestAnimationFrame(loop);
    }

    init();
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId); ro.disconnect();
      canvas.removeEventListener("mousemove", setMouse);
      canvas.removeEventListener("touchmove",  setMouse as EventListener);
      canvas.removeEventListener("touchstart", setMouse as EventListener);
      canvas.removeEventListener("click", onClick);
    };
  }, []);

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#040100" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }}
      />

      {/* Back button — floating, low-profile */}
      {!showIntro && onBack && (
        <button
          onClick={onBack}
          title="Назад"
          style={{
            position: "absolute", top: 12, left: 12,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8, color: "rgba(255,200,130,0.5)",
            fontSize: 16, width: 32, height: 32, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s", fontFamily: "sans-serif",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.1)"; (e.currentTarget as HTMLElement).style.color="rgba(255,200,130,0.9)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.05)"; (e.currentTarget as HTMLElement).style.color="rgba(255,200,130,0.5)"; }}
        >
          ←
        </button>
      )}

      {/* Intro overlay */}
      {showIntro && (
        <div
          onClick={handleStart}
          style={{
            position: "absolute", inset: 0,
            background: "rgba(4,1,0,0.88)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            cursor: "pointer", userSelect: "none",
            gap: 0,
          }}
        >
          {/* Title */}
          <div style={{
            fontSize: 44, fontWeight: 700, letterSpacing: "0.04em",
            fontFamily: "Georgia, 'Times New Roman', serif",
            color: "rgba(255,232,155,0.96)",
            textShadow: "0 0 40px rgba(255,190,70,0.7), 0 0 80px rgba(255,140,40,0.3)",
            marginBottom: 12,
          }}>The Way</div>

          {/* Tagline */}
          <div style={{
            fontSize: 15, color: "rgba(255,200,130,0.65)",
            fontFamily: "Georgia, serif", fontStyle: "italic",
            marginBottom: 44, letterSpacing: "0.03em",
          }}>Один из миллиона найдёт путь</div>

          {/* Instructions card */}
          <div style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,200,130,0.12)",
            borderRadius: 16, padding: "22px 32px",
            display: "flex", flexDirection: "column", gap: 14,
            marginBottom: 44, maxWidth: 340,
          }}>
            {[
              { icon: "↔", text: "Двигайте мышью или пальцем — рой следует за вами" },
              { icon: "◉", text: "Доведите частицы к яйцеклетке в центре экрана" },
              { icon: "◈", text: "Обходите тёмные барьеры — они отталкивают рой" },
              { icon: "✦", text: "Нужно собрать 120 частиц в зоне яйцеклетки" },
            ].map(({ icon, text }) => (
              <div key={icon} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <span style={{ fontSize: 18, color: "rgba(255,210,120,0.7)", flexShrink: 0, lineHeight: "22px" }}>{icon}</span>
                <span style={{ fontSize: 13, color: "rgba(255,200,140,0.7)", lineHeight: "1.5", fontFamily: "-apple-system, sans-serif" }}>{text}</span>
              </div>
            ))}
          </div>

          {/* Start button */}
          <div style={{
            padding: "12px 48px",
            background: "rgba(255,200,100,0.12)",
            border: "1px solid rgba(255,200,100,0.30)",
            borderRadius: 50,
            color: "rgba(255,220,140,0.95)",
            fontSize: 15, fontWeight: 600,
            letterSpacing: "0.08em", textTransform: "uppercase" as const,
            fontFamily: "-apple-system, sans-serif",
            boxShadow: "0 0 28px rgba(255,180,60,0.12)",
            animation: "theway-pulse 2.5s ease-in-out infinite",
          }}>
            Начать
          </div>

          <div style={{
            marginTop: 16,
            fontSize: 11, color: "rgba(255,190,110,0.3)",
            fontFamily: "-apple-system, sans-serif",
            letterSpacing: "0.06em",
          }}>нажмите в любое место</div>

          <style>{`
            @keyframes theway-pulse {
              0%, 100% { box-shadow: 0 0 28px rgba(255,180,60,0.12); }
              50% { box-shadow: 0 0 42px rgba(255,180,60,0.28); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
