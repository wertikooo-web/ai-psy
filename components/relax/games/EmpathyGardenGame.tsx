"use client";

import { useEffect, useRef } from "react";

function rnd(lo: number, hi: number) { return lo + Math.random() * (hi - lo); }

// ─── Types ────────────────────────────────────────────────────────────────────
interface Seg { x1: number; y1: number; x2: number; y2: number; depth: number; }

interface Seed {
  id: number; x: number; y: number; vx: number; vy: number;
  r: number; rot: number; rotV: number;
  hue: number;
  spikes: number[];
  attracted: boolean;
  flashT: number;
  dead: boolean;
}

interface Flower {
  seg: Seg; travelT: number; travelDur: number; bloomT: number;
  x: number; y: number; targetR: number;
  traveling: boolean; hue: number; petals: number;
  soundPlayed: boolean;
}

interface Pulse {
  x1: number; y1: number; x2: number; y2: number;
  t: number; dur: number; hue: number;
  soundStarted: boolean;
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

const SEED_HUES = [280, 200, 340, 45, 170, 300, 220, 30];

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

    // Cursor
    let curX = W / 2, curY = H / 2;
    let cursorActive = false;

    // Gravity wave state (from click)
    let gravX = 0, gravY = 0, gravTimer = 0;

    // Trail ring buffer
    const TRAIL_LEN = 40;
    const trailX = new Float32Array(TRAIL_LEN);
    const trailY = new Float32Array(TRAIL_LEN);
    let trailHead = 0, trailFilled = 0;

    let seeds: Seed[]     = [];
    let flowers: Flower[] = [];
    let pulses: Pulse[]   = [];
    let seedIdCtr = 0;
    let rafId = 0, lastT = 0;
    let spawnTimer = 2.5;
    let showHint = true;

    // ── Web Audio ─────────────────────────────────────────────────────────────
    let ac: AudioContext | null = null;
    let masterGain: GainNode | null = null;
    let verbNode: ConvolverNode | null = null;

    function bootAudio() {
      if (ac) return;
      ac = new AudioContext();
      masterGain = ac.createGain();
      masterGain.gain.value = 0.5;

      // Simple reverb impulse
      const sr = ac.sampleRate, len = Math.floor(sr * 2.2);
      const buf = ac.createBuffer(2, len, sr);
      for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
      }
      verbNode = ac.createConvolver();
      verbNode.buffer = buf;
      const rg = ac.createGain(); rg.gain.value = 0.35;
      verbNode.connect(rg); rg.connect(ac.destination);
      masterGain.connect(ac.destination);
    }

    // Sound 1: Absorption — deep gong when seed hits root (110-130 Hz sine, 0.8s)
    function sndAbsorption() {
      if (!ac || !masterGain || !verbNode) return;
      if (ac.state === "suspended") void ac.resume();
      const t = ac.currentTime;
      const freq = 115 + Math.random() * 20;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(freq * 1.6, t);
      o.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.55, t + 0.018);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
      o.connect(g); g.connect(masterGain!); g.connect(verbNode!);
      o.start(t); o.stop(t + 0.9);

      // Overtone: add slight harmonic richness
      const o2 = ac.createOscillator();
      const g2 = ac.createGain();
      o2.type = "sine";
      o2.frequency.setValueAtTime(freq * 2.1, t);
      g2.gain.setValueAtTime(0, t);
      g2.gain.linearRampToValueAtTime(0.15, t + 0.015);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o2.connect(g2); g2.connect(masterGain!);
      o2.start(t); o2.stop(t + 0.55);
    }

    // Sound 2: Glissando — rising sweep along pulse travel (200→600 Hz)
    function sndGlissando(dur: number) {
      if (!ac || !masterGain || !verbNode) return;
      if (ac.state === "suspended") void ac.resume();
      const t = ac.currentTime;
      const o = ac.createOscillator();
      const g = ac.createGain();
      const bpf = ac.createBiquadFilter();
      bpf.type = "bandpass"; bpf.frequency.value = 800; bpf.Q.value = 0.7;
      o.type = "sine";
      o.frequency.setValueAtTime(200, t);
      o.frequency.linearRampToValueAtTime(600, t + dur * 0.82);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.05);
      g.gain.linearRampToValueAtTime(0.14, t + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(bpf); bpf.connect(g); g.connect(masterGain!); g.connect(verbNode!);
      o.start(t); o.stop(t + dur + 0.05);
    }

    // Sound 3: Zen chord — kalimba-style pentatonic bloom (C5 E5 G5 B5 + delay echo)
    function sndZenChord(hue: number) {
      if (!ac || !masterGain || !verbNode) return;
      if (ac.state === "suspended") void ac.resume();
      const t = ac.currentTime;

      // Pentatonic: C5=523.25, E5=659.25, G5=784, B5=987.77, D6=1174.66
      const PENTA = [523.25, 659.25, 784.00, 987.77, 1174.66];
      // Rotate based on hue for variety
      const offset = Math.floor(hue / 72) % 3;
      const freqs = [PENTA[offset], PENTA[offset + 1], PENTA[offset + 2], PENTA[(offset + 3) % 5]];

      // Delay for spatial echo
      const delay = ac.createDelay(0.6);
      delay.delayTime.value = 0.28;
      const dg = ac.createGain(); dg.gain.value = 0.38;
      delay.connect(dg); dg.connect(delay); dg.connect(masterGain!);

      freqs.forEach((freq, i) => {
        const o = ac!.createOscillator();
        const g = ac!.createGain();
        o.type = "sine";
        // Slight detuning for shimmer
        o.frequency.setValueAtTime(freq * (1 + (i % 2 === 0 ? 0.002 : -0.002)), t);
        const onset = t + i * 0.055;
        g.gain.setValueAtTime(0, onset);
        g.gain.linearRampToValueAtTime(0.28, onset + 0.025);
        g.gain.setValueAtTime(0.28, onset + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, onset + 2.8);
        o.connect(g);
        g.connect(masterGain!);
        g.connect(verbNode!);
        g.connect(delay);
        o.start(onset); o.stop(onset + 3.2);
      });
    }

    // ── Seed spawning ─────────────────────────────────────────────────────────
    function makeSeed(x: number, y: number): Seed {
      const n = 5 + Math.floor(Math.random() * 4);
      const spikes: number[] = [];
      for (let i = 0; i < n; i++) spikes.push(0.5 + Math.random() * 0.5);
      return {
        id: seedIdCtr++, x, y,
        vx: rnd(-25, 25), vy: rnd(-25, 25),
        r: rnd(8, 15), rot: Math.random() * Math.PI * 2, rotV: rnd(-0.9, 0.9),
        hue: SEED_HUES[Math.floor(Math.random() * SEED_HUES.length)],
        spikes, attracted: false, flashT: 0, dead: false,
      };
    }

    function spawnFromEdge() {
      const edge = Math.floor(Math.random() * 4);
      let x = 0, y = 0;
      if (edge === 0)      { x = rnd(0, W); y = -24; }
      else if (edge === 1) { x = W + 24;    y = rnd(0, H); }
      else if (edge === 2) { x = rnd(0, W); y = H + 24; }
      else                 { x = -24;       y = rnd(0, H); }
      seeds.push(makeSeed(x, y));
    }

    // Initial seeds scattered around the canvas
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2 + Math.random() * 0.5;
      const dst   = rnd(W * 0.18, Math.min(W, H) * 0.42);
      seeds.push(makeSeed(W / 2 + Math.cos(angle) * dst, H / 2 + Math.sin(angle) * dst));
    }

    // Pre-add decorative flowers
    const d1 = segs.filter(s => s.depth === 1);
    const d2 = segs.filter(s => s.depth === 2);
    [[d1[0], 200], [d1[1], 280], [d2[0], 45], [d2[3], 320]].forEach(([seg, hue]) => {
      if (!seg) return;
      const s = seg as Seg;
      flowers.push({
        seg: s, travelT: 1, travelDur: 1, bloomT: 1, x: s.x2, y: s.y2,
        targetR: 8 - s.depth, traveling: false, hue: hue as number,
        petals: 5 + Math.floor(Math.random() * 3), soundPlayed: true,
      });
    });

    // ── Pick flower branch ────────────────────────────────────────────────────
    function pickSeg(): Seg {
      const cands = segs.filter(s => s.depth >= 2 && s.depth <= 4);
      return cands[Math.floor(Math.random() * cands.length)] ?? segs[segs.length - 1];
    }

    // ── Transform seed → flower + pulse + new seeds ───────────────────────────
    function triggerTransform(seed: Seed) {
      seed.dead = true;
      seed.flashT = 0.9;
      showHint = false;

      bootAudio();
      sndAbsorption();

      const seg = pickSeg();
      const hue = SEED_HUES[Math.floor(Math.random() * SEED_HUES.length)];
      const dur = 1.0 + Math.random() * 0.5;

      // Glowing impulse from root to branch tip
      pulses.push({
        x1: rootX, y1: rootY, x2: seg.x2, y2: seg.y2,
        t: 0, dur, hue, soundStarted: false,
      });

      // Flower traveling along branch
      flowers.push({
        seg, travelT: 0, travelDur: 1.8 + Math.random() * 1.0, bloomT: 0,
        x: seg.x1, y: seg.y1, targetR: Math.max(3, 9 - seg.depth),
        traveling: true, hue, petals: 5 + Math.floor(Math.random() * 4),
        soundPlayed: false,
      });

      // Spawn 2-3 new seeds near the contact point
      const newCount = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < newCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dr    = rnd(70, 160);
        const nx    = Math.max(24, Math.min(W - 24, seed.x + Math.cos(angle) * dr));
        const ny    = Math.max(24, Math.min(H - 24, seed.y + Math.sin(angle) * dr));
        seeds.push(makeSeed(nx, ny));
      }
    }

    // ── Draw seed ─────────────────────────────────────────────────────────────
    function drawSeed(seed: Seed) {
      if (seed.flashT > 0) {
        const fa = Math.min(1, seed.flashT * 2.2);
        const rr = seed.r * (1 + (0.9 - seed.flashT) * 3);
        const g = ctx.createRadialGradient(seed.x, seed.y, 0, seed.x, seed.y, rr * 3);
        g.addColorStop(0, `rgba(255,255,255,${fa})`);
        g.addColorStop(0.35, `hsla(${seed.hue},95%,80%,${fa * 0.7})`);
        g.addColorStop(1, `rgba(255,255,255,0)`);
        ctx.beginPath(); ctx.arc(seed.x, seed.y, rr * 3, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();
        return;
      }

      ctx.save();
      ctx.translate(seed.x, seed.y);
      ctx.rotate(seed.rot);
      const n = seed.spikes.length;

      // Aura glow
      const auraR = seed.r * 2.8;
      const aura = ctx.createRadialGradient(0, 0, seed.r * 0.2, 0, 0, auraR);
      const auraAlpha = seed.attracted ? 0.55 : 0.28;
      aura.addColorStop(0, `hsla(${seed.hue},90%,68%,${auraAlpha})`);
      aura.addColorStop(1, `hsla(${seed.hue},90%,68%,0)`);
      ctx.beginPath(); ctx.arc(0, 0, auraR, 0, Math.PI * 2);
      ctx.fillStyle = aura; ctx.fill();

      // Spiky body
      ctx.beginPath();
      for (let i = 0; i < n * 2; i++) {
        const angle   = (i / (n * 2)) * Math.PI * 2;
        const isSpike = i % 2 === 0;
        const r = isSpike ? seed.r * seed.spikes[Math.floor(i / 2)] : seed.r * 0.32;
        i === 0 ? ctx.moveTo(Math.cos(angle)*r, Math.sin(angle)*r)
                : ctx.lineTo(Math.cos(angle)*r, Math.sin(angle)*r);
      }
      ctx.closePath();

      const bodyGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, seed.r);
      if (seed.attracted) {
        bodyGrad.addColorStop(0, `hsla(${seed.hue},100%,90%,0.96)`);
        bodyGrad.addColorStop(0.5, `hsla(${seed.hue},90%,68%,0.88)`);
        bodyGrad.addColorStop(1,   `hsla(${seed.hue},80%,44%,0.6)`);
      } else {
        bodyGrad.addColorStop(0, `hsla(${seed.hue},80%,76%,0.85)`);
        bodyGrad.addColorStop(0.5, `hsla(${seed.hue},70%,55%,0.75)`);
        bodyGrad.addColorStop(1,   `hsla(${seed.hue},60%,34%,0.52)`);
      }

      ctx.shadowColor = `hsla(${seed.hue},95%,70%,1)`;
      ctx.shadowBlur  = seed.attracted ? 20 : 10;
      ctx.fillStyle   = bodyGrad;
      ctx.fill();
      ctx.shadowBlur  = 0;
      ctx.strokeStyle = `hsla(${seed.hue},95%,88%,${seed.attracted ? 0.95 : 0.6})`;
      ctx.lineWidth   = 0.9;
      ctx.stroke();

      // Bright inner core
      ctx.beginPath();
      ctx.arc(0, 0, seed.r * 0.38, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${seed.hue},100%,97%,${seed.attracted ? 0.95 : 0.65})`;
      ctx.fill();

      ctx.restore();
    }

    // ── Draw flower ───────────────────────────────────────────────────────────
    function drawFlower(f: Flower) {
      const r = f.targetR * f.bloomT;
      if (r < 0.5) return;
      ctx.save();
      ctx.translate(f.x, f.y);
      const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 3.5);
      gl.addColorStop(0, `hsla(${f.hue},80%,72%,0.28)`);
      gl.addColorStop(1, `hsla(${f.hue},80%,72%,0)`);
      ctx.beginPath(); ctx.arc(0, 0, r * 3.5, 0, Math.PI * 2);
      ctx.fillStyle = gl; ctx.fill();
      for (let i = 0; i < f.petals; i++) {
        const ang = (i / f.petals) * Math.PI * 2;
        ctx.save(); ctx.rotate(ang);
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.78, r * 0.27, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fillStyle   = `hsla(${f.hue},78%,76%,0.82)`;
        ctx.strokeStyle = `hsla(${f.hue},88%,90%,0.55)`;
        ctx.lineWidth   = 0.7;
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath(); ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${f.hue + 30},92%,93%,0.95)`;
      ctx.fill();
      ctx.restore();
    }

    // ── Draw tree ─────────────────────────────────────────────────────────────
    function drawTree(T: number) {
      ctx.save();
      for (const seg of segs) {
        const d = seg.depth;
        const w = Math.max(0.5, 4.2 - d * 0.75);
        const hue   = 215 + d * 9;
        const light = 55 + d * 6;
        const alpha = 0.44 + (4 - d) * 0.1;
        ctx.shadowColor = `hsla(${hue},65%,${light}%,0.6)`;
        ctx.shadowBlur  = 6 + (4 - d);
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.strokeStyle = `hsla(${hue},65%,${light}%,${alpha})`;
        ctx.lineWidth   = w;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.restore();

      // Root warm glow
      const pulse = 0.65 + 0.35 * Math.sin(T * 1.8);
      const rg = ctx.createRadialGradient(rootX, rootY, 0, rootX, rootY, 55);
      rg.addColorStop(0,   `rgba(255,200,70,${0.55 * pulse})`);
      rg.addColorStop(0.4, `rgba(255,160,40,${0.22 * pulse})`);
      rg.addColorStop(1,   `rgba(255,120,20,0)`);
      ctx.beginPath(); ctx.arc(rootX, rootY, 55, 0, Math.PI * 2);
      ctx.fillStyle = rg; ctx.fill();

      // Hitbox ring — shows where to bring seeds
      const ringA = 0.12 + 0.1 * Math.sin(T * 2.4);
      ctx.beginPath(); ctx.arc(rootX, rootY, 52, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,215,80,${ringA})`;
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([4, 7]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Gravity wave visual indicator
      if (gravTimer > 0) {
        const alpha = Math.min(1, gravTimer / 0.4) * 0.35;
        const wavR  = 60 + (2.5 - gravTimer) / 2.5 * 80;
        ctx.beginPath(); ctx.arc(gravX, gravY, wavR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(200,170,255,${alpha})`;
        ctx.lineWidth = 1.5; ctx.setLineDash([3, 6]); ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // ── Events ────────────────────────────────────────────────────────────────
    function onMove(e: PointerEvent) {
      const r = canvas!.getBoundingClientRect();
      curX = e.clientX - r.left; curY = e.clientY - r.top;
      cursorActive = true; showHint = false;
    }
    function onDown(e: PointerEvent) {
      const r = canvas!.getBoundingClientRect();
      const cx = e.clientX - r.left, cy = e.clientY - r.top;
      bootAudio();
      // Gravity wave: pull all seeds to click point for 2.5 seconds
      gravX = cx; gravY = cy; gravTimer = 2.5;
      showHint = false;
    }
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);

    // ── Main loop ─────────────────────────────────────────────────────────────
    function loop(ts: number) {
      const dt = Math.min((ts - lastT) / 1000, 0.05);
      lastT = ts;
      const T = ts / 1000;

      if (gravTimer > 0) gravTimer = Math.max(0, gravTimer - dt);

      // Background
      ctx.fillStyle = "#04060e";
      ctx.fillRect(0, 0, W, H);
      const vg = ctx.createRadialGradient(W / 2, H * 0.38, 0, W / 2, H * 0.38, Math.max(W, H) * 0.68);
      vg.addColorStop(0, "rgba(8,12,28,0.55)"); vg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

      // Spawn new seeds from edges
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        if (seeds.filter(s => !s.dead).length < 22) spawnFromEdge();
        spawnTimer = rnd(2.2, 4.5);
      }

      // ── Update seeds ──────────────────────────────────────────────────────
      let attractedCount = 0;
      seeds = seeds.filter(s => !s.dead || s.flashT > 0);

      for (const seed of seeds) {
        if (seed.flashT > 0) { seed.flashT -= dt; continue; }
        if (seed.dead) continue;

        seed.rot += seed.rotV * dt;

        // Continuous Brownian drift — seeds never fully stop
        seed.vx += (Math.random() - 0.5) * 30 * dt;
        seed.vy += (Math.random() - 0.5) * 30 * dt;

        const dxC  = curX - seed.x, dyC = curY - seed.y;
        const distC = Math.sqrt(dxC * dxC + dyC * dyC);

        const ATTR_R = 165;

        // Gravity wave — pulls ALL seeds toward click point (strong, 2.5s)
        if (gravTimer > 0) {
          const dxG = gravX - seed.x, dyG = gravY - seed.y;
          const distG = Math.sqrt(dxG * dxG + dyG * dyG) + 1;
          const strength = 280 * (gravTimer / 2.5);
          seed.vx += (dxG / distG) * strength * dt;
          seed.vy += (dyG / distG) * strength * dt;
          seed.attracted = true;
          attractedCount++;
        } else if (distC < ATTR_R && cursorActive) {
          // Normal cursor swarm magnet
          seed.attracted = true;
          attractedCount++;
          const t       = 1 - distC / ATTR_R;
          const inertia = 1 / (1 + attractedCount * 0.045);
          const force   = 165 * t * t * inertia * (distC < 45 ? 0.18 : 1);
          seed.vx += (dxC / (distC + 0.1)) * force * dt;
          seed.vy += (dyC / (distC + 0.1)) * force * dt;
        } else {
          if (distC > ATTR_R * 1.5) seed.attracted = false;
          // Weak center drift keeps seeds on screen
          seed.vx += (W / 2 - seed.x) * 0.007 * dt;
          seed.vy += (H / 2 - seed.y) * 0.007 * dt;
        }

        // Speed cap + gentle damping
        const spd    = Math.sqrt(seed.vx * seed.vx + seed.vy * seed.vy);
        const maxSpd = seed.attracted ? 190 : 85;
        if (spd > maxSpd) { seed.vx = (seed.vx / spd) * maxSpd; seed.vy = (seed.vy / spd) * maxSpd; }
        seed.vx *= 0.972;
        seed.vy *= 0.972;

        seed.x += seed.vx * dt;
        seed.y += seed.vy * dt;

        // Edge wrap
        if      (seed.x < -38) seed.x = W + 28;
        else if (seed.x > W + 38) seed.x = -28;
        if      (seed.y < -38) seed.y = H + 28;
        else if (seed.y > H + 38) seed.y = -28;

        // Root collision trigger — seed must be attracted to count
        const dxR = seed.x - rootX, dyR = seed.y - rootY;
        if (seed.attracted && Math.sqrt(dxR * dxR + dyR * dyR) < 50) {
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
            // Zen chord when flower blooms
            if (!f.soundPlayed) {
              f.soundPlayed = true;
              sndZenChord(f.hue);
            }
          } else {
            f.x = f.seg.x1 + (f.seg.x2 - f.seg.x1) * f.travelT;
            f.y = f.seg.y1 + (f.seg.y2 - f.seg.y1) * f.travelT;
          }
        } else if (f.bloomT < 1) {
          f.bloomT = Math.min(1, f.bloomT + dt * 0.55);
        }
      }

      // ── Update pulses ─────────────────────────────────────────────────────
      pulses = pulses.filter(p => p.t <= 1);
      for (const p of pulses) {
        // Glissando starts on first frame of pulse
        if (!p.soundStarted) {
          p.soundStarted = true;
          sndGlissando(p.dur);
        }
        p.t = Math.min(1, p.t + dt / p.dur);
      }

      // ── Render ────────────────────────────────────────────────────────────
      drawTree(T);

      // Pulses — glowing particle travelling root→branch
      for (const p of pulses) {
        const px = p.x1 + (p.x2 - p.x1) * p.t;
        const py = p.y1 + (p.y2 - p.y1) * p.t;

        // Tail
        const prevT = Math.max(0, p.t - 0.12);
        const tx = p.x1 + (p.x2 - p.x1) * prevT;
        const ty = p.y1 + (p.y2 - p.y1) * prevT;
        const tailFade = 1 - p.t;
        ctx.beginPath();
        ctx.moveTo(tx, ty); ctx.lineTo(px, py);
        ctx.strokeStyle = `hsla(${p.hue},92%,78%,${0.55 * tailFade + 0.2})`;
        ctx.lineWidth   = 4; ctx.lineCap = "round";
        ctx.stroke();

        // Head glow
        const pg = ctx.createRadialGradient(px, py, 0, px, py, 18);
        pg.addColorStop(0, `hsla(${p.hue},100%,95%,0.95)`);
        pg.addColorStop(0.4, `hsla(${p.hue},90%,72%,0.55)`);
        pg.addColorStop(1, `hsla(${p.hue},80%,60%,0)`);
        ctx.beginPath(); ctx.arc(px, py, 18, 0, Math.PI * 2);
        ctx.fillStyle = pg; ctx.fill();
      }

      for (const f of flowers) drawFlower(f);
      for (const seed of seeds) drawSeed(seed);

      // Cursor trail
      trailX[trailHead] = curX;
      trailY[trailHead] = curY;
      trailHead = (trailHead + 1) % TRAIL_LEN;
      if (trailFilled < TRAIL_LEN) trailFilled++;

      if (cursorActive && trailFilled > 1) {
        const weight = Math.min(attractedCount / 10, 1);
        for (let i = 1; i < trailFilled; i++) {
          const idx0 = (trailHead - i - 1 + TRAIL_LEN) % TRAIL_LEN;
          const idx1 = (trailHead - i     + TRAIL_LEN) % TRAIL_LEN;
          const frac = 1 - i / trailFilled;
          ctx.beginPath();
          ctx.moveTo(trailX[idx0], trailY[idx0]);
          ctx.lineTo(trailX[idx1], trailY[idx1]);
          ctx.strokeStyle = `rgba(160,210,255,${frac * (0.32 - weight * 0.1)})`;
          ctx.lineWidth   = frac * 2;
          ctx.stroke();
        }
      }

      // Cursor dot
      if (cursorActive) {
        const weight = Math.min(attractedCount / 10, 1);
        const pulse  = 1 + 0.35 * Math.sin(T * 4.5);
        const baseR  = 4 + weight * 2;
        const cg = ctx.createRadialGradient(curX, curY, 0, curX, curY, 26 + weight * 14);
        cg.addColorStop(0, `rgba(190,235,255,${0.5 - weight * 0.15})`);
        cg.addColorStop(1, `rgba(100,180,255,0)`);
        ctx.beginPath(); ctx.arc(curX, curY, 26 + weight * 14, 0, Math.PI * 2);
        ctx.fillStyle = cg; ctx.fill();
        ctx.beginPath(); ctx.arc(curX, curY, (baseR + 9) * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(170,225,255,${0.28 - weight * 0.08})`;
        ctx.lineWidth = 1; ctx.stroke();
        ctx.beginPath(); ctx.arc(curX, curY, baseR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(240,250,255,${0.95 - weight * 0.2})`; ctx.fill();
      }

      // Hint
      if (showHint) {
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.font = "13px -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Двигайте курсором — семена потянутся за вами", W / 2, H - 32);
        ctx.fillText("Приведите их к корням дерева, чтобы расцвели цветы", W / 2, H - 14);
      }

      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      ac?.close();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block", touchAction: "none", cursor: "none" }}
    />
  );
}
