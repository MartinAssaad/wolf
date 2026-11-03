// ===============================
// Wolf Cards
// ===============================

const $ = (id) => document.getElementById(id);

// ===============================
// Setup counters
// ===============================

let wolves = 2;
let villagers = 4;

function updateCounters() {
  $("wolfValue").textContent = wolves;
  $("villagerValue").textContent = villagers;

  const n =
    wolves +
    villagers +
    ($("doctor").checked ? 1 : 0) +
    ($("sheriff").checked ? 1 : 0);

  $("total").textContent = n + " players";
}

$("wolfPlus").onclick = () => { wolves++; updateCounters(); };
$("wolfMinus").onclick = () => { if (wolves > 1) wolves--; updateCounters(); };
$("villagerPlus").onclick = () => { villagers++; updateCounters(); };
$("villagerMinus").onclick = () => { if (villagers > 1) villagers--; updateCounters(); };
$("doctor").onchange = updateCounters;
$("sheriff").onchange = updateCounters;

updateCounters();

// ===============================
// Sound (all synthesized, no files)
// ===============================

let actx = null;
let master = null;
let reverbIn = null;
let noiseBuf = null;
let muted = false;

function initAudio() {
  if (actx) {
    if (actx.state === "suspended") actx.resume();
    return;
  }

  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;

  actx = new AC();

  master = actx.createGain();
  master.gain.value = muted ? 0 : 0.9;
  master.connect(actx.destination);

  // Reverb so howls sound like they come from far away
  const conv = actx.createConvolver();
  conv.buffer = makeImpulse(2.6, 2.4);
  reverbIn = actx.createGain();
  const wet = actx.createGain();
  wet.gain.value = 0.5;
  reverbIn.connect(conv);
  conv.connect(wet);
  wet.connect(master);

  noiseBuf = makeNoise(3);

  startWind();
  scheduleAmbientHowl();
}

function makeImpulse(sec, decay) {
  const len = Math.floor(actx.sampleRate * sec);
  const buf = actx.createBuffer(2, len, actx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

function makeNoise(sec) {
  const len = Math.floor(actx.sampleRate * sec);
  const buf = actx.createBuffer(1, len, actx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function startWind() {
  const src = actx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;

  const lp = actx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 420;

  const g = actx.createGain();
  g.gain.value = 0.05;

  // slow breathing of the wind
  const lfo = actx.createOscillator();
  lfo.frequency.value = 0.11;
  const lg = actx.createGain();
  lg.gain.value = 0.025;
  lfo.connect(lg);
  lg.connect(g.gain);

  src.connect(lp);
  lp.connect(g);
  g.connect(master);

  src.start();
  lfo.start();
}

function howl(vol = 0.3, dur = 3.4, pitch = 1) {
  if (!actx || muted) return;

  const t = actx.currentTime;

  const out = actx.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.linearRampToValueAtTime(vol, t + 0.6);
  out.gain.setValueAtTime(vol, t + dur * 0.6);
  out.gain.linearRampToValueAtTime(0.0001, t + dur);

  const lp = actx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1500;
  lp.Q.value = 2;

  const formant = actx.createBiquadFilter();
  formant.type = "peaking";
  formant.frequency.value = 750;
  formant.gain.value = 9;
  formant.Q.value = 3;

  const o1 = actx.createOscillator();
  const o2 = actx.createOscillator();
  o1.type = "sawtooth";
  o2.type = "triangle";

  [o1, o2].forEach((o, i) => {
    const m = i ? 1.006 : 1;
    o.frequency.setValueAtTime(240 * pitch * m, t);
    o.frequency.exponentialRampToValueAtTime(520 * pitch * m, t + dur * 0.28);
    o.frequency.linearRampToValueAtTime(560 * pitch * m, t + dur * 0.5);
    o.frequency.exponentialRampToValueAtTime(300 * pitch * m, t + dur);
  });

  // vibrato builds up like a real howl
  const lfo = actx.createOscillator();
  lfo.frequency.value = 5.2;
  const lfoGain = actx.createGain();
  lfoGain.gain.setValueAtTime(0, t);
  lfoGain.gain.linearRampToValueAtTime(11 * pitch, t + dur * 0.5);
  lfo.connect(lfoGain);
  lfoGain.connect(o1.frequency);
  lfoGain.connect(o2.frequency);

  const g2 = actx.createGain();
  g2.gain.value = 0.6;

  // breath
  const breath = actx.createBufferSource();
  breath.buffer = noiseBuf;
  const bp = actx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1100;
  bp.Q.value = 0.8;
  const bg = actx.createGain();
  bg.gain.value = 0.06;

  o1.connect(lp);
  o2.connect(g2);
  g2.connect(lp);
  breath.connect(bp);
  bp.connect(bg);
  bg.connect(lp);

  lp.connect(formant);
  formant.connect(out);
  out.connect(master);

  const send = actx.createGain();
  send.gain.value = 0.7;
  out.connect(send);
  send.connect(reverbIn);

  const end = t + dur + 0.1;
  o1.start(t); o2.start(t); lfo.start(t); breath.start(t);
  o1.stop(end); o2.stop(end); lfo.stop(end); breath.stop(end);
}

function snap(time, vol, freq) {
  const src = actx.createBufferSource();
  src.buffer = noiseBuf;

  const hp = actx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = freq;

  const g = actx.createGain();
  g.gain.setValueAtTime(vol, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

  src.connect(hp);
  hp.connect(g);
  g.connect(master);

  src.start(time, Math.random() * 2, 0.06);
}

function shuffleSound() {
  if (!actx || muted) return;
  const t = actx.currentTime;
  for (let i = 0; i < 19; i++) {
    snap(t + i * 0.135 + Math.random() * 0.05, 0.16 + Math.random() * 0.12, 1800 + Math.random() * 2200);
  }
}

function flipSound() {
  if (!actx || muted) return;
  const t = actx.currentTime;

  const src = actx.createBufferSource();
  src.buffer = noiseBuf;
  const bp = actx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(400, t);
  bp.frequency.exponentialRampToValueAtTime(2400, t + 0.3);

  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.18, t + 0.1);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

  src.connect(bp);
  bp.connect(g);
  g.connect(master);
  src.start(t, 0, 0.4);

  snap(t + 0.4, 0.2, 2200);
}

function thud(vol = 0.5) {
  if (!actx || muted) return;
  const t = actx.currentTime;
  const o = actx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.35);
  const g = actx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + 0.5);
}

function goodChime(delay = 0.55) {
  if (!actx || muted) return;
  const t = actx.currentTime + delay;
  [392, 587].forEach((f, i) => {
    const o = actx.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    const g = actx.createGain();
    g.gain.setValueAtTime(0.0001, t + i * 0.12);
    g.gain.linearRampToValueAtTime(0.12, t + i * 0.12 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.9);
    o.connect(g);
    g.connect(master);
    g.connect(reverbIn);
    o.start(t + i * 0.12);
    o.stop(t + i * 0.12 + 1);
  });
}

function scheduleAmbientHowl() {
  setTimeout(() => {
    howl(0.1, 3.6, 0.9 + Math.random() * 0.25);
    scheduleAmbientHowl();
  }, 14000 + Math.random() * 14000);
}

$("muteBtn").onclick = () => {
  initAudio();
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.9;
  $("muteBtn").textContent = muted ? "Sound: off" : "Sound: on";
};

// ===============================
// Scene: night forest, villagers flee, wolves chase
// ===============================

const cv = $("scene");
const ctx = cv.getContext("2d");

let W = 0, H = 0, groundY = 0, dpr = 1, unit = 1;
let stars = [];
let layers = [];
let actors = [];
let spawnIn = 1;

// mood: how frantic the chase is, and how red the night is
let intensity = 0.15, intensityTarget = 0.15;
let blood = 0, bloodTarget = 0;

const MOODS = {
  setup:      { i: 0.15, b: 0 },
  shuffle:    { i: 1,    b: 1 },
  player:     { i: 0.35, b: 0.4 },
  pass:       { i: 0.5,  b: 0.2 },
  finish:     { i: 0.9,  b: 0.8 },
  rules:      { i: 0.25, b: 0.15 },
  wolfReveal: { i: 0.7,  b: 1 },
  goodReveal: { i: 0.3,  b: 0 }
};

function setMood(name) {
  const m = MOODS[name];
  intensityTarget = m.i;
  bloodTarget = m.b;
}

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")})`;
}

function rand(a, b) { return a + Math.random() * (b - a); }

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  cv.width = W * dpr;
  cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  groundY = H * 0.74;
  unit = Math.max(0.55, Math.min(W, H) / 520);

  stars = [];
  const n = Math.floor((W * groundY) / 9000);
  for (let i = 0; i < n; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * groundY * 0.85,
      r: rand(0.4, 1.4),
      sp: rand(0.8, 2.5),
      ph: Math.random() * 6
    });
  }

  buildLayers();
}

function buildLayers() {
  const patW = Math.max(W * 1.5, 1300);

  function make(speed, color, base, hMin, hMax, gapMin, gapMax) {
    const trees = [];
    let x = 0;
    while (x < patW) {
      const h = rand(hMin, hMax) * unit;
      trees.push({ x, h, w: h * rand(0.42, 0.55) });
      x += rand(gapMin, gapMax) * unit;
    }
    return { speed, color, base, trees, patW };
  }

  layers = [
    make(14, "#0e1a15", groundY + 4, 120, 200, 30, 70),
    make(36, "#08110d", groundY + 20, 150, 260, 60, 130),
    make(95, "#030605", H + 10, 330, 520, 340, 620)
  ];
  layers[2].near = true;
}

function pine(x, base, h, w) {
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const ty = base - h + k * h * 0.27;
    const by = ty + h * 0.5;
    const half = (w / 2) * (0.45 + 0.275 * k);
    ctx.moveTo(x, ty);
    ctx.lineTo(x - half, by);
    ctx.lineTo(x + half, by);
    ctx.closePath();
  }
  ctx.rect(x - w * 0.035, base - h * 0.22, w * 0.07, h * 0.24);
  ctx.fill();
}

function drawLayer(L, time) {
  ctx.fillStyle = L.color;
  const off = time * L.speed * (0.6 + intensity * 0.9);
  for (const t of L.trees) {
    const x = (((t.x - off) % L.patW) + L.patW) % L.patW - t.w;
    if (x > W + t.w || x < -t.w * 2) continue;
    pine(x, L.base, t.h, t.w);
  }
}

// ---------- Actors ----------

const SHIRTS = ["#c9a36b", "#8fa8a3", "#c27c5a", "#a9b27c", "#b99bb0"];

function spawnGroup(startX) {
  const nV = 1 + Math.floor(Math.random() * (2 + intensity * 2));
  let nW = 1;
  if (Math.random() < 0.3 + intensity * 0.4) nW++;
  if (intensity > 0.6 && Math.random() < 0.4) nW++;

  const d = Math.random();
  const y = groundY + 18 + d * (H - groundY - 60);
  const base = (W * 0.15 + rand(0, 60)) * 1;
  const x0 = startX !== undefined ? startX : -140;

  for (let i = 0; i < nV; i++) {
    actors.push({
      type: "v",
      x: x0 + 200 + i * rand(46, 70),
      y: y + rand(-12, 12),
      d,
      speed: base * rand(0.95, 1.05),
      phase: Math.random() * 6,
      color: SHIRTS[Math.floor(Math.random() * SHIRTS.length)]
    });
  }

  for (let j = 0; j < nW; j++) {
    actors.push({
      type: "w",
      x: x0 - j * rand(70, 100),
      y: y + rand(-8, 8),
      d,
      speed: base * rand(1.1, 1.18),
      phase: Math.random() * 6
    });
  }
}

function leg(x, y, ang, upper, lower, bend) {
  const kx = x + Math.sin(ang) * upper;
  const ky = y + Math.cos(ang) * upper;
  const a2 = ang - bend;
  ctx.moveTo(x, y);
  ctx.lineTo(kx, ky);
  ctx.lineTo(kx + Math.sin(a2) * lower, ky + Math.cos(a2) * lower);
}

function armEnd(a, mode, p, k) {
  if (mode === "run" || mode === "down") {
    if (k === 0) {
      const g = Math.sin(p + Math.PI) * 1.1;
      return [Math.sin(g) * 12, Math.cos(g) * 12 - 3];
    }
    const g = Math.sin(p) * 1.2 + 0.6;
    return [Math.sin(g) * 13, -Math.cos(g) * 6 + 6];
  }
  if (mode === "hang") return [3 + k * 3, -18];
  if (a.throwing && k === 1) {
    return [8 + Math.sin(clock * 14) * 6, -20 + Math.cos(clock * 14) * 5];
  }
  return [1 + k * 2, 14];
}

// Villager, doctor and sheriff all use this (a.doc / a.sheriff change the look)
function drawVillager(a, s) {
  const mode = a.mode || "run";
  const dir = a.dir || 1;
  const p = a.phase;
  const alt = a.alt || 0;
  const bob = mode === "run" ? -Math.abs(Math.sin(p)) * 3 * s : 0;
  const fall = a.fall || 0;

  ctx.save();
  ctx.globalAlpha = a.alpha === undefined ? 1 : a.alpha;
  ctx.translate(a.x, a.y - alt + bob);
  ctx.scale(s * dir, s);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // shadow stays on the ground even when flying
  ctx.fillStyle = `rgba(0,0,0,${0.35 * (1 - Math.min(0.8, alt / 400))})`;
  ctx.beginPath();
  ctx.ellipse(0, 2 + (alt - bob) / s, 18, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // falling over / getting up
  ctx.translate(0, -fall * 8);
  ctx.rotate((fall * Math.PI) / 2);

  // legs
  ctx.strokeStyle = a.doc ? "#cfd8c4" : "#1c1612";
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let k = 0; k < 2; k++) {
    let ang, bend;
    if (mode === "run" || mode === "down") {
      const q = p + k * Math.PI;
      ang = Math.sin(q) * (mode === "down" ? 0.5 : 0.85);
      bend = 0.55 + 0.6 * Math.max(0, Math.cos(q));
    } else if (mode === "hang") {
      ang = 0.1 * Math.sin(p * 1.3 + k * 2);
      bend = 0.1;
    } else {
      ang = k ? 0.09 : -0.09;
      bend = 0.05;
    }
    leg(0, -32, ang, 16, 16, bend);
  }
  ctx.stroke();

  const sh = { x: 5, y: -57 };

  // back arm
  ctx.strokeStyle = a.color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(sh.x, sh.y);
  let e = armEnd(a, mode, p, 0);
  ctx.lineTo(sh.x + e[0], sh.y + e[1]);
  ctx.stroke();

  // torso
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(0, -32);
  ctx.lineTo(sh.x, sh.y);
  ctx.stroke();

  if (a.doc) {
    // green cross on the coat
    ctx.fillStyle = "#2f9e5a";
    ctx.fillRect(-0.5, -46, 6, 2);
    ctx.fillRect(1.5, -49, 2, 8);
  }
  if (a.sheriff) {
    // gold star badge
    ctx.fillStyle = "#e3b341";
    ctx.beginPath();
    ctx.arc(3, -46, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // head
  ctx.fillStyle = "#d9c3a0";
  ctx.beginPath();
  ctx.arc(8, -67, 6.5, 0, Math.PI * 2);
  ctx.fill();

  if (a.sheriff) {
    // hat
    ctx.fillStyle = "#4a3520";
    ctx.beginPath();
    ctx.ellipse(8, -72, 12, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(8, -76.5, 6.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // front arm
  ctx.strokeStyle = a.color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(sh.x, sh.y);
  e = armEnd(a, mode, p, 1);
  ctx.lineTo(sh.x + e[0], sh.y + e[1]);
  ctx.stroke();

  ctx.restore();
}

function drawWolf(a, s) {
  const mode = a.mode || "run";
  const dir = a.dir || 1;
  const stat = mode === "stand" || mode === "eat";
  const p = a.phase;
  const pp = stat ? 2.6 : p;
  const bob = stat ? 0 : Math.sin(p * 2) * 2.5 * s;
  const tilt = a.tilt || 0;
  const droop = mode === "caught" || mode === "stand" ? 9 : 0;
  const k = s * 1.15;

  ctx.save();
  ctx.translate(a.x, a.y + bob);
  ctx.scale(k * dir, k);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // shadow
  ctx.fillStyle = "rgba(0,0,0,.4)";
  ctx.beginPath();
  ctx.ellipse(0, 2 - bob / k, 32, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  const fur = "#5b636b";
  const dark = "#3b4249";

  // far legs
  ctx.strokeStyle = dark;
  ctx.lineWidth = 6;
  ctx.beginPath();
  leg(-18, -24, Math.sin(pp + 0.7) * 1.0, 13, 14, 0.9);
  leg(18, -24, Math.sin(pp + Math.PI + 0.7) * 1.0, 13, 14, 0.9);
  ctx.stroke();

  // tail
  ctx.strokeStyle = fur;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-24, -30);
  ctx.quadraticCurveTo(
    -42,
    -34 + Math.sin(p) * 5 + droop * 0.5,
    -54,
    -24 + Math.sin(p) * 8 + droop
  );
  ctx.stroke();

  // body
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.ellipse(0, -28, 27, 11, Math.sin(pp) * 0.05, 0, Math.PI * 2);
  ctx.fill();

  // neck
  ctx.beginPath();
  ctx.moveTo(18, -36);
  ctx.lineTo(32, -44);
  ctx.lineTo(34, -26);
  ctx.closePath();
  ctx.fill();

  // head (can tilt down to bite, or up to growl)
  ctx.save();
  ctx.translate(28, -36);
  ctx.rotate(tilt);
  ctx.translate(-28, 36);

  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.ellipse(34, -38, 11, 8, 0.15, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(38, -43);
  ctx.lineTo(55, -35);
  ctx.lineTo(39, -30);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#d8d2c0";
  ctx.beginPath();
  ctx.moveTo(46, -33);
  ctx.lineTo(48, -29);
  ctx.lineTo(50, -33);
  ctx.fill();

  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.moveTo(28, -44);
  ctx.lineTo(30, -56);
  ctx.lineTo(37, -45);
  ctx.moveTo(33, -45);
  ctx.lineTo(38, -55);
  ctx.lineTo(42, -43);
  ctx.fill();

  ctx.shadowColor = "#ff2a1a";
  ctx.shadowBlur = 10;
  ctx.fillStyle = mode === "caught" ? "#c9602a" : "#ff4030";
  ctx.beginPath();
  ctx.arc(39, -41, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.restore();

  // near legs
  ctx.strokeStyle = fur;
  ctx.lineWidth = 6.5;
  ctx.beginPath();
  leg(-18, -24, Math.sin(pp) * 1.0, 13, 14, 0.9);
  leg(18, -24, Math.sin(pp + Math.PI) * 1.0, 13, 14, 0.9);
  ctx.stroke();

  ctx.restore();
}

// ---------- Particles ----------

let parts = [];

function burst(x, y, rgb, n, speed, grav) {
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const v = rand(0.3, 1) * speed;
    const life = rand(0.6, 1.3);
    parts.push({
      x, y,
      vx: Math.cos(ang) * v,
      vy: Math.sin(ang) * v - speed * 0.3,
      g: grav,
      life,
      l0: life,
      rgb,
      r: rand(1.5, 3.2)
    });
  }
}

function updateParts(dt) {
  for (const q of parts) {
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.vy += q.g * dt;
    q.life -= dt;
  }
  parts = parts.filter((q) => q.life > 0);
}

function drawParts() {
  for (const q of parts) {
    ctx.fillStyle = `rgba(${q.rgb},${Math.max(0, q.life / q.l0)})`;
    ctx.beginPath();
    ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------- Rescue event ----------
// A villager is caught and eaten by a wolf, the doctor parachutes in
// from the sky and saves them, then the sheriff lassos both wolves.

let ev = null;
let evCooldown = 6;

function startRescue() {
  const d = 0.55;
  const s = unit * (0.8 + 0.7 * d);
  const y = groundY + 24 + (H - groundY - 70) * 0.4;
  const f = Math.min(1, (W * 0.5) / (420 * s));
  const c = W * 0.5 - 30 * s;

  ev = {
    t: 0, s, f, c, y, d,
    v:   { type: "v", x: -120, y, d, phase: 0, color: "#c9a36b", mode: "run", fall: 0 },
    w1:  { type: "w", x: -300, y: y + 4, d, phase: 0, mode: "run", tilt: 0, dir: 1 },
    w2:  { type: "w", x: -400, y: y - 6, d, phase: 0, mode: "run", tilt: 0, dir: 1 },
    doc: { type: "v", x: c + 120 * s, y, d, phase: 0, color: "#e6eddc", mode: "hang", doc: true, alt: 0, alpha: 1, hidden: true },
    sh:  { type: "v", x: -160 * s, y, d, phase: 0, color: "#8a6a3a", mode: "run", sheriff: true, hidden: true },
    chute: false, chuteDown: null, ring: null,
    pounced: false, landed: false, rising: false, arrived: false,
    caught1: false, caught2: false, flying: false, marching: false,
    tLand: 0, tA: 0, fx1: 0, fx2: 0
  };
  ev.list = [ev.v, ev.w1, ev.w2, ev.doc, ev.sh];
}

function neck(w, s) {
  return [w.x + (w.dir || 1) * 38 * s * 1.15, w.y - 40 * s * 1.15];
}

function updateEvent(dt) {
  if (!ev) {
    evCooldown -= dt;
    if (evCooldown <= 0) startRescue();
    return;
  }

  const e = ev;
  e.t += dt;
  const t = e.t, s = e.s, f = e.f, c = e.c;
  const { v, w1, w2, doc, sh } = e;
  const base = W * 0.17;

  // 1. The chase
  if (t < 3.2) {
    const u = t / 3.2;
    v.x = -120 + (c + 120) * u;
    w1.x = v.x - (42 + 200 * (1 - u * u)) * s;
    w2.x = w1.x - 95 * s;
    const sp = (c + 120) / 3.2;
    v.phase += dt * (9 + sp / 45);
    w1.phase += dt * (10 + sp / 40);
    w2.phase += dt * (10 + sp / 40);
  } else {
    // 2. The wolf pounces and starts eating
    if (!e.pounced) {
      e.pounced = true;
      v.x = c;
      v.mode = "down";
      w1.x = c - 42 * s;
      w1.mode = "eat";
      w2.x = c - 137 * s;
      w2.mode = "stand";
      w2.tilt = -0.3;
      thud(0.35);
      howl(0.2, 2.2, 1.15);
    }
    if (v.mode === "down") {
      v.fall = Math.min(1, v.fall + dt * 3);
      v.phase += dt * 14;
    }
    if (w1.mode === "eat") {
      w1.phase += dt * 6;
      w1.tilt = 0.55 + Math.sin(w1.phase * 2) * 0.15;
    }
  }

  // 3. The doctor drops from the sky on a parachute
  if (t >= 3.6 && !e.landed) {
    doc.hidden = false;
    e.chute = true;
    const u = Math.min(1, (t - 3.6) / 3);
    const k = 1 - (1 - u) * (1 - u);
    doc.alt = (e.y + 190) * (1 - k);
    doc.x = c + 120 * s + Math.sin(u * 6) * 20 * s * (1 - u);
    doc.phase += dt * 2;

    if (u >= 1) {
      e.landed = true;
      e.tLand = t;
      e.chute = false;
      doc.alt = 0;
      doc.x = c + 120 * s;
      doc.mode = "stand";
      e.chuteDown = { x: doc.x + 40 * s, t: 0 };
      e.ring = { t: 0 };
      burst(doc.x, e.y - 30 * s, "110,255,160", 40, 220 * s, 80);
      goodChime(0.05);

      e.fx1 = c - 150 * s * f;
      e.fx2 = e.fx1 - 90 * s * f;
      [w1, w2].forEach((w) => {
        w.mode = "run";
        w.dir = -1;
        w.tilt = 0;
      });
    }
  }

  if (e.landed) {
    // wolves flee from the doctor's light, then get cornered
    [[w1, e.fx1], [w2, e.fx2]].forEach(([w, fx]) => {
      if (w.mode === "run") {
        if (w.x > fx) {
          w.x -= base * 1.5 * dt;
          w.phase += dt * 16;
        } else {
          w.mode = "stand";
        }
      }
      if (w.mode === "stand") {
        w.tilt = 0.12 + Math.sin(clock * 9) * 0.06;
        w.phase += dt * 6;
      }
    });

    // villager gets up and runs away
    if (t >= e.tLand + 0.6 && !e.rising) {
      e.rising = true;
      v.mode = "stand";
    }
    if (e.rising) {
      v.fall = Math.max(0, v.fall - dt * 1.6);
      if (v.mode === "stand" && t > e.tLand + 1.7) {
        v.mode = "run";
        v.dir = 1;
      }
      if (v.mode === "run") {
        v.x += base * 1.15 * dt;
        v.phase += dt * 17;
      }
    }

    if (e.ring) {
      e.ring.t += dt;
      if (e.ring.t > 1.6) e.ring = null;
    }
    if (e.chuteDown) {
      e.chuteDown.t += dt;
      if (e.chuteDown.t > 3) e.chuteDown = null;
    }

    // 4. The sheriff arrives
    if (t >= e.tLand + 0.8) {
      sh.hidden = false;

      if (!e.arrived) {
        sh.x += base * 1.35 * dt;
        sh.phase += dt * 17;
        if (sh.x >= e.fx2 - 85 * s * f) {
          e.arrived = true;
          e.tA = t;
          sh.mode = "stand";
        }
      } else {
        const ta = t - e.tA;
        sh.throwing = ta > 0.2 && ta < 1.7;

        // lasso the wolves, one by one
        if (ta > 0.9 && !e.caught2) {
          e.caught2 = true;
          w2.mode = "caught";
          w2.tilt = 0.3;
          const [nx, ny] = neck(w2, s);
          burst(nx, ny, "255,215,90", 18, 120 * s, 120);
          if (actx && !muted) snap(actx.currentTime, 0.3, 900);
          thud(0.2);
        }
        if (ta > 1.6 && !e.caught1) {
          e.caught1 = true;
          w1.mode = "caught";
          w1.tilt = 0.3;
          const [nx, ny] = neck(w1, s);
          burst(nx, ny, "255,215,90", 18, 120 * s, 120);
          if (actx && !muted) snap(actx.currentTime, 0.3, 900);
          thud(0.2);
        }

        // doctor floats back up to the sky
        if (ta > 1.0 && !e.flying) {
          e.flying = true;
          doc.mode = "hang";
        }
        if (e.flying && !doc.hidden) {
          doc.alt += (80 + (ta - 1.0) * 300) * dt;
          doc.alpha = Math.max(0, doc.alpha - dt * 0.45);
          doc.phase += dt * 2;
          if (Math.random() < 0.6) {
            burst(doc.x, doc.y - doc.alt - 30 * s, "110,255,160", 1, 30, -20);
          }
          if (doc.alpha <= 0) doc.hidden = true;
        }

        // sheriff marches the wolves off
        if (ta > 2.4) {
          if (!e.marching) {
            e.marching = true;
            sh.mode = "run";
            sh.dir = 1;
            sh.throwing = false;
            w1.dir = 1;
            w2.dir = 1;
            w1.tilt = 0.5;
            w2.tilt = 0.5;
          }
          const m = W * 0.12;
          sh.x += m * dt;
          w1.x += m * dt;
          w2.x += m * dt;
          sh.phase += dt * 9;
          w1.phase += dt * 9;
          w2.phase += dt * 9;

          if (sh.x > W + 200 * s) {
            ev = null;
            evCooldown = rand(16, 26) / (1 + intensity);
          }
        }
      }
    }
  }
}

function drawRope(x1, y1, x2, y2, sag, s) {
  ctx.strokeStyle = "#b08850";
  ctx.lineWidth = Math.max(1.5, 2.4 * s);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 + sag, x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x2, y2, 9 * s, 5.5 * s, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawChute(e) {
  const s = e.s;
  const doc = e.doc;
  const R = 58 * s;
  const sx = doc.x + 2 * s;
  const sy = doc.y - doc.alt - 58 * s;
  const cy = sy - 95 * s;

  ctx.strokeStyle = "rgba(236,227,196,.7)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  [-1, -0.5, 0.5, 1].forEach((k) => {
    ctx.moveTo(doc.x + k * R, cy);
    ctx.lineTo(sx, sy);
  });
  ctx.stroke();

  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 ? "#b3281c" : "#e9e2c8";
    ctx.beginPath();
    ctx.moveTo(doc.x, cy);
    ctx.arc(doc.x, cy, R, Math.PI + (i * Math.PI) / 6, Math.PI + ((i + 1) * Math.PI) / 6);
    ctx.closePath();
    ctx.fill();
  }
}

function drawEventFx() {
  if (!ev) return;

  const e = ev;
  const s = e.s;
  const { v, w1, w2, doc, sh } = e;

  // green healing glow around the saved villager
  if (e.landed) {
    const gt = e.t - e.tLand;
    if (gt < 3) {
      const a = Math.min(1, gt * 3) * Math.max(0, 1 - gt / 3);
      const gx = v.x + 30 * s;
      const gy = e.y - 25 * s;
      const g = ctx.createRadialGradient(gx, gy, 5, gx, gy, 140 * s);
      g.addColorStop(0, `rgba(110,255,160,${0.4 * a})`);
      g.addColorStop(1, "rgba(110,255,160,0)");
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = g;
      ctx.fillRect(gx - 150 * s, gy - 150 * s, 300 * s, 300 * s);
      ctx.restore();
    }
  }

  // parachute: open in the air, crumpled on the ground afterwards
  if (e.chute && !doc.hidden) drawChute(e);

  if (e.chuteDown) {
    const a = Math.max(0, 1 - e.chuteDown.t / 3);
    ctx.fillStyle = `rgba(226,214,180,${0.8 * a})`;
    ctx.beginPath();
    ctx.ellipse(e.chuteDown.x, e.y, 50 * s, 10 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(179,40,28,${0.8 * a})`;
    ctx.beginPath();
    ctx.ellipse(e.chuteDown.x + 12 * s, e.y - 2 * s, 20 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // shockwave rings when the doctor lands
  if (e.ring) {
    [0, 0.25].forEach((delay) => {
      const rt = e.ring.t - delay;
      if (rt <= 0) return;
      const r = rt * 300 * s;
      const a = Math.max(0, 1 - rt / 1.4);
      ctx.strokeStyle = `rgba(120,255,170,${0.8 * a})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(doc.x, e.y, r, r * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  // sheriff's lasso
  if (e.arrived) {
    const ta = e.t - e.tA;
    const dirS = sh.dir || 1;
    const hx = sh.x + 18 * s * dirS;
    const hy = sh.y - 54 * s;

    // spinning loop before each throw
    if (ta < 0.4 || (ta > 0.9 && ta < 1.1)) {
      ctx.strokeStyle = "#b08850";
      ctx.lineWidth = Math.max(1.5, 2.4 * s);
      ctx.beginPath();
      ctx.ellipse(hx + 6 * s, hy - 14 * s, 14 * s, 5 * s, Math.sin(clock * 12) * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    [[w2, 0.4, 0.9], [w1, 1.1, 1.6]].forEach(([w, t0, t1]) => {
      if (ta < t0) return;
      const [nx, ny] = neck(w, s);
      const pr = Math.min(1, (ta - t0) / (t1 - t0));
      const ex = hx + (nx - hx) * pr;
      const ey = hy + (ny - hy) * pr - Math.sin(pr * Math.PI) * 45 * s;
      drawRope(hx, hy, ex, ey, pr < 1 ? -20 * s : 14 * s, s);
    });
  }
}

// ---------- Frame ----------

function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, groundY);
  g.addColorStop(0, mix("#050a09", "#1d0705", blood));
  g.addColorStop(1, mix("#15251d", "#4a140d", blood));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, groundY + 2);
}

function drawStars(time) {
  ctx.fillStyle = "#ece3c4";
  for (const s of stars) {
    ctx.globalAlpha = (0.35 + 0.65 * Math.abs(Math.sin(time * s.sp + s.ph))) * (1 - blood * 0.5);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawMoon() {
  const r = Math.min(W, H) * 0.075 + 8;
  const x = W * 0.8;
  const y = H * 0.17;
  const col = mix("#ece3c4", "#d2432f", blood);

  const glow = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 4.5);
  glow.addColorStop(0, mix("#ece3c4", "#d2432f", blood).replace("rgb", "rgba").replace(")", ",.28)"));
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);

  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(0,0,0,.08)";
  [[-0.3, -0.2, 0.22], [0.25, 0.15, 0.3], [-0.1, 0.4, 0.14]].forEach(([dx, dy, k]) => {
    ctx.beginPath();
    ctx.arc(x + dx * r, y + dy * r, k * r, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawGround() {
  const g = ctx.createLinearGradient(0, groundY, 0, H);
  g.addColorStop(0, mix("#0b140f", "#1a0b08", blood));
  g.addColorStop(1, "#040806");
  ctx.fillStyle = g;
  ctx.fillRect(0, groundY, W, H - groundY);
}

function drawFog(time) {
  for (let i = 0; i < 3; i++) {
    const w = W * 0.9;
    const x = (((time * (8 + i * 6) + i * W * 0.4) % (W + w)) - w);
    const y = groundY - 10 + i * 24;
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, "rgba(170,190,180,0)");
    g.addColorStop(0.5, "rgba(170,190,180,0.07)");
    g.addColorStop(1, "rgba(170,190,180,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y - 24, w, 48);
  }
}

function drawVignette() {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(${Math.round(blood * 60)},0,0,0.65)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

let last = performance.now();
let clock = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;

  intensity += (intensityTarget - intensity) * Math.min(1, dt * 1.5);
  blood += (bloodTarget - blood) * Math.min(1, dt * 1.2);

  updateEvent(dt);
  updateParts(dt);

  spawnIn -= dt;
  if (spawnIn <= 0) {
    spawnGroup();
    spawnIn = rand(3.2, 6) / (1 + intensity * 1.6);
  }

  const boost = 1 + intensity * 0.6;
  for (const a of actors) {
    const sp = a.speed * boost;
    a.x += sp * dt;
    a.phase += dt * (a.type === "w" ? 10 + sp / 40 : 9 + sp / 45);
  }
  actors = actors.filter((a) => a.x < W + 320);

  drawSky();
  drawStars(clock);
  drawMoon();
  drawLayer(layers[0], clock);
  drawLayer(layers[1], clock);
  drawGround();
  drawFog(clock);

  const sorted = actors.concat(ev ? ev.list : []).sort((a, b) => a.y - b.y);
  for (const a of sorted) {
    if (a.hidden) continue;
    const s = unit * (0.8 + 0.7 * a.d);
    if (a.type === "w") drawWolf(a, s);
    else drawVillager(a, s);
  }

  drawEventFx();
  drawParts();

  drawLayer(layers[2], clock);
  drawVignette();

  requestAnimationFrame(frame);
}

window.addEventListener("resize", resize);
resize();

// pre-populate so the scene is alive on load
for (let i = 0; i < 3; i++) spawnGroup(rand(0, W * 0.8));
spawnIn = 1.5;
requestAnimationFrame(frame);

// ===============================
// Screens
// ===============================

const pages = document.querySelectorAll(".page");

function showPage(id) {
  pages.forEach((p) => p.classList.remove("active"));
  $(id).classList.add("active");
  if (MOODS[id]) setMood(id);
}

// ===============================
// Game
// ===============================

let deck = [];
let currentPlayer = 0;

const card = $("card");
const cardBack = $("cardBack");
const hideBtn = $("hideBtn");

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function createDeck() {
  deck = [];

  for (let i = 1; i <= wolves; i++) {
    deck.push({
      role: "Wolf",
      cls: "role-wolf",
      wolfNumber: i,
      emoji: "🐺",
      description: `You are Wolf ${i}. Work with the other wolves every night.`
    });
  }

  for (let i = 0; i < villagers; i++) {
    deck.push({
      role: "Villager",
      cls: "role-villager",
      emoji: "🧑",
      description: "Find and eliminate every wolf."
    });
  }

  if ($("doctor").checked) {
    deck.push({
      role: "Doctor",
      cls: "role-doctor",
      emoji: "🩺",
      description: "Choose one player to protect every night."
    });
  }

  if ($("sheriff").checked) {
    deck.push({
      role: "Sheriff",
      cls: "role-sheriff",
      emoji: "⭐",
      description: "Investigate one player every night."
    });
  }

  shuffle(deck);
}

let shuffleTimer = null;

$("startBtn").onclick = () => {
  initAudio();

  createDeck();
  currentPlayer = 0;

  if (!ev) startRescue();

  showPage("shuffle");
  shuffleSound();
  setTimeout(() => howl(0.28, 3.2, 1), 300);

  clearTimeout(shuffleTimer);
  shuffleTimer = setTimeout(loadPlayer, 2800);
};

function loadPlayer() {
  showPage("player");

  $("playerNumber").textContent = "Player " + (currentPlayer + 1);

  card.classList.remove("flip");
  hideBtn.classList.add("hidden");
}

card.onclick = () => {
  if (card.classList.contains("flip")) return;

  const r = deck[currentPlayer];

  $("role").textContent = r.role === "Wolf" ? `Wolf ${r.wolfNumber}` : r.role;
  $("emoji").textContent = r.emoji;
  $("description").textContent = r.description;

  cardBack.className = "card-back " + r.cls;

  card.classList.add("flip");
  hideBtn.classList.remove("hidden");

  flipSound();

  if (r.role === "Wolf") {
    setMood("wolfReveal");
    setTimeout(() => { thud(0.5); howl(0.3, 2.4, 1.05); }, 450);
  } else {
    setMood("goodReveal");
    goodChime();
  }
};

hideBtn.onclick = () => {
  currentPlayer++;

  if (currentPlayer >= deck.length) {
    showPage("finish");
    howl(0.32, 3.8, 0.95);
    return;
  }

  $("nextPlayer").textContent = "Give the phone to Player " + (currentPlayer + 1);
  showPage("pass");
};

$("continueBtn").onclick = loadPlayer;

$("restartBtn").onclick = () => showPage("setup");

// ---------- Rules (English / Arabic) ----------

function setLang(lang) {
  const ar = lang === "ar";

  $("rulesEn").hidden = ar;
  $("rulesAr").hidden = !ar;
  $("langEn").classList.toggle("active", !ar);
  $("langAr").classList.toggle("active", ar);
  $("rules").classList.toggle("ar", ar);
  $("rulesTitle").textContent = ar ? "القواعد" : "Rules";
  $("rulesBack").textContent = ar ? "رجوع" : "Back";
  $("rulesBody").scrollTop = 0;
}

$("langEn").onclick = () => setLang("en");
$("langAr").onclick = () => setLang("ar");

$("rulesBtn").onclick = () => {
  setLang("en");
  showPage("rules");
};

$("rulesBack").onclick = () => showPage("setup");

$("homeBtn").onclick = () => {
  const inGame = ["shuffle", "player", "pass"].some((id) =>
    $(id).classList.contains("active")
  );

  if (inGame && !confirm("Return to the home page?\n\nThe current game will be lost.")) return;

  clearTimeout(shuffleTimer);
  showPage("setup");

  currentPlayer = 0;
  deck = [];
  card.classList.remove("flip");
  hideBtn.classList.add("hidden");
};
