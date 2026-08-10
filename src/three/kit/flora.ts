import * as THREE from 'three';
import { std, shadowed, G_SPHERE, G_SPHERE_LO, G_ICO, G_STEM, G_BLADE, G_PALM_SEG, G_TULIP } from './core';
import type { Collider } from './types';

// ── Palette ───────────────────────────────────────────────────────────────
const GRASS_DARK = 0x6cb83f;
const LEAF_DARK = 0x4a9d3a;
const LEAF_MID = 0x5fb74a;
const CEDAR_GREEN = 0x2f6e3a;
export const TRUNK = 0x8a5a33;
const PALM_TRUNK = 0xc98a4b;
const PALM_TRUNK_DARK = 0xb3743a;
const PALM_FROND = 0x3faf5f;
const PALM_FROND_LIGHT = 0x6fcf7f;
const COCONUT = 0x8a6a3a;
const TCORE = 0x3f9d4e;
const TRIM_LIGHT = 0x53b361;
export const TULIP_RED = 0xe85a6a;
export const TULIP_YELLOW = 0xffd94d;
export const TULIP_WHITE = 0xffffff;

// Hardwood trunk geometries (unit height, scaled per-instance) — formerly
// passed in by buildIsland; values unchanged so the trees are identical.
const G_TRUNK_LOW = new THREE.CylinderGeometry(0.18, 0.3, 1, 10);
const G_TRUNK_UP = new THREE.CylinderGeometry(0.13, 0.18, 1, 10);

export interface TreeLook {
  /** Canopy core colour (default TCORE 0x3f9d4e). */
  canopyDark?: number;
  /** Canopy rim/top lobes + sun highlight (defaults TRIM_LIGHT / LEAF_MID). */
  canopyMid?: number;
  /** Fruit color; omit for none. */
  fruit?: number;
  /** Uniform scale (default 1; saplings ~0.55). */
  scale?: number;
}

// ── Hardwood tree: curved tapered trunk + overlapping puffy canopy ─────────
export function makeHardwoodTree(
  rng: () => number,
  x: number,
  z: number,
  look: TreeLook = {},
): { tree: THREE.Group; collider: Collider } {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rng() * Math.PI * 2;

  const lean = (rng() - 0.5) * 0.28;
  const trunkH = 1.55 + rng() * 0.45;
  const tLow = shadowed(new THREE.Mesh(G_TRUNK_LOW, std(TRUNK)));
  tLow.scale.y = trunkH * 0.6;
  tLow.position.y = (trunkH * 0.6) / 2;
  const tUp = shadowed(new THREE.Mesh(G_TRUNK_UP, std(TRUNK)));
  tUp.scale.y = trunkH * 0.52;
  tUp.position.set(lean * 0.6, trunkH * 0.6 + (trunkH * 0.52) / 2, 0);
  tUp.rotation.z = lean;
  g.add(tLow, tUp);

  const cy = trunkH + 0.42;
  const s = 0.92 + rng() * 0.22;
  const coreR = 1.05 * s;
  const rimR = coreR * 0.45;
  const matCore = std(look.canopyDark ?? TCORE);
  const matLight = std(look.canopyMid ?? TRIM_LIGHT);

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
  const hi = shadowed(new THREE.Mesh(G_SPHERE_LO, std(look.canopyMid ?? LEAF_MID)));
  hi.position.set(-0.15 * s, cy + 0.5, -0.3 * s);
  hi.scale.set(0.6 * s, 0.42 * s, 0.6 * s);
  g.add(hi);

  if (look.fruit !== undefined) {
    const fmat = std(look.fruit, 0.5);
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
  const scale = look.scale ?? 1;
  if (scale !== 1) g.scale.setScalar(scale);
  return { tree: g, collider: { x, z, r: 0.62 * scale } };
}

// ── Palm tree: curved segmented trunk + drooping fronds + coconuts ──────────
export function makePalm(
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
export function makeCedar(
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
export function makeBush(x: number, z: number, rng: () => number): { bush: THREE.Group; collider: Collider } {
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

// ── Flower: stem + 5-6 radial petals tilted outward + raised dome centre ───
export function makeFlower(x: number, z: number, color: number, rng: () => number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rng() * Math.PI * 2;
  const h = 0.3 + rng() * 0.12;
  const stem = new THREE.Mesh(G_STEM, std(0x3f8c2a));
  stem.scale.y = h / 0.34;
  stem.position.y = h / 2;
  g.add(stem);

  const cy = h + 0.05;
  const pmat = std(color, 0.5);
  const n = rng() > 0.5 ? 6 : 5;
  // Orient each petal so its long axis (local +Z) points radially outward,
  // then tilt the outer tip gently down — an open, fanned AC blossom.
  const localZ = new THREE.Vector3(0, 0, 1);
  const tiltQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.42);
  const radial = new THREE.Vector3();
  const ringR = 0.085;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    radial.set(Math.cos(a), 0, Math.sin(a));
    const p = new THREE.Mesh(G_SPHERE_LO, pmat);
    p.scale.set(0.072, 0.034, 0.12); // rounded petal, elongated radially (local +Z)
    p.position.set(radial.x * ringR, cy, radial.z * ringR);
    p.quaternion.setFromUnitVectors(localZ, radial).multiply(tiltQ);
    g.add(p);
  }
  // raised dome centre (yellow) sitting clearly above the petal plane
  const center = new THREE.Mesh(G_SPHERE_LO, std(0xffd94d, 0.4));
  center.position.y = cy + 0.05;
  center.scale.set(0.072, 0.05, 0.072);
  g.add(center);
  // 1-2 small leaf blades on the stem
  const leafMat = std(0x4a9d3a);
  const leafN = rng() > 0.5 ? 2 : 1;
  for (let i = 0; i < leafN; i++) {
    const side = i === 0 ? 1 : -1;
    const leaf = new THREE.Mesh(G_SPHERE_LO, leafMat);
    leaf.position.set(side * 0.07, h * (0.45 + i * 0.25), 0);
    leaf.scale.set(0.1, 0.026, 0.045);
    leaf.rotation.z = side * -0.6;
    g.add(leaf);
  }
  return g;
}

export function makeFlowerCluster(cx: number, cz: number, colors: number[], rng: () => number): THREE.Group {
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
export function makeTulip(x: number, z: number, color: number, rng: () => number): THREE.Group {
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
  // rounded torus rim softens the cup mouth (AC tulips flare slightly)
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.09 * cs, 0.017, 8, 20), std(color, 0.85));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = h + 0.31 * cs;
  g.add(rim);

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

export function makeTulipCluster(cx: number, cz: number, colors: number[], rng: () => number): THREE.Group {
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
export function makeMushroom(x: number, z: number, red: boolean, rng: () => number): THREE.Group {
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
export function makeWeedTuft(x: number, z: number, rng: () => number): THREE.Group {
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

export function makeClover(x: number, z: number, rng: () => number): THREE.Group {
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

export function makeGrassTuft(x: number, z: number, rng: () => number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rng() * Math.PI * 2;
  const mat = std(rng() > 0.5 ? GRASS_DARK : 0x6cc24a);
  const base = 0.6 + rng() * 0.4;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const b = new THREE.Mesh(G_BLADE, mat);
    b.position.set(Math.cos(a) * 0.03, 0.16, Math.sin(a) * 0.03);
    b.rotation.y = a;
    b.rotation.z = -0.35; // splay the blade outward into a 3-blade fan
    const s = base * (0.85 + rng() * 0.3);
    b.scale.set(s * 0.8, s, s * 0.8);
    g.add(b);
  }
  return g;
}

// ── Beach props: shells, starfish, driftwood ───────────────────────────────
export function makeShell(x: number, z: number, rng: () => number): THREE.Group {
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

export function makeStarfish(x: number, z: number): THREE.Group {
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

export function makeDriftwood(x: number, z: number, rng: () => number): { log: THREE.Group; collider: Collider } {
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
export function makeBoulder(x: number, z: number, s: number, rng: () => number): { rock: THREE.Mesh; collider: Collider } {
  const mat = std(rng() > 0.5 ? 0x9a9aa2 : 0x84848c);
  const m = shadowed(new THREE.Mesh(G_ICO, mat), true, true);
  m.position.set(x, s * 0.5, z);
  m.scale.set(s, s * 0.66, s * 0.9);
  m.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
  return { rock: m, collider: { x, z, r: s * 0.75 } };
}

export function makePebble(x: number, z: number, rng: () => number): THREE.Mesh {
  const m = shadowed(new THREE.Mesh(G_ICO, std(rng() > 0.5 ? 0x9a9aa2 : 0x80808a)), true, true);
  m.position.set(x, 0.04, z);
  const s = 0.1 + rng() * 0.08;
  m.scale.set(s, s * 0.55, s);
  m.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
  return m;
}

/** Hyacinth — stem with a dense spike of tiny blooms. */
export function makeHyacinth(x: number, z: number, color: number, rng: () => number): THREE.Group {
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
