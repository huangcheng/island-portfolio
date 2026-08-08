import * as THREE from 'three';
import { locations } from '../content';
import { addBuildings } from './buildings';

export interface Collider {
  x: number;
  z: number;
  r: number;
}

export interface InteractPoint {
  id: 'about' | 'projects' | 'contact';
  label: string;
  hint: string;
  route: string;
  position: THREE.Vector3;
  markerY: number;
  radius: number;
}

export interface IslandBuild {
  group: THREE.Group;
  /** Invisible disc used for click-to-walk raycasts. */
  walkSurface: THREE.Mesh;
  colliders: Collider[];
  points: InteractPoint[];
  clouds: THREE.Group[];
  foam: THREE.Mesh[];
  /** Campfire/torch flames — the engine flickers them. */
  flames: THREE.Mesh[];
}

// ── Palette ───────────────────────────────────────────────────────────────
const GRASS_DARK = 0x6cb83f;
const DIRT_HI = 0xa06a3f;
const DIRT_MID = 0x8a5a33;
const DIRT_LO = 0x6e4424;
const SAND = 0xf7e6ad;
const SAND_WET = 0xe6cf8e;
const SEA = 0x3fbcd4;
const PATH_CENTER = 0xece0b0;
const PATH_RIM = 0xcdb884;
const LEAF_DARK = 0x4a9d3a;
const LEAF_MID = 0x5fb74a;
const CEDAR_GREEN = 0x2f6e3a;
const TRUNK = 0x8a5a33;
const PALM_TRUNK = 0xc98a4b;
const PALM_TRUNK_DARK = 0xb3743a;
const PALM_FROND = 0x3faf5f;
const PALM_FROND_LIGHT = 0x6fcf7f;
const COCONUT = 0x8a6a3a;
const TCORE = 0x3f9d4e;
const TRIM_LIGHT = 0x53b361;
const TULIP_RED = 0xe85a6a;
const TULIP_YELLOW = 0xffd94d;
const TULIP_WHITE = 0xffffff;

function std(color: number, roughness = 0.9, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function shadowed<T extends THREE.Mesh>(m: T, cast = true, receive = false): T {
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

/** Deterministic PRNG so the island looks identical every load. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Shared geometries (unit primitives, scaled per-instance) ───────────────
const G_SPHERE = new THREE.SphereGeometry(1, 16, 12);
const G_SPHERE_LO = new THREE.SphereGeometry(1, 12, 8);
const G_ICO = new THREE.IcosahedronGeometry(1, 0);
const G_STEM = new THREE.CylinderGeometry(0.025, 0.03, 0.34, 6);
const G_BLADE = new THREE.ConeGeometry(0.035, 0.32, 5);
const G_PALM_SEG = new THREE.CylinderGeometry(0.14, 0.16, 1, 8);
const G_TULIP = new THREE.LatheGeometry(
  [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.08, 0.04),
    new THREE.Vector2(0.15, 0.12),
    new THREE.Vector2(0.16, 0.2),
    new THREE.Vector2(0.13, 0.27),
    new THREE.Vector2(0.09, 0.31),
  ],
  12,
);

// ── Grass texture: iconic AC darker-blade-triangle scatter ─────────────────
function makeGrassTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#7ec850';
  ctx.fillRect(0, 0, 1024, 1024);
  const shades = ['#6cb83f', '#5fa835', '#74c045', '#69bf40'];
  const rng = mulberry32(20260808);
  for (let i = 0; i < 520; i++) {
    const x = rng() * 1024;
    const y = rng() * 1024;
    const r = 9 + rng() * 11;
    ctx.fillStyle = shades[(rng() * shades.length) | 0];
    ctx.beginPath();
    const base = rng() * Math.PI * 2;
    for (let k = 0; k < 3; k++) {
      const ang = base + (k * Math.PI * 2) / 3;
      const px = x + Math.cos(ang) * r;
      const py = y + Math.sin(ang) * r;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  // a few lighter highlights for depth
  for (let i = 0; i < 120; i++) {
    const x = rng() * 1024;
    const y = rng() * 1024;
    ctx.fillStyle = 'rgba(147,217,106,0.55)';
    ctx.beginPath();
    ctx.arc(x, y, 5 + rng() * 5, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = 8;
  return tex;
}

// ── Hardwood tree: curved tapered trunk + overlapping puffy canopy ─────────
function makeHardwoodTree(
  rng: () => number,
  x: number,
  z: number,
  fruit: 'orange' | 'peach' | null,
  trunkLowGeo: THREE.CylinderGeometry,
  trunkUpGeo: THREE.CylinderGeometry,
): { tree: THREE.Group; collider: Collider } {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rng() * Math.PI * 2;

  const lean = (rng() - 0.5) * 0.28;
  const trunkH = 1.55 + rng() * 0.45;
  const tLow = shadowed(new THREE.Mesh(trunkLowGeo, std(TRUNK)));
  tLow.scale.y = trunkH * 0.6;
  tLow.position.y = (trunkH * 0.6) / 2;
  const tUp = shadowed(new THREE.Mesh(trunkUpGeo, std(TRUNK)));
  tUp.scale.y = trunkH * 0.52;
  tUp.position.set(lean * 0.6, trunkH * 0.6 + (trunkH * 0.52) / 2, 0);
  tUp.rotation.z = lean;
  g.add(tLow, tUp);

  const cy = trunkH + 0.42;
  const s = 0.92 + rng() * 0.22;
  const coreR = 1.05 * s;
  const rimR = coreR * 0.45;
  const matCore = std(TCORE);
  const matLight = std(TRIM_LIGHT);

  // Core sphere
  const core = shadowed(new THREE.Mesh(G_SPHERE, matCore));
  core.scale.set(coreR, coreR * 0.92, coreR);
  core.position.set(0, cy, 0);
  g.add(core);

  // Ring of rim lobes at the core's equator (scalloped flower-petal outline)
  const rimCount = 9;
  const rimDist = coreR * 0.92;
  for (let i = 0; i < rimCount; i++) {
    const a = (i / rimCount) * Math.PI * 2 + rng() * 0.06;
    const lob = shadowed(new THREE.Mesh(G_SPHERE, i % 2 === 0 ? matCore : matLight));
    const lr = rimR * (0.92 + rng() * 0.16);
    lob.scale.set(lr, lr * 0.9, lr);
    lob.position.set(Math.cos(a) * rimDist, cy + (rng() - 0.5) * 0.08, Math.sin(a) * rimDist);
    g.add(lob);
  }

  // 2 smaller lobes on top
  const tops: [number, number][] = [
    [0.18, -0.12],
    [-0.22, 0.2],
  ];
  for (const [ox, oz] of tops) {
    const t = shadowed(new THREE.Mesh(G_SPHERE, matLight));
    const tr = rimR * 0.82;
    t.scale.set(tr, tr * 0.88, tr);
    t.position.set(ox * coreR, cy + coreR * 0.72, oz * coreR);
    g.add(t);
  }

  // sun-facing highlight blob
  const hi = shadowed(new THREE.Mesh(G_SPHERE_LO, std(LEAF_MID)));
  hi.position.set(-0.15 * s, cy + 0.5, -0.3 * s);
  hi.scale.set(0.6 * s, 0.42 * s, 0.6 * s);
  g.add(hi);

  if (fruit) {
    const fmat = std(fruit === 'peach' ? 0xff8fa3 : 0xff8c42, 0.5);
    const n = 2 + ((rng() * 2) | 0);
    const fr = rimDist + 0.1;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng() * 0.6;
      const f = new THREE.Mesh(G_SPHERE_LO, fmat);
      f.position.set(Math.cos(a) * fr, cy - 0.35 + rng() * 0.15, Math.sin(a) * fr);
      f.scale.setScalar(0.15);
      g.add(f);
    }
  }
  return { tree: g, collider: { x, z, r: 0.62 } };
}

// ── Palm tree: curved segmented trunk + drooping fronds + coconuts ──────────
function makePalm(
  rng: () => number,
  x: number,
  z: number,
): { palm: THREE.Group; collider: Collider } {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rng() * Math.PI * 2;

  const trunkMat = std(PALM_TRUNK);
  const bandMat = std(PALM_TRUNK_DARK);
  const segH = 0.6;
  const segs = 5;
  let offX = 0;
  for (let i = 0; i < segs; i++) {
    const seg = shadowed(new THREE.Mesh(G_PALM_SEG, i % 2 === 0 ? trunkMat : bandMat));
    const taper = 1 - i * 0.05;
    seg.scale.set(taper, segH, taper);
    offX += 0.07;
    seg.position.set(offX, i * segH + segH / 2, 0);
    seg.rotation.z = -0.03 - i * 0.03;
    g.add(seg);
  }
  const crownX = offX + 0.04;
  const crownY = segs * segH;

  const frondBodyMat = std(PALM_FROND);
  const frondTipMat = std(PALM_FROND_LIGHT);
  const frondCount = 6;
  for (let i = 0; i < frondCount; i++) {
    const a = (i / frondCount) * Math.PI * 2 + rng() * 0.12;
    const radial = new THREE.Group();
    radial.position.set(crownX, crownY, 0);
    radial.rotation.y = a;
    const droop = 0.5 + rng() * 0.22;
    const droopG = new THREE.Group();
    droopG.rotation.z = -droop;
    const body = shadowed(new THREE.Mesh(G_SPHERE, frondBodyMat));
    body.scale.set(0.95, 0.13, 0.24);
    body.position.set(0.5, 0, 0);
    droopG.add(body);
    const tip = shadowed(new THREE.Mesh(G_SPHERE_LO, frondTipMat));
    tip.scale.set(0.32, 0.1, 0.2);
    tip.position.set(0.9, -0.04, 0);
    droopG.add(tip);
    radial.add(droopG);
    g.add(radial);
  }

  const nutMat = std(COCONUT);
  for (let i = 0; i < 2; i++) {
    const a = rng() * Math.PI * 2;
    const nut = new THREE.Mesh(G_SPHERE_LO, nutMat);
    nut.position.set(crownX + Math.cos(a) * 0.14, crownY - 0.15, Math.sin(a) * 0.14);
    nut.scale.setScalar(0.13);
    g.add(nut);
  }

  return { palm: g, collider: { x, z, r: 0.4 } };
}

// ── Cedar / pine: stacked rounded cones ────────────────────────────────────
function makeCedar(
  rng: () => number,
  x: number,
  z: number,
  coneGeo: THREE.ConeGeometry,
): { tree: THREE.Group; collider: Collider } {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rng() * Math.PI * 2;
  const trunk = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.0, 8), std(TRUNK)));
  trunk.position.y = 0.5;
  g.add(trunk);

  const tiers: [number, number, number][] = [
    [1.15, 1.25, 0.6],
    [0.92, 1.05, 1.35],
    [0.7, 0.85, 2.0],
    [0.42, 0.55, 2.5],
  ];
  for (const [r, h, y] of tiers) {
    const c = shadowed(new THREE.Mesh(coneGeo, std(CEDAR_GREEN)));
    c.scale.set(r, h, r);
    c.position.y = y;
    g.add(c);
  }
  const tip = shadowed(new THREE.Mesh(G_SPHERE_LO, std(0x3a7e44)));
  tip.position.y = 2.78;
  tip.scale.setScalar(0.3);
  g.add(tip);
  return { tree: g, collider: { x, z, r: 0.55 } };
}

// ── Bush: low overlapping blobby spheres ───────────────────────────────────
function makeBush(x: number, z: number, rng: () => number): { bush: THREE.Group; collider: Collider } {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rng() * Math.PI * 2;
  const pts: [number, number, number, number][] = [
    [0, 0.32, 0, 0.52],
    [0.4, 0.28, 0.12, 0.42],
    [-0.36, 0.3, -0.16, 0.4],
    [0.06, 0.42, -0.28, 0.34],
  ];
  for (const [bx, by, bz, br] of pts) {
    const m = shadowed(new THREE.Mesh(G_SPHERE, std(rng() > 0.5 ? LEAF_DARK : 0x4a8c3a)));
    m.position.set(bx, by, bz);
    m.scale.set(br, br * 0.82, br);
    g.add(m);
  }
  // occasional berry
  if (rng() > 0.55) {
    const berr = std(0xe2574c, 0.5);
    for (let i = 0; i < 3; i++) {
      const bm = new THREE.Mesh(G_SPHERE_LO, berr);
      bm.position.set((rng() - 0.5) * 0.6, 0.42, (rng() - 0.5) * 0.5);
      bm.scale.setScalar(0.09);
      g.add(bm);
    }
  }
  return { bush: g, collider: { x, z, r: 0.4 } };
}

// ── Flower: stem + 5 radial petals + yellow centre ─────────────────────────
function makeFlower(x: number, z: number, color: number, rng: () => number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rng() * Math.PI * 2;
  const h = 0.3 + rng() * 0.12;
  const stem = new THREE.Mesh(G_STEM, std(0x3f8c2a));
  stem.scale.y = h / 0.34;
  stem.position.y = h / 2;
  g.add(stem);

  const cy = h + 0.06;
  const pmat = std(color, 0.5);
  const n = 5;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const p = new THREE.Mesh(G_SPHERE_LO, pmat);
    p.position.set(Math.cos(a) * 0.1, cy + 0.02, Math.sin(a) * 0.1);
    p.scale.set(0.085, 0.045, 0.14);
    p.rotation.z = -Math.cos(a) * 0.35;
    p.rotation.x = Math.sin(a) * 0.35;
    g.add(p);
  }
  const center = new THREE.Mesh(G_SPHERE_LO, std(0xffd94d, 0.4));
  center.position.y = cy + 0.04;
  center.scale.setScalar(0.085);
  g.add(center);
  // a little leaf on the stem
  const leaf = new THREE.Mesh(G_SPHERE_LO, std(0x4a9d3a));
  leaf.position.set(0.06, h * 0.5, 0);
  leaf.scale.set(0.09, 0.03, 0.05);
  leaf.rotation.z = -0.5;
  g.add(leaf);
  return g;
}

function makeFlowerCluster(cx: number, cz: number, colors: number[], rng: () => number): THREE.Group {
  const g = new THREE.Group();
  const n = 2 + ((rng() * 2) | 0);
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const r = rng() * 0.45;
    g.add(makeFlower(cx + Math.cos(a) * r, cz + Math.sin(a) * r, colors[i % colors.length], rng));
  }
  return g;
}

// ── Tulip: lathe cup + stem + leaf blades (AC cup-shaped bloom) ─────────────
function makeTulip(x: number, z: number, color: number, rng: () => number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rng() * Math.PI * 2;
  const h = 0.46 + rng() * 0.1;
  const stem = new THREE.Mesh(G_STEM, std(0x3f8c2a));
  stem.scale.y = h / 0.34;
  stem.position.y = h / 2;
  g.add(stem);

  const cup = new THREE.Mesh(G_TULIP, std(color, 0.85));
  const cs = 0.9 + rng() * 0.2;
  cup.scale.setScalar(cs);
  cup.position.y = h;
  g.add(cup);

  const leafMat = std(0x4a9d3a);
  for (let i = 0; i < 2; i++) {
    const a = (i / 2) * Math.PI * 2 + 0.6;
    const leaf = new THREE.Mesh(G_BLADE, leafMat);
    leaf.position.set(Math.cos(a) * 0.05, 0.18, Math.sin(a) * 0.05);
    leaf.rotation.y = a;
    leaf.rotation.z = -0.5;
    leaf.scale.set(0.7, 1.15, 0.5);
    g.add(leaf);
  }
  return g;
}

function makeTulipCluster(cx: number, cz: number, colors: number[], rng: () => number): THREE.Group {
  const g = new THREE.Group();
  const n = 2 + ((rng() * 2) | 0);
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const r = rng() * 0.4;
    g.add(makeTulip(cx + Math.cos(a) * r, cz + Math.sin(a) * r, colors[i % colors.length], rng));
  }
  return g;
}

// ── Mushroom: domed cap + stubby stem (+ dots on red caps) ─────────────────
function makeMushroom(x: number, z: number, red: boolean, rng: () => number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rng() * Math.PI * 2;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.22, 10), std(0xf6ecd2));
  stem.position.y = 0.11;
  const cap = shadowed(new THREE.Mesh(G_SPHERE, std(red ? 0xe2574c : 0x9a6b3f)));
  cap.position.y = 0.24;
  cap.scale.set(0.26, 0.19, 0.26);
  g.add(stem, cap);
  if (red) {
    const dotMat = std(0xfff6e0, 0.6);
    for (let i = 0; i < 3; i++) {
      const a = rng() * Math.PI * 2;
      const d = new THREE.Mesh(G_SPHERE_LO, dotMat);
      d.position.set(Math.cos(a) * 0.13, 0.32, Math.sin(a) * 0.13);
      d.scale.setScalar(0.04);
      g.add(d);
    }
  }
  return g;
}

// ── Weed tuft / clover patch / grass tuft: ground detail ───────────────────
function makeWeedTuft(x: number, z: number, rng: () => number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rng() * Math.PI * 2;
  const mats = [std(0x4a9d3a), std(0x5fa835), std(0x6cc24a)];
  const n = 3 + ((rng() * 2) | 0);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng() * 0.5;
    const r = rng() * 0.12;
    const b = new THREE.Mesh(G_BLADE, mats[i % mats.length]);
    b.position.set(Math.cos(a) * r, 0.16, Math.sin(a) * r);
    b.rotation.z = (rng() - 0.5) * 0.4;
    b.rotation.x = (rng() - 0.5) * 0.3;
    b.scale.setScalar(0.7 + rng() * 0.6);
    g.add(b);
  }
  return g;
}

function makeClover(x: number, z: number, rng: () => number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rng() * Math.PI * 2;
  const mat = std(0x5fa835);
  const n = 4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const l = new THREE.Mesh(G_SPHERE_LO, mat);
    l.position.set(Math.cos(a) * 0.08, 0.03, Math.sin(a) * 0.08);
    l.scale.set(0.1, 0.04, 0.12);
    g.add(l);
  }
  return g;
}

function makeGrassTuft(x: number, z: number, rng: () => number): THREE.Mesh {
  const m = new THREE.Mesh(G_BLADE, std(rng() > 0.5 ? GRASS_DARK : 0x6cc24a));
  m.position.set(x, 0.16, z);
  m.rotation.y = rng() * Math.PI * 2;
  m.rotation.z = (rng() - 0.5) * 0.3;
  m.scale.set(0.6 + rng() * 0.4, 0.7 + rng() * 0.5, 0.6 + rng() * 0.4);
  return m;
}

// ── Beach props: shells, starfish, driftwood ───────────────────────────────
function makeShell(x: number, z: number, rng: () => number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, -0.02, z);
  g.rotation.y = rng() * Math.PI * 2;
  const color = rng() > 0.5 ? 0xffb0c8 : 0xffe6c0;
  const mat = std(color, 0.45);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.32, 8), mat);
  spire.rotation.z = Math.PI / 2 - 0.25;
  spire.position.y = 0.08;
  const base = new THREE.Mesh(G_SPHERE_LO, mat);
  base.scale.setScalar(0.11);
  base.position.set(-0.12, 0.06, 0);
  g.add(spire, base);
  return g;
}

function makeStarfish(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, -0.01, z);
  const shape = new THREE.Shape();
  const arms = 5;
  const outer = 0.26;
  const inner = 0.11;
  for (let i = 0; i < arms * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (arms * 2)) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) shape.moveTo(px, py);
    else shape.lineTo(px, py);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.025,
    bevelSegments: 1,
  });
  const m = shadowed(new THREE.Mesh(geo, std(0xff8a6a, 0.5)));
  m.rotation.x = -Math.PI / 2;
  g.add(m);
  return g;
}

function makeDriftwood(x: number, z: number, rng: () => number): { log: THREE.Group; collider: Collider } {
  const g = new THREE.Group();
  g.position.set(x, -0.02, z);
  g.rotation.y = rng() * Math.PI * 2;
  const mat = std(0x7a5a36);
  const log = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 1.5, 8), mat));
  log.rotation.z = Math.PI / 2;
  log.position.y = 0.1;
  const branch = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.5, 6), mat));
  branch.position.set(0.3, 0.12, 0);
  branch.rotation.z = Math.PI / 2 - 0.5;
  g.add(log, branch);
  return { log: g, collider: { x, z, r: 0.45 } };
}

// ── Rocks: smooth boulders + pebbles ───────────────────────────────────────
function makeBoulder(x: number, z: number, s: number, rng: () => number): { rock: THREE.Mesh; collider: Collider } {
  const mat = std(rng() > 0.5 ? 0x9a9aa2 : 0x84848c);
  const m = shadowed(new THREE.Mesh(G_ICO, mat), true, true);
  m.position.set(x, s * 0.5, z);
  m.scale.set(s, s * 0.66, s * 0.9);
  m.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
  return { rock: m, collider: { x, z, r: s * 0.75 } };
}

function makePebble(x: number, z: number, rng: () => number): THREE.Mesh {
  const m = shadowed(new THREE.Mesh(G_ICO, std(rng() > 0.5 ? 0x9a9aa2 : 0x80808a)), true, true);
  m.position.set(x, 0.04, z);
  const s = 0.1 + rng() * 0.08;
  m.scale.set(s, s * 0.55, s);
  m.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
  return m;
}

// ── Cloud: 4-6 overlapping squashed spheres ────────────────────────────────
function makeCloud(seed: number): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  const rng = mulberry32(seed * 97 + 13);
  const n = 4 + ((rng() * 3) | 0);
  for (let i = 0; i < n; i++) {
    const s = new THREE.Mesh(G_SPHERE, m);
    const r = 1.0 + rng() * 0.5;
    s.position.set((rng() - 0.5) * 3.2, (rng() - 0.5) * 0.5, (rng() - 0.5) * 1.4);
    s.scale.set(r, r * 0.6, r * 0.85);
    g.add(s);
  }
  return g;
}

// ── Cozy corner props (from the official decorating refs) ───────────────────

function makeStripedTexture(a: string, b: string, bands = 6): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const w = 256 / bands;
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = i % 2 ? b : a;
    ctx.fillRect(i * w, 0, w + 1, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeChevronTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#3fb8af';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#fffef7';
  ctx.lineWidth = 13;
  ctx.lineJoin = 'round';
  for (let row = 0; row < 5; row++) {
    ctx.beginPath();
    for (let x = 0; x <= 256; x += 32) {
      const y = row * 56 + 18 + (x / 32) % 2 * 16;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeFlame(r: number, h: number, color: number, intensity: number): THREE.Mesh {
  const f = new THREE.Mesh(
    new THREE.ConeGeometry(r, h, 10),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: intensity,
      roughness: 0.6,
      transparent: true,
      opacity: 0.94,
    }),
  );
  return f;
}

/** Campfire: stone ring + leaning log tripod + nested flickering flames. */
function makeCampfire(): { g: THREE.Group; flames: THREE.Mesh[] } {
  const g = new THREE.Group();
  const flames: THREE.Mesh[] = [];
  const stoneMat = std(0x9a9aa5);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const s = shadowed(new THREE.Mesh(new THREE.DodecahedronGeometry(0.11, 0), stoneMat), true, true);
    s.position.set(Math.cos(a) * 0.48, 0.06, Math.sin(a) * 0.48);
    s.scale.y = 0.6;
    s.rotation.y = a * 2.3;
    g.add(s);
  }
  const logMat = std(0x6e4424);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const log = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.7, 8), logMat));
    log.position.set(Math.cos(a) * 0.14, 0.26, Math.sin(a) * 0.14);
    log.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    g.add(log);
  }
  const outer = makeFlame(0.2, 0.52, 0xff8c2a, 1.8);
  outer.position.y = 0.42;
  const inner = makeFlame(0.11, 0.34, 0xffd94d, 2.4);
  inner.position.y = 0.42;
  g.add(outer, inner);
  flames.push(outer, inner);
  const light = new THREE.PointLight(0xff9a4c, 5, 7, 1.8);
  light.position.y = 0.75;
  g.add(light);
  return { g, flames };
}

/** Log bench — one half-log on two stub legs. */
function makeLogBench(): THREE.Group {
  const g = new THREE.Group();
  const bark = std(0x8a5a33);
  const seat = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 1.5, 14), bark), true, true);
  seat.rotation.z = Math.PI / 2;
  seat.position.y = 0.36;
  seat.scale.z = 0.72; // halved profile
  const legL = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.36, 8), bark));
  legL.position.set(-0.52, 0.18, 0);
  const legR = legL.clone();
  legR.position.x = 0.52;
  g.add(seat, legL, legR);
  return g;
}

/** Tiki torch with a small flame. */
function makeTikiTorch(): { g: THREE.Group; flame: THREE.Mesh } {
  const g = new THREE.Group();
  const pole = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.5, 8), std(0x7a5a36)));
  pole.position.y = 0.75;
  const head = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.24, 10), std(0x9a6a3f)));
  head.position.y = 1.58;
  const flame = makeFlame(0.09, 0.3, 0xffa53c, 2.2);
  flame.position.y = 1.86;
  const light = new THREE.PointLight(0xffa54c, 3, 5, 1.8);
  light.position.y = 1.9;
  g.add(pole, head, flame, light);
  return { g, flame };
}

/** Hammock: two bark posts + a sagging red/cream striped sheet. */
function makeHammock(): THREE.Group {
  const g = new THREE.Group();
  const postMat = std(0x7a5a36);
  for (const pz of [-1.0, 1.0]) {
    const post = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.1, 10), postMat));
    post.position.set(0, 0.55, pz);
    post.rotation.x = pz < 0 ? -0.12 : 0.12;
    g.add(post);
  }
  // Sagging sheet = the bottom band of a horizontal tube (concave up)
  const sheetGeo = new THREE.CylinderGeometry(0.52, 0.52, 1.85, 18, 1, true, Math.PI - 0.62, 1.24);
  const sheet = shadowed(
    new THREE.Mesh(
      sheetGeo,
      new THREE.MeshStandardMaterial({ map: makeStripedTexture('#e2574c', '#fff2d0'), roughness: 0.9, side: THREE.DoubleSide }),
    ),
  );
  sheet.rotation.x = -Math.PI / 2;
  sheet.position.y = 0.98;
  g.add(sheet);
  return g;
}

/** Stone birdbath with water + a tiny bird. */
function makeBirdbath(): THREE.Group {
  const g = new THREE.Group();
  const stone = std(0xd8d2c4);
  const base = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 12), stone), true, true);
  base.position.y = 0.04;
  const pedestal = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.5, 10), stone));
  pedestal.position.y = 0.32;
  const basin = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.16, 0.14, 16), stone));
  basin.position.y = 0.62;
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(0.25, 20),
    new THREE.MeshStandardMaterial({ color: 0x7ec8e8, roughness: 0.15 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.68;
  const birdBody = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), std(0x5b7fa8, 0.7));
  birdBody.position.set(0.14, 0.74, 0.1);
  birdBody.scale.set(1, 0.9, 1.15);
  const birdHead = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), std(0x5b7fa8, 0.7));
  birdHead.position.set(0.16, 0.82, 0.14);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.045, 6), std(0xf2a541, 0.6));
  beak.position.set(0.17, 0.81, 0.19);
  beak.rotation.x = Math.PI / 2;
  g.add(base, pedestal, basin, water, birdBody, birdHead, beak);
  return g;
}

/** Short run of white picket fence along +z from (x, z0). */
function makePicketFence(x: number, z0: number, count: number): THREE.Group {
  const g = new THREE.Group();
  const paint = std(0xf7f4ec);
  const step = 0.42;
  for (let i = 0; i < count; i++) {
    const p = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.56, 0.045), paint));
    p.position.set(x, 0.28, z0 + i * step);
    const tip = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.064, 0.13, 4), paint));
    tip.rotation.y = Math.PI / 4;
    tip.position.set(x, 0.62, z0 + i * step);
    g.add(p, tip);
  }
  const len = (count - 1) * step;
  for (const ry of [0.2, 0.44]) {
    const rail = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, len + 0.1), paint));
    rail.position.set(x + 0.05, ry, z0 + len / 2);
    g.add(rail);
  }
  return g;
}

/** Beach towel with a teal chevron pattern. */
function makeBeachTowel(): THREE.Mesh {
  const towel = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 0.045, 1.75),
    new THREE.MeshStandardMaterial({ map: makeChevronTexture(), roughness: 0.95 }),
  );
  towel.receiveShadow = true;
  return towel;
}

/** Hyacinth — stem with a dense spike of tiny blooms. */
function makeHyacinth(x: number, z: number, color: number, rng: () => number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.5, 6), std(0x3f8c2a));
  stem.position.y = 0.25;
  g.add(stem);
  const bloomMat = std(color, 0.7);
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.055 - i * 0.005, 8, 6), bloomMat);
    const a = rng() * Math.PI * 2;
    b.position.set(Math.cos(a) * 0.035, 0.46 + i * 0.055, Math.sin(a) * 0.035);
    g.add(b);
  }
  const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.4, 6), std(0x4ea24b));
  leaf.position.set(0.07, 0.18, 0);
  leaf.rotation.z = -0.35;
  g.add(leaf);
  return g;
}

// ── Organic winding path of overlapping flattened blobs ─────────────────────
function placePath(
  group: THREE.Group,
  from: [number, number],
  to: [number, number],
  rng: () => number,
) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const nx = -dz / len;
  const nz = dx / len;
  const off = (rng() - 0.5) * len * 0.25;
  const cx = (from[0] + to[0]) / 2 + nx * off;
  const cz = (from[1] + to[1]) / 2 + nz * off;
  const steps = Math.max(6, Math.floor(len / 0.95));
  const rimMat = std(PATH_RIM);
  const ctrMat = std(PATH_CENTER);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const it = 1 - t;
    const x = it * it * from[0] + 2 * it * t * cx + t * t * to[0];
    const z = it * it * from[1] + 2 * it * t * cz + t * t * to[1];
    const wobble = 0.78 + rng() * 0.18;
    const rim = new THREE.Mesh(G_ICO, rimMat);
    rim.position.set(x, 0.035, z);
    rim.scale.set(wobble, 0.05, wobble);
    rim.rotation.y = rng() * Math.PI;
    rim.receiveShadow = true;
    const ctr = new THREE.Mesh(G_ICO, ctrMat);
    ctr.position.set(x, 0.05, z);
    ctr.scale.set(wobble * 0.72, 0.04, wobble * 0.72);
    ctr.rotation.y = rng() * Math.PI;
    ctr.receiveShadow = true;
    group.add(rim, ctr);
  }
}

export function buildIsland(): IslandBuild {
  const group = new THREE.Group();
  const colliders: Collider[] = [];
  const clouds: THREE.Group[] = [];
  const foam: THREE.Mesh[] = [];
  const rng = mulberry32(424242);

  // ── Terrain: grass top, rounded grass lip, beach sand, layered dirt cliff ─
  const grassMat = new THREE.MeshStandardMaterial({ map: makeGrassTexture(), roughness: 0.92 });
  const grass = new THREE.Mesh(new THREE.CircleGeometry(15, 96), grassMat);
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = 0.02;
  grass.receiveShadow = true;

  // Rounded grass overhang lip ringing the grass/sand boundary (AC signature)
  const lip = new THREE.Mesh(new THREE.TorusGeometry(15.05, 0.22, 12, 120), std(0x74c045));
  lip.rotation.x = -Math.PI / 2;
  lip.position.y = 0.06;
  lip.scale.y = 0.5;
  lip.receiveShadow = true;
  lip.castShadow = true;

  // Beach sand ring (full disc, grass sits on top revealing the ring 15→18)
  const sand = new THREE.Mesh(new THREE.CircleGeometry(18, 96), std(SAND, 0.95));
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = -0.04;
  sand.receiveShadow = true;
  // Wet-sand band near the water line
  const wet = new THREE.Mesh(new THREE.RingGeometry(17.0, 17.85, 96), std(SAND_WET, 0.7));
  wet.rotation.x = -Math.PI / 2;
  wet.position.y = -0.03;

  // Layered dirt cliff (3 graduated-brown tiers) — the island wall into the sea
  const cliffA = new THREE.Mesh(new THREE.CylinderGeometry(18.0, 18.35, 0.5, 96), std(DIRT_HI));
  cliffA.position.y = -0.3;
  cliffA.receiveShadow = true;
  cliffA.castShadow = true;
  const cliffB = new THREE.Mesh(new THREE.CylinderGeometry(18.35, 18.75, 0.52, 96), std(DIRT_MID));
  cliffB.position.y = -0.82;
  cliffB.receiveShadow = true;
  cliffB.castShadow = true;
  const cliffC = new THREE.Mesh(new THREE.CylinderGeometry(18.75, 19.4, 0.62, 96), std(DIRT_LO));
  cliffC.position.y = -1.38;
  cliffC.receiveShadow = true;

  // Sea disc
  const sea = new THREE.Mesh(
    new THREE.CircleGeometry(110, 96),
    new THREE.MeshStandardMaterial({ color: SEA, roughness: 0.22, metalness: 0.08 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -1.15;

  // Foam rings drifting around the beach (engine pulses scale + opacity)
  const foamMatBase = () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
  for (const r of [18.55, 19.35, 20.2]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.1, 8, 120), foamMatBase());
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -1.08;
    foam.push(ring);
    group.add(ring);
  }
  // Static wave-curve accents near the shore
  const waveMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + rng() * 0.6;
    const wr = 17.6 + rng() * 0.7;
    const wave = new THREE.Mesh(new THREE.TorusGeometry(wr, 0.035, 6, 20, 0.7 + rng() * 0.4), waveMat);
    wave.position.set(Math.cos(ang) * wr, -0.12, Math.sin(ang) * wr);
    wave.rotation.x = -Math.PI / 2;
    wave.rotation.z = ang;
    group.add(wave);
  }

  // Invisible walk raycast surface
  const walkSurface = new THREE.Mesh(
    new THREE.CircleGeometry(17.6, 48),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  walkSurface.rotation.x = -Math.PI / 2;
  walkSurface.position.y = 0.02;

  // ── Plaza + organic winding paths ─────────────────────────────────────────
  const plazaRim = new THREE.Mesh(new THREE.CircleGeometry(2.3, 48), std(PATH_RIM));
  plazaRim.rotation.x = -Math.PI / 2;
  plazaRim.position.set(0, 0.03, 0.5);
  plazaRim.receiveShadow = true;
  const plazaCtr = new THREE.Mesh(new THREE.CircleGeometry(2.0, 48), std(PATH_CENTER));
  plazaCtr.rotation.x = -Math.PI / 2;
  plazaCtr.position.set(0, 0.045, 0.5);
  plazaCtr.receiveShadow = true;
  group.add(plazaRim, plazaCtr);

  const plaza: [number, number] = [0, 0.5];
  placePath(group, plaza, [-5.4, -2.4], rng); // to house
  placePath(group, plaza, [5.4, -2.7], rng); // to museum
  placePath(group, plaza, [5.3, 3.4], rng); // to notice board

  // ── Buildings (buildings.ts adds its own colliders) ───────────────────────
  addBuildings(group, colliders);

  // ── Trees ─────────────────────────────────────────────────────────────────
  const trunkLowGeo = new THREE.CylinderGeometry(0.18, 0.3, 1, 10);
  const trunkUpGeo = new THREE.CylinderGeometry(0.13, 0.18, 1, 10);
  const cedarConeGeo = new THREE.ConeGeometry(1, 1, 12);
  const hardwood: [number, number, 'orange' | 'peach' | null][] = [
    [-11.0, -1.5, 'orange'],
    [-10.0, 4.5, 'peach'],
    [-6.0, 9.7, null],
    [0.5, 11.5, 'orange'],
    [6.5, 9.6, null],
    [11.2, 5.5, 'peach'],
    [12.2, -1.5, 'orange'],
    [8.5, -9.6, null],
    [-3.5, -10.6, 'peach'],
  ];
  for (const [tx, tz, fruit] of hardwood) {
    const { tree, collider } = makeHardwoodTree(rng, tx, tz, fruit, trunkLowGeo, trunkUpGeo);
    group.add(tree);
    colliders.push(collider);
  }
  const cedars: [number, number][] = [
    [-9.6, 7.6],
    [10.2, 8.2],
    [-12.2, 2.6],
  ];
  for (const [cx, cz] of cedars) {
    const { tree, collider } = makeCedar(rng, cx, cz, cedarConeGeo);
    group.add(tree);
    colliders.push(collider);
  }

  // ── Palm trees on the beach sand ring ─────────────────────────────────────
  const palms: [number, number][] = [
    [-13.5, 7.5],
    [13.0, -10.5],
  ];
  for (const [px, pz] of palms) {
    const { palm, collider } = makePalm(rng, px, pz);
    group.add(palm);
    colliders.push(collider);
  }

  // ── Bushes near building edges / clearings ────────────────────────────────
  const bushes: [number, number][] = [
    [-9.0, -4.2],
    [-4.2, -7.6],
    [3.6, -7.2],
    [9.2, -1.0],
    [-8.6, 5.2],
    [4.2, 8.6],
  ];
  for (const [bx, bz] of bushes) {
    const { bush, collider } = makeBush(bx, bz, rng);
    group.add(bush);
    colliders.push(collider);
  }

  // ── Flowers in clusters (multiple colours) ────────────────────────────────
  const flowerPalette: Record<string, number[]> = {
    pink: [0xff7fa8, 0xffaac6],
    yellow: [0xffd94d, 0xfff0a0],
    white: [0xfff6e0, 0xffffff],
    orange: [0xff9a5c, 0xffb88a],
    purple: [0xc58cff, 0xdcb3ff],
    red: [0xff5a5a, 0xff8a8a],
  };
  const flowerSpots: [number, number, string][] = [
    [-3.6, 3.2, 'pink'],
    [3.4, 3.6, 'yellow'],
    [-6.2, 0.8, 'white'],
    [5.2, 0.2, 'purple'],
    [-7.6, -7.2, 'orange'],
    [8.2, 3.6, 'red'],
    [2.0, 6.8, 'pink'],
    [-1.0, -3.8, 'yellow'],
  ];
  for (const [fx, fz, name] of flowerSpots) {
    group.add(makeFlowerCluster(fx, fz, flowerPalette[name], rng));
  }

  // ── Tulip clusters (cup-shaped AC blooms) ─────────────────────────────────
  const tulipSpots: [number, number, number[]][] = [
    [-5.5, 5.5, [TULIP_RED, TULIP_YELLOW]],
    [8.5, 2.5, [TULIP_YELLOW, TULIP_WHITE]],
    [-2.5, -6.5, [TULIP_RED, TULIP_WHITE, TULIP_YELLOW]],
  ];
  for (const [tx, tz, cols] of tulipSpots) {
    group.add(makeTulipCluster(tx, tz, cols, rng));
  }

  // ── Mushrooms / weeds / clover / grass tufts: ground interest ─────────────
  const mushrooms: [number, number, boolean][] = [
    [-4.6, 5.6, true],
    [6.6, -1.2, false],
    [-8.2, 2.2, false],
    [2.2, 6.6, true],
  ];
  for (const [mx, mz, red] of mushrooms) group.add(makeMushroom(mx, mz, red, rng));

  const weedSpots: [number, number][] = [
    [-2.0, 6.2],
    [4.4, -3.2],
    [-5.0, -2.2],
    [7.0, 1.2],
    [-9.2, -1.2],
  ];
  for (const [wx, wz] of weedSpots) group.add(makeWeedTuft(wx, wz, rng));

  const cloverSpots: [number, number][] = [
    [1.2, 4.4],
    [-1.6, -1.2],
    [3.0, 1.6],
    [-3.2, 6.6],
  ];
  for (const [cx, cz] of cloverSpots) group.add(makeClover(cx, cz, rng));

  // scatter grass tufts with rejection against plaza + buildings
  const buildings: [number, number, number][] = [
    [-6.5, -4.6, 3.0],
    [6.6, -5.2, 3.6],
    [6.2, 5.2, 1.35],
  ];
  let placed = 0;
  let guard = 0;
  while (placed < 16 && guard < 200) {
    guard++;
    const x = (rng() - 0.5) * 28;
    const z = (rng() - 0.5) * 28;
    if (Math.hypot(x, z) > 14.5) continue;
    if (Math.hypot(x, z - 0) < 2.5 && Math.hypot(x, z - 0.5) < 2.8) continue;
    let ok = true;
    for (const [bx, bz, br] of buildings) {
      if (Math.hypot(x - bx, z - bz) < br + 0.4) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    group.add(makeGrassTuft(x, z, rng));
    placed++;
  }

  // ── Beach props on the sand ring ──────────────────────────────────────────
  const shells: [number, number][] = [
    [16.0, 5.5],
    [-14.5, 7.0],
    [5.5, -15.2],
  ];
  for (const [sx, sz] of shells) group.add(makeShell(sx, sz, rng));
  group.add(makeStarfish(-6.0, -15.6));
  const { log, collider: logCol } = makeDriftwood(12.6, -9.6, rng);
  group.add(log);
  colliders.push(logCol);

  // ── Rocks ─────────────────────────────────────────────────────────────────
  const boulders: [number, number, number][] = [
    [-12.5, -4.0, 0.55],
    [11.6, -4.6, 0.5],
    [-3.0, -12.6, 0.48],
    [-10.6, -7.6, 0.42],
  ];
  for (const [bx, bz, bs] of boulders) {
    const { rock, collider } = makeBoulder(bx, bz, bs, rng);
    group.add(rock);
    colliders.push(collider);
  }
  // pebbles around boulders + on the beach
  for (let i = 0; i < 10; i++) {
    const near = boulders[(rng() * boulders.length) | 0];
    const px = near[0] + (rng() - 0.5) * 1.8;
    const pz = near[1] + (rng() - 0.5) * 1.8;
    if (Math.hypot(px, pz) < 14.8) group.add(makePebble(px, pz, rng));
  }
  for (let i = 0; i < 6; i++) {
    const ang = rng() * Math.PI * 2;
    const pr = 16.2 + rng() * 1.0;
    group.add(makePebble(Math.cos(ang) * pr, Math.sin(ang) * pr, rng));
  }

  // ── Cozy corner: campfire + bench + torch, hammock, birdbath, fence ──────
  const flames: THREE.Mesh[] = [];
  const campfire = makeCampfire();
  campfire.g.position.set(-7.4, 0, 8.9);
  group.add(campfire.g);
  flames.push(...campfire.flames);
  colliders.push({ x: -7.4, z: 8.9, r: 0.85 });

  const bench = makeLogBench();
  bench.position.set(-8.6, 0, 7.8);
  bench.rotation.y = Math.atan2(-7.4 - -8.6, 8.9 - 7.8) + Math.PI / 2;
  group.add(bench);
  colliders.push({ x: -8.6, z: 7.8, r: 0.7 });

  const torch = makeTikiTorch();
  torch.g.position.set(-5.9, 0, 9.9);
  group.add(torch.g);
  flames.push(torch.flame);
  colliders.push({ x: -5.9, z: 9.9, r: 0.28 });

  const hammock = makeHammock();
  hammock.position.set(5.4, -0.04, 15.1);
  hammock.rotation.y = 1.15; // sheet length runs along the shoreline
  group.add(hammock);
  colliders.push({ x: 4.6, z: 14.3, r: 0.3 }, { x: 6.2, z: 15.9, r: 0.3 });

  const birdbath = makeBirdbath();
  birdbath.position.set(-3.6, 0, 4.6);
  group.add(birdbath);
  colliders.push({ x: -3.6, z: 4.6, r: 0.45 });

  group.add(makePicketFence(-9.9, -6.4, 7));
  colliders.push({ x: -9.9, z: -5.15, r: 0.5 });

  const towel = makeBeachTowel();
  towel.position.set(1.6, 0.0, 15.9);
  towel.rotation.y = 0.35;
  group.add(towel);

  group.add(makeHyacinth(-5.4, 2.6, 0xe87fa0, rng));
  group.add(makeHyacinth(7.6, -0.8, 0x7f9fe8, rng));
  group.add(makeHyacinth(1.8, 7.8, 0xffffff, rng));

  // ── Clouds ─────────────────────────────────────────────────────────────────
  for (let i = 0; i < 5; i++) {
    const c = makeCloud(i * 3 + 1);
    const angle = (i / 5) * Math.PI * 2;
    const radius = 26 + (i % 3) * 7;
    const y = 10 + (i % 3) * 2.2;
    c.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    c.userData = { angle, radius, speed: 0.008 + (i % 3) * 0.004, y };
    clouds.push(c);
    group.add(c);
  }

  group.add(cliffC, cliffB, cliffA, sand, wet, sea, grass, lip, walkSurface);

  // ── Interaction points (positions/radii fixed by contract) ────────────────
  const points: InteractPoint[] = [
    {
      id: 'about',
      label: locations.about.name,
      hint: locations.about.hint,
      route: locations.about.route,
      position: new THREE.Vector3(-4.6, 0, -2.1),
      markerY: 2.4,
      radius: 2.3,
    },
    {
      id: 'projects',
      label: locations.projects.name,
      hint: locations.projects.hint,
      route: locations.projects.route,
      position: new THREE.Vector3(4.4, 0, -2.3),
      markerY: 2.4,
      radius: 2.3,
    },
    {
      id: 'contact',
      label: locations.contact.name,
      hint: locations.contact.hint,
      route: locations.contact.route,
      position: new THREE.Vector3(5.4, 0, 3.6),
      markerY: 2.9,
      radius: 2.1,
    },
  ];

  return { group, walkSurface, colliders, points, clouds, foam, flames };
}
