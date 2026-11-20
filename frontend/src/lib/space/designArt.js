/* Cartoon space art: pure SVG-string generators extracted from docs/space-design-system.html. */

/* ---------- tokens ---------- */
const C = {
  bg: '#2a2544', bgDeep: '#1b1636', bokeh: '#3a3460', dashTrack: '#5a4f9a',
  v700: '#4a35c9', v500: '#7b4dff', v300: '#b79bff', v100: '#e8dcff',
  b500: '#2f6bff', b400: '#4f8bff', b300: '#6fa8ff', b100: '#bfe3ff',
  o500: '#ff9f1c', o600: '#ff6a3d', r500: '#e8344a', r700: '#b8283a', y400: '#ffd23f', y200: '#fff1a8',
  rockL: '#f4f2ec', rockM: '#cfcdc6', rockD: '#8f8f98', brown: '#a8744f', brownD: '#7c5237',
  sea: '#2a63d6', seaL: '#3d8bff', green: '#5fd36b', greenD: '#3fae55',
  moon: '#efe9d6', moonD: '#cfc7ae', pink: '#ff6fae', white: '#ffffff'
};
const f = (n) => +n.toFixed(2);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = (x) => x * x * (3 - 2 * x);
const loop = (t, period, phase = 0) => (((t / period) + phase) % 1 + 1) % 1;
let seedv = 7; const rnd = () => (seedv = (seedv * 16807) % 2147483647) / 2147483647;

/* ---------- primitives (flat) ---------- */
const pill = (x, y, w, h, fill, op = 1) => `<rect x="${f(x)}" y="${f(y)}" width="${f(Math.max(w, 0.1))}" height="${f(h)}" rx="${f(h / 2)}" fill="${fill}" opacity="${f(op)}"/>`;
const poly = (pts, fill, op = 1) => `<polygon points="${pts.map((p) => p.map(f).join(',')).join(' ')}" fill="${fill}" opacity="${op}"/>`;
const circ = (cx, cy, r, fill, op = 1) => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${fill}" opacity="${op}"/>`;
let clipN = 0; const cid = () => `c${clipN++ % 4000}`;

/** Flat sphere: dark base + lighter disc offset toward the light, clipped to the base (crescent shade). */
function sphere(cx, cy, r, dark, light, k = 0.2, ang = -2.35) {
  const id = cid(), dx = Math.cos(ang) * r * k, dy = Math.sin(ang) * r * k;
  return `<clipPath id="${id}"><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"/></clipPath>` +
    circ(cx, cy, r, dark) + `<g clip-path="url(#${id})">${circ(cx + dx, cy + dy, r * 1.02, light)}</g>`;
}
/** Soft flat shadow over a sphere: the part of the sphere not covered by an offset copy of itself. */
function shade(cx, cy, r, ang, color = C.bgDeep, op = 0.28, k = 0.3) {
  const id = cid(), dx = Math.cos(ang) * r * k, dy = Math.sin(ang) * r * k;
  const c1 = `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
  const c2 = `M${f(cx + dx - r)} ${f(cy + dy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
  return `<clipPath id="${id}"><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"/></clipPath><path clip-path="url(#${id})" d="${c1}${c2}" fill-rule="evenodd" fill="${color}" opacity="${op}"/>`;
}
/** Rays as rounded dashes around a centre, like the streak dashes. */
function rays(cx, cy, r0, n, t, long, short, fill, spin = 6) {
  let o = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 360 + t * spin, len = i % 2 ? short : long;
    o += `<g transform="rotate(${f(a)} ${f(cx)} ${f(cy)})">${pill(cx + r0, cy - 3.5, len, 7, fill)}</g>`;
  }
  return o;
}

/* ---------- streak system (reference style) ---------- */
function bodyPath(len, h) {
  const r = h / 2, tl = h * 0.22;
  return `M0 ${f(-r)}L${f(-len)} ${f(-tl)}Q${f(-len - h * 0.5)} 0 ${f(-len)} ${f(tl)}L0 ${f(r)}A${f(r)} ${f(r)} 0 0 0 0 ${f(-r)}Z`;
}
function dashes(len, h, colors, t, speed = 34) {
  let o = ''; const span = len * 1.6;
  const rows = [[-1.05, 0.0], [1.05, 0.4], [-1.55, 0.7], [1.6, 0.15], [-0.62, 0.55], [0.64, 0.85]];
  rows.forEach(([row, ph], i) => {
    for (let k = 0; k < 3; k++) {
      const x = -(((k * 0.34 + ph) * span + t * speed) % span);
      const taper = clamp(1 - Math.abs(x) / span, 0.15, 1);
      const w = (6 + 12 * ((i + k) % 3 === 0 ? 1 : 0.5)) * taper + 3;
      o += pill(x - w, row * h * 0.72 - h * 0.12, w, h * 0.22, colors[(i + k) % colors.length], 0.4 + 0.6 * taper);
    }
  });
  return o;
}
/** Three-band capsule: outer / middle / core, plus a head. */
function streak({ len, h, bands, dash, head, t }) {
  return dashes(len, h, dash, t) +
    `<path d="${bodyPath(len, h)}" fill="${bands[0]}"/>` +
    `<path d="${bodyPath(len * 0.9, h * 0.62)}" fill="${bands[1]}"/>` +
    `<path d="${bodyPath(len * 0.72, h * 0.28)}" fill="${bands[2]}"/>` + head;
}
const glowHead = (h, ring, core) => `${circ(-h * 0.1, 0, h * 0.5, ring)}<ellipse cx="${f(-h * 0.12)}" cy="0" rx="${f(h * 0.36)}" ry="${f(h * 0.26)}" fill="${core}"/>`;
function rockHead(h, light, mid, dark) {
  const s = h * 0.62;
  return `<g transform="translate(${f(-h * 0.05)} 0)">` +
    poly([[-s, -s * 0.2], [-s * 0.3, -s * 0.9], [s * 0.5, -s * 0.6], [s, 0], [s * 0.5, s * 0.8], [-s * 0.4, s * 0.85]], mid) +
    poly([[-s * 0.3, -s * 0.9], [s * 0.5, -s * 0.6], [s * 0.1, -s * 0.05], [-s * 0.5, -s * 0.2]], light) +
    poly([[s * 0.1, -s * 0.05], [s, 0], [s * 0.5, s * 0.8], [-s * 0.1, s * 0.4]], dark) + `</g>`;
}
function gemHead(h) {
  const s = h * 0.6;
  return `<g transform="translate(${f(-h * 0.02)} 0)">` +
    poly([[-s, 0], [-s * 0.35, -s], [s * 0.7, -s * 0.75], [s, 0.1 * s], [s * 0.35, s], [-s * 0.55, s * 0.8]], C.b400) +
    poly([[-s * 0.35, -s], [s * 0.7, -s * 0.75], [s * 0.15, -s * 0.05], [-s * 0.55, -s * 0.15]], C.b100) +
    poly([[s * 0.15, -s * 0.05], [s, 0.1 * s], [s * 0.35, s], [-s * 0.2, s * 0.35]], C.b500) + `</g>`;
}
const STREAKS = {
  comet: (t) => streak({ len: 78, h: 15, t, bands: [C.v500, C.b500, C.b300], dash: [C.v500, C.b400, C.b300], head: glowHead(15, C.b300, C.white) }),
  meteor: (t) => streak({ len: 64, h: 14, t, bands: [C.r500, C.o600, C.y400], dash: [C.r500, C.o600, C.o500], head: glowHead(14, C.rockL, C.white) }),
  meteorite: (t) => streak({ len: 84, h: 22, t, bands: [C.r500, C.rockL, C.o500], dash: [C.r500, C.o600, C.o500], head: rockHead(22, C.brown, C.brownD, '#5e3c27') }),
  fireball: (t) => streak({ len: 92, h: 26, t, bands: [C.o500, C.y400, C.y200], dash: [C.o500, C.y400, C.o600], head: circ(-2, 0, 15, C.o600) + circ(-6, -4, 4.2, C.r500) + circ(5, 5, 3, C.r500) + circ(-3, 7, 2.2, C.r500) }),
  meteoroid: (t) => streak({ len: 70, h: 16, t, bands: [C.v300, C.v100, C.white], dash: [C.v300, C.v100, C.b400], head: gemHead(16) })
};
function asteroid(t, s = 1) {
  const r = (t * 14) % 360;
  const L = [[-24, -8], [-10, -26], [10, -22], [26, -4], [14, 18], [-12, 22]];
  const a = poly(L, C.rockM), b = poly([[-10, -26], [10, -22], [4, -2], [-18, -6]], C.rockL), c = poly([[4, -2], [26, -4], [14, 18], [-2, 10]], C.rockD), d = poly([[-18, -6], [4, -2], [-2, 10], [-12, 22], [-24, -8]], '#b8b8b2');
  const crater = circ(-4, 4, 4.2, C.rockD, .55) + circ(10, -10, 2.6, C.rockD, .5);
  const chips = poly([[-40, -26], [-34, -30], [-30, -23], [-37, -20]], C.rockL) + poly([[-46, -10], [-42, -14], [-39, -8]], C.rockM) + poly([[34, 26], [41, 22], [43, 30], [36, 33]], C.rockD);
  return `<g transform="scale(${s}) rotate(${f(r)})">${a}${d}${b}${c}${crater}</g><g transform="scale(${s})">${chips}</g>`;
}

/* entity poses (same maths as the app: straight line for comets) */
function place(x, y, rot, scale, body, op = 1) { return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${f(scale)})" opacity="${f(op)}">${body}</g>`; }
const fadeIO = (u) => Math.min(1, u * 8, (1 - u) * 8);
/**
 * One comet entity = ONE comet. When it is visualised the app fans it out into a shower:
 * several copies on parallel straight lanes, each with its own size, speed and start time, so the scene
 * is never empty and never repetitive. All copies share one direction (real, straight trajectories).
 */
const SHOWER = [[0, 0.00, 1.25, 1.00], [-13, 0.31, 0.80, 0.92], [14, 0.57, 0.95, 1.08], [-27, 0.12, 0.65, 1.15], [28, 0.78, 0.70, 0.88], [-6, 0.46, 0.55, 1.22], [7, 0.90, 0.60, 0.95]];
function cometShower(t, scale) {
  const vx = -124, vy = 124, len = Math.hypot(vx, vy), px = -vy / len, py = vx / len;
  return SHOWER.map(([lane, phase, sz, speed], i) => {
    const u = loop(t * speed, 4.4, phase);
    return place(112 + vx * u + px * lane, -12 + vy * u + py * lane, 135, scale * sz, STREAKS.comet(t + i * 0.7), fadeIO(u));
  }).join('');
}
function flyer(kind, t, scale) {
  const u = loop(t, 5);
  const fn = STREAKS[kind];
  if (kind === 'comet') return cometShower(t, scale);
  const dirs = { meteor: [-1, 0.9], meteorite: [-1, 0.55], fireball: [-1, 0.7], meteoroid: [-1, 0.45] };
  const [dx, dy] = dirs[kind]; const ang = Math.atan2(dy, dx) * 180 / Math.PI;
  const x0 = 120, y0 = 8 + { meteor: 0, meteorite: 30, fireball: 12, meteoroid: 36 }[kind];
  return place(x0 + dx * 140 * u, y0 + dy * 140 * u, ang, scale, fn(t), fadeIO(u));
}

/* ---------- other entities ---------- */
function rocket(t) {
  const fl = 1 + 0.22 * Math.sin(t * 28), fl2 = 1 + 0.3 * Math.sin(t * 36 + 1);
  return `<g>
    ${pill(-22, 28, 7, 22 * fl, C.o500, .55)}${pill(15, 28, 7, 22 * fl2, C.o500, .55)}${pill(-3, 38, 6, 30 * fl, C.v300, .55)}
    <path d="M-7 22 Q0 ${f(52 * fl)} 7 22Z" fill="${C.r500}"/><path d="M-4.6 22 Q0 ${f(42 * fl2)} 4.6 22Z" fill="${C.o500}"/><path d="M-2.4 22 Q0 ${f(32 * fl)} 2.4 22Z" fill="${C.y400}"/>
    <path d="M-10 6 L-22 24 L-10 20Z" fill="${C.r700}"/><path d="M10 6 L22 24 L10 20Z" fill="${C.r500}"/>
    <path d="M0 -34 C13 -22 14 0 11 22 L-11 22 C-14 0 -13 -22 0 -34Z" fill="${C.rockL}"/>
    <path d="M0 -34 C13 -22 14 0 11 22 L2 22 C6 4 5 -20 0 -34Z" fill="${C.rockM}"/>
    <path d="M0 -34 C7 -28 10.5 -20 12 -14 L-12 -14 C-10.5 -20 -7 -28 0 -34Z" fill="${C.r500}"/>
    ${circ(0, -2, 7.5, C.v500)}${circ(0, -2, 5, C.b500)}${circ(-1.8, -3.8, 1.8, C.b100)}
    <rect x="-11" y="19" width="22" height="5" rx="2.5" fill="${C.rockD}"/></g>`;
}
function astronaut(t) {
  const w = Math.sin(t * 2.4), arm = 14 + 8 * w;
  return `<g>
    <path d="M-14 24 Q-30 34 -44 28" stroke="${C.dashTrack}" stroke-width="3" stroke-dasharray="6 5" stroke-linecap="round" fill="none"/>
    <rect x="-23" y="-8" width="12" height="26" rx="5" fill="${C.rockM}"/><rect x="-23" y="-8" width="6" height="26" rx="3" fill="${C.rockD}"/>
    ${pill(-5, 16, 8, 24, C.rockL)}${pill(5, 16 + 2 * w, 8, 24, C.rockM)}${pill(-5, 34, 9, 6, C.o500)}${pill(5, 34 + 2 * w, 9, 6, C.o500)}
    <rect x="-15" y="-10" width="30" height="32" rx="12" fill="${C.rockL}"/><path d="M5 -10 H3 A12 12 0 0 1 15 2 V10 A12 12 0 0 1 3 22 H5 A12 12 0 0 0 15 10 V2 A12 12 0 0 0 5 -10Z" fill="${C.rockM}"/>
    <g transform="rotate(${f(-50 + arm)} 14 -2)">${pill(12, -6, 24, 9, C.rockL)}${pill(30, -6, 8, 9, C.o500)}</g>
    <g transform="rotate(${f(20 - arm * 0.6)} -14 -2)">${pill(-36, -6, 24, 9, C.rockM)}${pill(-36, -6, 8, 9, C.o500)}</g>
    ${circ(0, -20, 16, C.rockL)}${circ(0, -20, 16, C.rockM, .0)}<path d="M5 -35 A16 16 0 0 1 5 -5 A12 16 0 0 0 5 -35Z" fill="${C.rockM}"/>
    <rect x="-10.5" y="-27" width="21" height="14" rx="7" fill="${C.v700}"/>${pill(-6.5, -24.5, 9, 3.6, C.b300)}${circ(5, -17, 1.5, C.b300)}
    ${circ(0, 8, 2.6, C.r500)}${circ(7, 8, 2.6, C.y400)}</g>`;
}
function satellite(t) {
  const blink = Math.sin(t * 5) > 0.2 ? C.r500 : C.r700;
  const panel = (x) => `<rect x="${x}" y="-12" width="28" height="24" rx="3" fill="${C.b500}"/>` + [0, 1, 2].map((i) => `<rect x="${x + 2 + i * 8.6}" y="-10" width="6.6" height="20" rx="2" fill="${C.b400}"/>`).join('') + `<rect x="${x}" y="-12" width="28" height="4" rx="2" fill="${C.b300}" opacity=".55"/>`;
  return `<g>${pill(-34, -1.5, 14, 3, C.rockD)}${pill(20, -1.5, 14, 3, C.rockD)}${panel(-62)}${panel(34)}
    <rect x="-20" y="-16" width="40" height="32" rx="7" fill="${C.o500}"/><rect x="2" y="-16" width="18" height="32" rx="7" fill="${C.o600}"/>${pill(-20, -3, 40, 6, C.y400)}
    ${circ(0, 0, 6, C.rockL)}${circ(0, 0, 3, C.v500)}
    <path d="M-6 -16 L-6 -26 Q0 -34 6 -26 L6 -16Z" fill="${C.rockL}"/>${pill(-1.2, -40, 2.4, 14, C.rockD)}${circ(0, -41, 2.6, blink)}</g>`;
}
function probe(t) {
  return `<g>
    ${pill(-60, -2.2, 34, 4.4, C.rockD)}${circ(-62, 0, 4.2, C.o500)}
    <rect x="-30" y="-14" width="14" height="28" rx="3" fill="${C.b500}"/><rect x="-30" y="-14" width="14" height="6" rx="3" fill="${C.b300}" opacity=".6"/>
    <path d="M-14 0 Q-4 -26 20 -30 L20 30 Q-4 26 -14 0Z" fill="${C.rockL}"/><path d="M-14 0 Q-4 -26 20 -30 L12 -2 Q2 0 -14 0Z" fill="${C.rockM}" opacity="0"/>
    <path d="M6 -30 L20 -30 L20 30 L6 29 Q14 0 6 -30Z" fill="${C.rockM}"/>
    <ellipse cx="20" cy="0" rx="9" ry="30" fill="${C.rockM}"/><ellipse cx="22" cy="0" rx="6" ry="25" fill="${C.rockL}"/>
    ${pill(26, -2.5, 28, 5, C.rockD)}${circ(56, 0, 4 + 1.4 * Math.sin(t * 5), C.r500)}
    <rect x="-8" y="8" width="16" height="12" rx="3" fill="${C.v500}" transform="translate(-8 14)"/></g>`;
}
function orbitPose(kind, t) {
  const u = loop(t, 6);
  if (kind === 'rocket') return place(50, 108 - 150 * ease(u), 0, 0.42, rocket(t), fadeIO(u));
  if (kind === 'astronaut') return place(50 + 22 * Math.sin(u * 6.28), 52 + 7 * Math.sin(u * 12.56), 18 * Math.sin(u * 6.28), 0.55, astronaut(t));
  if (kind === 'satellite') { const a = u * 6.28; return place(50 + 36 * Math.cos(a), 50 + 18 * Math.sin(a), 0, 0.42 + 0.08 * Math.sin(a), satellite(t)); }
  return place(10 + 80 * u, 36 - 14 * u, 8 * Math.sin(u * 6), 0.5 - 0.12 * u, probe(t), fadeIO(u));
}

/* ---------- Orb forms ---------- */
const eyes = (dark) => `${pill(174, 182, 12, 32, dark ? C.bgDeep : '#f3f0ff')}${pill(214, 182, 12, 32, dark ? C.bgDeep : '#f3f0ff')}`;
function earthLand(cx, cy, r, t, speed) {
  const k = r / 50, d = ((t * speed) % 200 + 200) % 200;
  const strip = `<path d="M-80 -10C-70 -30 -40 -32 -28 -18C-20 -8 -30 0 -38 6C-48 14 -60 26 -66 18C-74 10 -86 0 -80 -10Z M-10 -28C0 -36 24 -34 34 -22C44 -12 40 0 30 4C22 8 20 22 10 30C0 36 -10 24 -8 12C-6 2 -18 -6 -10 -28Z M50 -20C62 -28 86 -22 92 -8C96 4 82 12 70 10C58 8 44 0 50 -20Z" fill="${C.green}"/><path d="M-10 -28C0 -36 24 -34 34 -22C30 -20 14 -18 4 -14C-4 -10 -8 -16 -10 -28Z" fill="${C.greenD}" opacity=".0"/>` + circ(60, 30, 5, C.green) + circ(-50, -38, 4, C.green);
  return `<g transform="translate(${f(cx)} ${f(cy)}) scale(${f(k)})"><g transform="translate(${f(d - 100)} 0)">${strip}</g><g transform="translate(${f(d - 300)} 0)">${strip}</g><g transform="translate(${f(d + 100)} 0)">${strip}</g></g>`;
}
const FORMS = {
  sun: (t) => `${rays(200, 200, 104, 16, t, 30, 16, C.o500)}${rays(200, 200, 104, 16, t + 1.5, 0, 0, C.o500)}` +
    sphere(200, 200, 88, C.o500, C.y400, 0.18) + circ(168, 168, 22, C.y200, .55) + circ(238, 236, 10, C.o600, .45) + circ(160, 236, 7, C.o600, .4) + circ(246, 168, 6, C.o600, .4) +
    `<ellipse cx="146" cy="224" rx="12" ry="7" fill="${C.o600}" opacity=".55"/><ellipse cx="254" cy="224" rx="12" ry="7" fill="${C.o600}" opacity=".55"/>` + eyes(true),
  earth: (t) => { const id = cid();
    return circ(200, 200, 98, C.b300, .22) + sphere(200, 200, 88, C.sea, C.seaL, 0.16) +
      `<clipPath id="${id}"><circle cx="200" cy="200" r="88"/></clipPath><g clip-path="url(#${id})">${earthLand(200, 200, 88, t, 9)}` +
      [0, 1, 2].map((i) => { const x = ((t * (14 + i * 5) + i * 120) % 360) - 20; return pill(x - 60 + 40, 120 + i * 62, 46 + i * 10, 13, C.white, .88); }).join('') + `</g>` +
      shade(200, 200, 88, -2.35, C.bgDeep, .3) + eyes(true); },
  moon: (t) => { const id = cid(), w = Math.sin(t * 0.5) * 3;
    return sphere(200, 200, 88, C.moonD, C.moon, 0.16) + `<clipPath id="${id}"><circle cx="200" cy="200" r="88"/></clipPath>` +
      `<g clip-path="url(#${id})" transform="rotate(${f(w)} 200 200)">${circ(150, 160, 17, C.moonD)}${circ(152, 162, 12, '#b9b095', .6)}${circ(250, 150, 11, C.moonD)}${circ(264, 232, 19, C.moonD)}${circ(268, 234, 13, '#b9b095', .6)}${circ(160, 258, 12, C.moonD)}${circ(212, 108, 8, C.moonD)}${circ(120, 214, 7, C.moonD)}</g>` +
      shade(200, 200, 88, -2.35, C.bgDeep, .26) + eyes(true); },
  galaxy: (t) => { const id = cid();
    let arms = '';
    [[C.v500, 0], [C.pink, 1.57], [C.b400, 3.14], [C.v300, 4.71]].forEach(([col, a0], ai) => {
      let d = ''; for (let i = 0; i <= 40; i++) { const u = i / 40, a = a0 + u * 3.6 + t * 0.35, r = 8 + u * 84; d += `${i ? 'L' : 'M'}${f(200 + Math.cos(a) * r)} ${f(200 + Math.sin(a) * r)}`; }
      arms += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${ai % 2 ? 7 : 10}" stroke-linecap="round" stroke-dasharray="26 11" stroke-dashoffset="${f(-t * 9)}"/>`;
    });
    return circ(200, 200, 88, '#2b1f6e') + `<clipPath id="${id}"><circle cx="200" cy="200" r="88"/></clipPath><g clip-path="url(#${id})">${arms}${circ(200, 200, 20, C.y400)}${circ(200, 200, 11, C.y200)}` +
      [[150, 130], [262, 150], [140, 250], [270, 262], [196, 110], [226, 288]].map(([x, y], i) => circ(x, y, 2.4 + (i % 2), C.white, .7 + 0.3 * Math.sin(t * 3 + i))).join('') + `</g>` + circ(200, 200, 88, 'none') + eyes(false); },
  blackhole: (t) => {
    const ring = (w, col, op = 1, part = 'all') => {
      const d = part === 'top' ? 'M70 200A130 40 0 0 1 330 200' : part === 'bottom' ? 'M70 200A130 40 0 0 0 330 200' : 'M70 200A130 40 0 1 1 330 200A130 40 0 1 1 70 200Z';
      return `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" opacity="${op}" transform="rotate(-14 200 200)"/>`;
    };
    const lens = (w, col) => `<path d="M126 196A74 74 0 0 1 274 196" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
    const dots = [0, 1, 2, 3, 4, 5].map((i) => { const a = t * 1.3 + i * 1.05; return `<g transform="rotate(-14 200 200)">${pill(200 + Math.cos(a) * 140 - 8, 200 + Math.sin(a) * 44 - 2.5, 16, 5, i % 2 ? C.y400 : C.o500, Math.sin(a) > 0 ? 1 : .0)}</g>`; }).join('');
    return circ(200, 200, 120, C.o600, .1) + ring(34, C.r500, .9) + ring(22, C.o500) + ring(10, C.y400) + ring(3.6, C.white) +
      circ(200, 200, 66, '#0c0818') + circ(200, 200, 68, 'none') + `<circle cx="200" cy="200" r="68" fill="none" stroke="${C.y200}" stroke-width="3" opacity=".9"/>` +
      lens(18, C.o500) + lens(7, C.y400) + ring(22, C.o500, 1, 'bottom') + ring(10, C.y400, 1, 'bottom') + ring(3.6, C.white, 1, 'bottom') + dots + eyes(false); }
};
const FORM_NOTE = { sun: 'Rays are rounded dashes rotating slowly; pink cheeks.', earth: 'Continents slide with the rotation; clouds are rounded white bars.', moon: 'Two-tone craters; gentle 3° wobble.', galaxy: 'Spiral arms are dashed bars running along each arm.', blackhole: 'Four-band accretion disk, light ring bent over the top and bottom.' };

/* ---------- simulations ---------- */
function phaseShape(r, frac, waxing) {
  // lit region seen from Earth: half-disc plus/minus the terminator ellipse
  const rx = Math.abs(1 - 2 * frac) * r, crescent = frac < 0.5;
  const d = `M0 ${-r}A${r} ${r} 0 0 1 0 ${r}A${f(rx)} ${r} 0 0 ${crescent ? 0 : 1} 0 ${-r}Z`;
  return `<path d="${d}" fill="${C.moon}" ${waxing ? '' : 'transform="scale(-1 1)"'}/>`;
}
function starfield(n, seed, w = 200, h = 200) {
  seedv = seed; let o = '';
  for (let i = 0; i < n; i++) o += circ(rnd() * w, rnd() * h, 0.8 + rnd() * 1.4, C.white, .25 + rnd() * .5);
  return o;
}
const SIMS = {
  moon_phases: { cap: (p) => 'The Moon orbits the Earth: the half facing the Sun is always lit', draw: (t, p) => {
    const a = p * 6.283, ex = 112, ey = 104, R = 54, mx = ex - Math.cos(a) * R, my = ey - Math.sin(a) * R;
    const frac = (1 - Math.cos(a)) / 2, waxing = a < Math.PI;
    const toSun = Math.atan2(104 - my, 8 - mx) * 180 / Math.PI;
    const id = cid();
    return rays(8, 104, 40, 12, t, 18, 10, C.o500) + circ(8, 104, 36, C.y400) + circ(0, 96, 24, C.y200, .5) +
      `<circle cx="${ex}" cy="${ey}" r="${R}" fill="none" stroke="${C.dashTrack}" stroke-width="2.4" stroke-dasharray="7 7" stroke-linecap="round"/>` +
      sphere(ex, ey, 17, C.sea, C.seaL, .18) + `<clipPath id="${id}"><circle cx="${ex}" cy="${ey}" r="17"/></clipPath><g clip-path="url(#${id})">${circ(ex - 3, ey - 4, 6, C.green)}${circ(ex + 6, ey + 6, 4, C.green)}</g>` +
      circ(mx, my, 11, '#3b3466') + `<g transform="translate(${f(mx)} ${f(my)}) rotate(${f(toSun)})"><path d="M0 -11A11 11 0 0 0 0 11Z" fill="${C.moon}"/></g>` +
      `<g transform="translate(160 34)">${circ(0, 0, 21, '#3b3466')}${phaseShape(21, frac, waxing)}</g>` + `<text x="160" y="68" fill="${C.v300}" font-size="8.5" font-weight="800" text-anchor="middle">FROM EARTH</text>`; } },
  solar_eclipse: { cap: (p) => 'Solar eclipse: the Moon covers the Sun and its shadow falls on Earth', draw: (t, p) => {
    const mxp = -20 + 140 * p, cover = clamp(1 - Math.abs(mxp - 46) / 26);
    return `<g opacity="${f(1 - cover * 0.5)}">${rays(46, 100, 38, 14, t, 20, 11, C.o500)}</g>` + circ(46, 100, 34, C.y400) + circ(36, 90, 14, C.y200, .45) +
      (cover > .75 ? `<g>${rays(mxp + 20, 100, 22, 18, t * 3, 24, 12, C.white)}</g>` : '') +
      `<path d="M${f(mxp + 14)} 91L172 ${f(100 - 5 - cover * 5)}L172 ${f(100 + 5 + cover * 5)}L${f(mxp + 14)} 109Z" fill="${C.bgDeep}" opacity="${f(0.35 * cover + 0.1)}"/>` +
      sphere(176, 100, 14, C.sea, C.seaL, .18) + circ(176, 100, 14, C.bgDeep, cover > .7 ? .0 : 0) + (cover > .6 ? circ(170, 100, 3.5, C.bgDeep, .65) : '') +
      circ(mxp + 20, 100, 17, '#2d2650') + circ(mxp + 15, 95, 6, '#3b3466'); } },
  lunar_eclipse: { cap: () => 'Lunar eclipse: the Moon enters Earth\'s shadow and turns red', draw: (t, p) => {
    const mx = 190 - 130 * p, depth = clamp(1 - Math.abs(mx - 150) / 30), col = depth > .45 ? C.r700 : C.moon;
    return rays(8, 100, 34, 12, t, 18, 10, C.o500) + circ(8, 100, 30, C.y400) +
      `<path d="M108 84L200 66L200 134L108 116Z" fill="${C.bgDeep}" opacity=".5"/>` +
      sphere(92, 100, 22, C.sea, C.seaL, .18) + circ(86, 94, 7, C.green) + circ(98, 108, 5, C.green) +
      circ(mx, 100, 15, depth > .45 ? '#7a1f2c' : C.moonD) + `<circle cx="${f(mx - 2)}" cy="98" r="14" fill="${col}"/>` + circ(mx + 4, 106, 4, depth > .45 ? '#7a1f2c' : '#b9b095', .7); } },
  solar_system: { cap: () => 'Solar system: shortened periods, distances not to scale', draw: (t, p) => {
    const cols = [C.rockM, C.o500, C.seaL, C.r500, C.o600, C.y400, C.b100, C.v500], rad = [3, 4.6, 5, 3.8, 9, 8, 6, 6];
    let o = rays(100, 100, 16, 14, t, 10, 6, C.o500) + circ(100, 100, 14, C.y400) + circ(96, 96, 6, C.y200, .5);
    cols.forEach((c, i) => {
      const R = 24 + i * 10, per = [0.24, 0.62, 1, 1.88, 11.9, 29.5, 84, 165][i], a = 6.283 * p * (0.5 + 1 / Math.sqrt(per)) + i, x = 100 + Math.cos(a) * R, y = 100 + Math.sin(a) * R;
      o += `<circle cx="100" cy="100" r="${R}" fill="none" stroke="${C.dashTrack}" stroke-width="1.4" stroke-dasharray="4 5" stroke-linecap="round"/>`;
      if (i === 5) o += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${rad[i] * 2.2}" ry="${rad[i] * 0.7}" fill="none" stroke="${C.y200}" stroke-width="2.4" transform="rotate(-18 ${f(x)} ${f(y)})"/>`;
      o += sphere(x, y, rad[i], c, c, 0) + circ(x - rad[i] * .3, y - rad[i] * .3, rad[i] * .5, C.white, .35);
    });
    return o; } },
  day_night: { cap: () => 'Day and night: Earth spins, one half always faces the Sun', draw: (t, p) => {
    const id = cid(), cx = 118, cy = 100, r = 62;
    return rays(-4, 100, 30, 12, t, 16, 9, C.o500) + circ(-4, 100, 28, C.y400) +
      sphere(cx, cy, r, C.sea, C.seaL, .16, Math.PI) + `<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath><g clip-path="url(#${id})">${earthLand(cx, cy, r, t, 14)}` +
      `<rect x="${cx}" y="${cy - r}" width="${r}" height="${2 * r}" fill="${C.bgDeep}" opacity=".62"/>` +
      [[150, 82], [160, 112], [140, 128], [172, 96]].map(([x, y], i) => circ(x, y, 1.8, C.y400, .6 + .4 * Math.sin(t * 3 + i))).join('') + `</g>` +
      `<path d="M${cx} ${cy - r}A${r} ${r} 0 0 1 ${cx} ${cy + r}" fill="none" stroke="${C.y400}" stroke-width="2" opacity=".0"/>` +
      `<text x="86" y="176" fill="${C.y200}" font-size="11" font-weight="800" text-anchor="middle">DAY</text><text x="152" y="176" fill="${C.v300}" font-size="11" font-weight="800" text-anchor="middle">NIGHT</text>`; } },
  seasons: { cap: (p) => ['Spring', 'Summer', 'Autumn', 'Winter'][Math.min(3, Math.floor(p * 4))] + ': the 23.5° axis tilt decides how much sunlight arrives', draw: (t, p) => {
    const a = p * 6.283, ex = 100 + 74 * Math.cos(a), ey = 100 + 40 * Math.sin(a), toSun = Math.atan2(100 - ey, 100 - ex);
    let ghosts = '';
    ['Spring', 'Summer', 'Autumn', 'Winter'].forEach((n, i) => { const g = i * 1.571, gx = 100 + 74 * Math.cos(g), gy = 100 + 40 * Math.sin(g); ghosts += circ(gx, gy, 7, C.bokeh) + `<text x="${f(gx)}" y="${f(gy + (gy > 100 ? 22 : -14))}" fill="${C.v300}" font-size="10" font-weight="800" text-anchor="middle">${n.toUpperCase()}</text>`; });
    return `<ellipse cx="100" cy="100" rx="74" ry="40" fill="none" stroke="${C.dashTrack}" stroke-width="2" stroke-dasharray="6 6" stroke-linecap="round"/>` + ghosts +
      rays(100, 100, 18, 12, t, 12, 7, C.o500) + circ(100, 100, 16, C.y400) + circ(96, 96, 6, C.y200, .5) +
      `<g transform="translate(${f(ex)} ${f(ey)})"><g transform="rotate(23.5)">${pill(-1.5, -22, 3, 44, C.white, .7)}</g>` + sphere(0, 0, 12, C.sea, C.seaL, .2, toSun + Math.PI) + circ(-3, -3, 4, C.green) + `</g>`; } },
  launch: { cap: (p) => p < 0.2 ? 'Countdown… 3, 2, 1' : p < 0.45 ? 'Liftoff! Stage 1 burns with all three engines' : p < 0.52 ? 'Stage 1 separates and falls away' : p < 0.72 ? 'Stage 2 ignites and carries the payload higher' : p < 0.78 ? 'Stage 2 separates' : 'The fairing opens and the satellite is released', draw: (t, p) => {
    const S = 1.05, lift = ease(clamp(p / 0.35)), ry = 134 - 36 * lift, gy = 125 * ease(clamp(p / 0.5));
    const s1 = clamp((p - 0.45) / 0.17), s2 = clamp((p - 0.72) / 0.12), s3 = clamp((p - 0.78) / 0.1), s4 = clamp((p - 0.86) / 0.14);
    const n = p < 0.07 ? '3' : p < 0.14 ? '2' : p < 0.2 ? '1' : '';
    const flick = 1 + 0.2 * Math.sin(t * 30), burn1 = p >= 0.2 && p < 0.45, burn2 = p >= 0.45 && p < 0.72;
    const flame = (x, y, L, cols) => `<path d="M${x - 3.4} ${y}Q${x} ${y + L} ${x + 3.4} ${y}Z" fill="${cols[0]}"/><path d="M${x - 2.2} ${y}Q${x} ${y + L * 0.72} ${x + 2.2} ${y}Z" fill="${cols[1]}"/><path d="M${x - 1.1} ${y}Q${x} ${y + L * 0.44} ${x + 1.1} ${y}Z" fill="${cols[2]}"/>`;
    // ---- scenery
    let o = `<rect x="-10" y="-10" width="220" height="220" fill="${C.bgDeep}" opacity="${f(clamp(lift * 0.55 + (p - 0.35)))}"/>`;
    if (p > 0.25) o += [[24, 30], [168, 22], [180, 90], [18, 96], [150, 60], [52, 70]].map(([x, y], i) => circ(x, y, 1.6 + (i % 2), C.white, .5)).join('');
    if (p > 0.7) { const e = clamp((p - 0.7) / 0.3); o += `<circle cx="100" cy="${f(340 - 70 * e)}" r="170" fill="${C.sea}"/><circle cx="100" cy="${f(340 - 70 * e)}" r="170" fill="none" stroke="${C.b300}" stroke-width="3" opacity=".6"/>`; }
    if (gy < 120) o += `<g transform="translate(0 ${f(gy)})"><path d="M-10 168Q50 154 100 168T210 168V220H-10Z" fill="${C.greenD}"/><path d="M-10 182Q60 170 110 182T210 180V220H-10Z" fill="${C.green}"/>${pill(148, 92, 6, 80, C.rockM)}${pill(134, 100, 20, 4, C.rockD)}${pill(134, 118, 20, 4, C.rockD)}` +
      (p > 0.18 && p < 0.55 ? [0, 1, 2, 3, 4].map((i) => circ(100 + (i - 2) * 15, 172 - (i % 2) * 6, 8 + (i % 3) * 3, C.v100, .45)).join('') : '') + `</g>`;
    // ---- tiers (local origin = interstage ring, nose up)
    const stage1 = `<g>${burn1 ? [-6, 0, 6].map((x) => flame(x, 42, 30 * flick * (0.5 + lift * 0.7), [C.r500, C.o500, C.y400])).join('') : ''}` +
      `<path d="M-10 18L-21 38L-10 33Z" fill="${C.r700}"/><path d="M10 18L21 38L10 33Z" fill="${C.r500}"/>` +
      `<rect x="-10" y="0" width="20" height="35" rx="3" fill="${C.rockL}"/><path d="M2 0H7a3 3 0 0 1 3 3V32a3 3 0 0 1-3 3H2Z" fill="${C.rockM}"/>${pill(-10, 6, 20, 5, C.r500)}${pill(-10, 14, 20, 2.4, C.r700)}` +
      `<rect x="-8" y="35" width="16" height="4" rx="1.5" fill="${C.rockD}"/>${[-6, 0, 6].map((x) => `<rect x="${x - 2}" y="39" width="4" height="4" rx="1" fill="${C.rockD}"/>`).join('')}</g>`;
    const stage2 = `<g>${burn2 ? flame(0, 8, 22 * flick, [C.o500, C.y400, C.white]) : ''}<path d="M-4 0H4L6.5 7H-6.5Z" fill="${C.rockD}"/>` +
      `<rect x="-8" y="-22" width="16" height="23" rx="3" fill="${C.rockL}"/><path d="M1 -22H5a3 3 0 0 1 3 3V-2a3 3 0 0 1-3 3H1Z" fill="${C.rockM}"/>${pill(-8, -15, 16, 4.5, C.o500)}${pill(-8, -8, 16, 2.2, C.o600)}</g>`;
    const half = (sgn) => `<g transform="translate(${f(sgn * s3 * 7)} ${f(-s3 * 3)}) rotate(${f(sgn * s3 * 50)} ${sgn * 8} -22)"><path d="M${sgn * 8} -22C${sgn * 8} -34 ${sgn * 4} -40 0 -46L0 -22Z" fill="${sgn < 0 ? C.v500 : C.v700}"/>${pill(sgn < 0 ? -8 : 1, -30, 7, 3, C.v300, .8)}</g>`;
    const sat = `<g transform="translate(0 ${f(-31 - 26 * s4)})">${pill(-7 - 12 * s4, -1.2, 12 * s4 + 1, 2.4, C.rockD)}${pill(6, -1.2, 12 * s4 + 1, 2.4, C.rockD)}<rect x="${f(-8 - 14 * s4)}" y="-4.5" width="${f(11 * s4 + 0.1)}" height="9" rx="1.5" fill="${C.b500}"/><rect x="${f(8 + 3 * s4)}" y="-4.5" width="${f(11 * s4 + 0.1)}" height="9" rx="1.5" fill="${C.b500}"/><rect x="-5" y="-5" width="10" height="10" rx="2" fill="${C.o500}"/>${circ(0, 0, 2, C.white)}</g>`;
    const at = (x, y, rot, sc, op, body) => op <= 0.02 ? '' : `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${f(sc)})" opacity="${f(op)}">${body}</g>`;
    const puffs = p >= 0.45 && p < 0.55 ? [0, 1, 2, 3, 4, 5].map((i) => { const k = (p - 0.45) / 0.1, a = i * 1.05; return circ(100 + Math.cos(a) * (6 + k * 30), ry + 4 + Math.sin(a) * (4 + k * 14), 3 - k * 1.8, C.white, .8 * (1 - k)); }).join('') : '';
    o += at(100, ry + 160 * s1 * s1, 28 * s1, S, 1 - s1 * s1, stage1) +
         at(100, ry + 120 * s2 * s2, -32 * s2, S, 1 - s2 * s2, stage2) + puffs +
         at(100, ry, 0, S, 1, (s3 < 1 ? '' : '') + half(-1) + half(1) + (s3 > 0 ? sat : `<rect x="-8" y="-22" width="16" height="2" fill="${C.v700}"/>`));
    // ---- tier labels with leader lines
    const lab = (txt, y, active, show) => show ? `<line x1="64" y1="${f(y)}" x2="${f(100 - 14 * S)}" y2="${f(y)}" stroke="${C.dashTrack}" stroke-width="1.6" stroke-dasharray="3 3"/>` + circ(100 - 14 * S, y, 2, active ? C.y400 : C.v300) + `<text x="60" y="${f(y + 3)}" text-anchor="end" fill="${active ? C.y200 : C.v300}" font-size="9" font-weight="800">${txt}</text>` : '';
    o += lab('PAYLOAD', ry - 34 * S, p >= 0.72, true) + lab('STAGE 2', ry - 11 * S + 120 * s2 * s2, p >= 0.45 && p < 0.72, s2 < 0.85) + lab('STAGE 1', ry + 18 * S + 160 * s1 * s1, p < 0.45, s1 < 0.7);
    return o + (n ? `<text x="100" y="62" text-anchor="middle" fill="${C.white}" font-size="44" font-weight="900">${n}</text>` : ''); } },
  gravity: { cap: () => 'Free fall: dropped together, an object takes longer to land on the Moon than on Earth or Jupiter. Faint balls mark equal time steps.', draw: (t, p) => {
    const lanes = [['MOON', 1.6, C.moon, C.moonD], ['EARTH', 9.8, C.seaL, C.sea], ['JUPITER', 24.8, C.o500, C.o600]], c = (p * 3) % 1, y0 = 34, y1 = 132;
    let o = '';
    lanes.forEach(([name, g, col, colD], li) => {
      const x = 38 + li * 62, landT = 0.3 * Math.sqrt(9.8 / g), tau = Math.min(c, landT), d = clamp(Math.pow(tau / landT, 2)), y = y0 + (y1 - y0) * d, landed = c >= landT;
      o += `<rect x="${x - 27}" y="10" width="54" height="178" rx="16" fill="${C.bokeh}" opacity=".35"/>` + pill(x - 9, 18, 18, 4, C.dashTrack) +
        `<path d="M${x - 27} 160Q${x} 146 ${x + 27} 160V188H${x - 27}Z" fill="${col}"/><path d="M${x - 27} 174Q${x} 162 ${x + 27} 174V188H${x - 27}Z" fill="${colD}"/>`;
      for (let k = 1; k * 0.045 < tau; k++) { const tt = k * 0.045, yy = y0 + (y1 - y0) * clamp(Math.pow(tt / landT, 2)); o += circ(x, yy, 7, C.r500, .22) + pill(x + 10, yy - 0.8, 6, 1.6, C.v300, .5); }
      const v = landed ? 0 : 2 * tau / (landT * landT);
      for (let k = 1; k <= 3; k++) o += pill(x - 1.8, y - 10 - k * (4 + v * 5), 3.6, 5 + v * 4, C.v300, clamp(0.7 - k * 0.2) * clamp(v));
      const sq = landed && c < landT + 0.08 ? 1.25 : 1;
      o += `<g transform="translate(${x} ${f(y + 1)}) scale(${sq} ${f(2 - sq)})">${circ(0, 0, 8, C.r500)}${circ(-2.6, -2.6, 2.6, C.white, .6)}</g>`;
      if (landed && c < landT + 0.14) { const k = (c - landT) / 0.14; o += [-1, 1].map((sg) => pill(x + sg * (6 + 16 * k) - 5, y1 + 8 - 5 * k, 10, 3.4, C.white, 0.8 * (1 - k))).join(''); }
      o += `<text x="${x}" y="181" text-anchor="middle" fill="${C.white}" font-size="9.5" font-weight="900">${name}</text><text x="${x}" y="196" text-anchor="middle" fill="${C.v300}" font-size="8.5" font-weight="800">g = ${g}</text>`;
    });
    return o; } },
  tides: { cap: (p) => { const h = Math.cos(2 * (p * 6.283 + 0.7)); return h > 0.55 ? 'High tide: the water rises where you stand' : h < -0.55 ? 'Low tide: the water pulls back' : 'The Moon pulls the sea into a bulge toward it, and Earth spins beneath two bulges of water'; }, draw: (t, p) => {
    const mA = -0.7, cx = 100, cy = 64, R = 26, ob = p * 6.283, h = Math.cos(2 * (ob - mA)), deg = mA * 180 / Math.PI;
    const mx = cx + 62 * Math.cos(mA), my = cy + 62 * Math.sin(mA), id = cid(), pid = cid(), sea = 158 - 18 * h;
    const arrows = (rot) => `<g transform="rotate(${f(rot)} ${cx} ${cy})">${pill(cx + R + 17, cy - 2.2, 15, 4.4, C.y400)}${pill(cx + R + 37, cy - 2.2, 9, 4.4, C.y400, .75)}${pill(cx + R + 51, cy - 2.2, 5, 4.4, C.y400, .5)}</g>`;
    const pin = (x, y) => circ(x, y, 4.6, C.white) + circ(x, y, 3, C.r500);
    return `<ellipse cx="${cx}" cy="${cy}" rx="${R + 11}" ry="${R + 4}" fill="${C.b400}" transform="rotate(${f(deg)} ${cx} ${cy})"/>` +
      `<ellipse cx="${cx}" cy="${cy}" rx="${R + 11}" ry="${R + 4}" fill="none" stroke="${C.b300}" stroke-width="2" stroke-dasharray="6 5" stroke-linecap="round" transform="rotate(${f(deg)} ${cx} ${cy})"/>` +
      arrows(deg) + arrows(deg + 180) +
      sphere(cx, cy, R, C.sea, C.seaL, .16) + `<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath><g clip-path="url(#${id})">${earthLand(cx, cy, R, p, 200)}</g>` +
      pin(cx + R * Math.cos(ob), cy + R * Math.sin(ob)) +
      sphere(mx, my, 10, C.moonD, C.moon, .2) + circ(mx - 2, my + 2, 2.4, C.moonD) +
      `<clipPath id="${pid}"><rect x="14" y="126" width="172" height="66" rx="14"/></clipPath><g clip-path="url(#${pid})">` +
      `<rect x="14" y="126" width="172" height="66" fill="${C.bokeh}" opacity=".7"/>` +
      `${pill(66, 134, 7, 58, C.brownD)}${pill(80, 134, 7, 58, C.brown)}${[0, 1, 2, 3].map((i) => pill(66, 142 + i * 12, 21, 3, C.rockL, .5)).join('')}` +
      `<rect x="14" y="${f(sea)}" width="172" height="${f(192 - sea)}" fill="${C.b500}" opacity=".88"/>${[0, 1, 2, 3, 4].map((i) => pill(20 + ((i * 34 + t * 12) % 150), sea + 2 + (i % 2) * 5, 14, 3.4, C.b300, .8)).join('')}` +
      `<path d="M112 192L186 192L186 130Q150 140 112 192Z" fill="${C.y400}"/><path d="M130 192L186 192L186 150Q160 158 130 192Z" fill="${C.o500}" opacity=".7"/>` +
      `<g transform="translate(40 ${f(sea - 7 + Math.sin(t * 2.2) * 1.4)})"><path d="M0 -14L0 -1L12 -1Z" fill="${C.white}"/><path d="M-2 -1L-8 -1L0 -12Z" fill="${C.rockM}"/><path d="M-10 0L14 0L9 6L-5 6Z" fill="${C.r500}"/></g></g>` +
      `<text x="22" y="186" fill="${h > 0.3 ? C.y200 : C.v300}" font-size="8.5" font-weight="800">${h > 0.3 ? 'HIGH TIDE' : h < -0.3 ? 'LOW TIDE' : 'WATER CHANGING'}</text>`; } },
  aurora: { cap: () => 'Aurora: the solar wind is steered to the poles by Earth\'s magnetic field, hits the atmosphere and glows', draw: (t, p) => {
    const ex = 156, ey = 100, R = 32, bez = (u, p0, c, p1) => { const a = 1 - u; return [a * a * p0[0] + 2 * a * u * c[0] + u * u * p1[0], a * a * p0[1] + 2 * a * u * c[1] + u * u * p1[1]]; };
    let o = rays(4, 100, 30, 12, t, 14, 8, C.o500) + circ(4, 100, 26, C.y400);
    for (let i = 0; i < 8; i++) { const u = ((p * 2.2 + i / 8) % 1), x = 34 + u * 70, lane = ((i * 3) % 5) - 2, base = 100 + lane * 17, bend = x > 92 ? Math.sign(lane || 1) * Math.min(1, (x - 92) / 18) * 26 : 0;
      o += pill(x - 16, base + bend - 2, 16, 4, C.y400, .9) + pill(x - 27, base + bend - 1, 7, 2.4, C.o500, .6); }
    o += `<path d="M118 40A64 64 0 0 0 118 160" fill="none" stroke="${C.v300}" stroke-width="2.6" stroke-dasharray="8 7" stroke-linecap="round"/>` +
      `<ellipse cx="${ex}" cy="${ey}" rx="40" ry="60" fill="none" stroke="${C.b300}" stroke-width="2.2" stroke-dasharray="6 6" stroke-linecap="round"/>`;
    for (const sgn of [-1, 1]) for (let k = 0; k < 5; k++) {
      const u = ((p * 3 + k / 5) % 1), [x, y] = bez(u, [112, ey + sgn * 14], [146, ey + sgn * 56], [ex - 10, ey + sgn * (R + 2)]), [x2, y2] = bez(u + 0.04, [112, ey + sgn * 14], [146, ey + sgn * 56], [ex - 10, ey + sgn * (R + 2)]);
      o += `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(Math.atan2(y2 - y, x2 - x) * 180 / Math.PI)})">${pill(-9, -1.8, 9, 3.6, C.green, .95)}</g>`;
    }
    o += sphere(ex, ey, R, C.sea, C.seaL, .18) + circ(146, 96, 10, C.green) + circ(165, 112, 7, C.green);
    const glow = 0.7 + 0.3 * Math.sin(t * 2.4);
    for (const sgn of [-1, 1]) for (let k = 0; k < 13; k++) {
      const a = sgn * (1.57 - 0.62 + k * (1.24 / 12)) * -1 + (sgn < 0 ? 0 : 0), ang = sgn < 0 ? -2.3 + k * 0.108 : 0.84 + k * 0.108, bx = ex + (R + 2) * Math.cos(ang), by = ey + (R + 2) * Math.sin(ang), hgt = 7 + 14 * (0.5 + 0.5 * Math.sin(t * 3 + k * 0.8));
      o += `<g transform="translate(${f(bx)} ${f(by)}) rotate(${f(ang * 180 / Math.PI + 90)})" opacity="${f(glow)}">${pill(-2.4, -hgt, 4.8, hgt, C.green)}${pill(-2.4, -hgt - 3, 4.8, hgt * 0.55, C.pink, .85)}</g>`;
    }
    return o; } },
  blackhole_lens: { cap: () => 'Gravitational lens: starlight bends into an Einstein ring', draw: (t, p) => {
    const beta = -70 + 140 * p, th = 36, root = Math.sqrt(beta * beta + 4 * th * th), t1 = (beta + root) / 2, t2 = (beta - root) / 2, near = clamp(1 - Math.abs(beta) / 34);
    const ring = (w, col, part = 'all') => `<path d="${part === 'bottom' ? 'M30 100A70 21 0 0 0 170 100' : 'M30 100A70 21 0 1 1 170 100A70 21 0 1 1 30 100Z'}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" transform="rotate(-14 100 100)"/>`;
    const lens = (w, col) => `<path d="M62 98A38 38 0 0 1 138 98" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
    return `<circle cx="100" cy="100" r="${th}" fill="none" stroke="${C.y200}" stroke-width="${f(2 + 7 * near)}" opacity="${f(near * 0.9)}"/>` + circ(100 + beta, 62, 4, C.b100, 0.5) +
      ring(18, C.r500) + ring(11, C.o500) + ring(5, C.y400) + ring(1.8, C.white) +
      circ(100, 100, 28, '#0c0818') + `<circle cx="100" cy="100" r="29" fill="none" stroke="${C.y200}" stroke-width="2.4"/>` +
      lens(10, C.o500) + lens(4, C.y400) + ring(18, C.r500, 'bottom') + ring(11, C.o500, 'bottom') + ring(5, C.y400, 'bottom') + ring(1.8, C.white, 'bottom') +
      `<ellipse cx="${f(100 + t1)}" cy="100" rx="${f(5 + 7 * near)}" ry="4.2" fill="${C.white}"/><ellipse cx="${f(100 + t2)}" cy="100" rx="${f(4 + 6 * near)}" ry="3.6" fill="${C.b100}" opacity=".95"/>`; } },
  star_life: { cap: (p) => ['Cloud of gas and dust', 'A young star', 'Red giant', 'Supernova!', 'White dwarf'][p < .2 ? 0 : p < .45 ? 1 : p < .7 ? 2 : p < .85 ? 3 : 4], draw: (t, p) => {
    const pulse = 1 + 0.05 * Math.sin(t * 5);
    if (p < .2) return circ(80, 96, 38, C.pink, .85) + circ(120, 92, 34, C.b400, .85) + circ(100, 124, 32, C.v500, .9) + pill(40, 150, 36, 8, C.v300, .7) + pill(120, 54, 44, 8, C.b300, .7);
    if (p < .45) return rays(100, 100, 32, 16, t, 22, 12, C.o500) + circ(100, 100, 30 * pulse, C.y400) + circ(92, 92, 12, C.y200, .6);
    if (p < .7) return circ(100, 100, 66 * pulse, C.r700) + circ(100, 100, 58 * pulse, C.r500) + circ(84, 84, 22, C.o600, .75);
    if (p < .85) { const k = 0.6 + (p - 0.7) * 6; return rays(100, 100, 20 * k, 20, t * 4, 60 * k, 30 * k, C.o500) + circ(100, 100, 30 * k, C.y400) + circ(100, 100, 18 * k, C.white); }
    return circ(100, 100, 34, C.b300, .22) + circ(100, 100, 16, C.v100) + circ(96, 96, 6, C.white) + rays(100, 100, 24, 8, t, 10, 6, C.b300, 12); } }
};


export { C, f, clamp, ease, loop, pill, poly, circ, sphere, shade, rays, streak, STREAKS, asteroid, place, fadeIO, cometShower, flyer, orbitPose, earthLand, FORMS, SIMS, starfield };
