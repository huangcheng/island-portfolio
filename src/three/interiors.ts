/**
 * Interior scenes for the Animal Crossing portfolio.
 *
 * Two fully-procedural rooms rendered entirely with three.js primitives + canvas
 * textures (no external assets). The engine swaps a whole `THREE.Scene` per
 * interior, so every room owns its own lights and geometry.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Collider, InteractPoint } from './island';
import { projects, type Project } from '../content';

export interface InteriorBuild {
  scene: THREE.Scene;
  spawn: THREE.Vector3;
  walkSurface: THREE.Mesh;
  colliders: Collider[];
  points: InteractPoint[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export function buildInterior(kind: 'house' | 'museum'): InteriorBuild {
  return kind === 'museum' ? buildMuseum() : buildHouse();
}

// ── Palette ────────────────────────────────────────────────────────────────
const PAL = {
  creamWall: 0xf2ead8,
  baseboard: 0x5a3a1f,
  woodDark: 0x6e4424,
  woodMid: 0x8a5a33,
  woodLight: 0xb07a45,
  gold: 0xd4a017,
  goldDark: 0x9a7012,
  mat: 0x241b14,
  red: 0xe2574c,
  redDeep: 0xa8463e,
  cream: 0xfff2d0,
  green: 0x6cb83f,
  sky: 0xbfe6f5,
  stone: 0xd8cdb5,
  stoneDark: 0xbfb39a,
  yellow: 0xffd94d,
};

// ── Helpers ────────────────────────────────────────────────────────────────
function std(color: number, roughness = 0.85): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
}

function rbox(w: number, h: number, d: number, r: number): RoundedBoxGeometry {
  return new RoundedBoxGeometry(w, h, d, 3, r);
}

function cv(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const hexc = (n: number): string => '#' + n.toString(16).padStart(6, '0');

function makeTex(c: HTMLCanvasElement, rx = 1, ry = 1, tile = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (tile) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
  }
  return t;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Floor & wall textures ──────────────────────────────────────────────────

/** Warm horizontal wood planks with per-plank tone jitter + grain. */
function makePlankTexture(): THREE.CanvasTexture {
  const S = 512;
  const c = cv(S, S);
  const ctx = c.getContext('2d')!;
  const plankH = 64;
  const rows = Math.ceil(S / plankH);
  const tones = ['#b07a45', '#a8703f', '#bb8550', '#a06536', '#b87d4a'];
  const rng = mulberry32(7);
  for (let i = 0; i < rows; i++) {
    ctx.fillStyle = tones[i % tones.length];
    ctx.globalAlpha = 0.92 + rng() * 0.08;
    ctx.fillRect(0, i * plankH, S, plankH);
    ctx.globalAlpha = 1;
    // seam
    ctx.strokeStyle = '#5a3a1f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, i * plankH);
    ctx.lineTo(S, i * plankH);
    ctx.stroke();
    // grain streaks
    ctx.strokeStyle = 'rgba(70,42,18,0.13)';
    ctx.lineWidth = 1;
    for (let g = 0; g < 5; g++) {
      ctx.beginPath();
      const gy = i * plankH + 6 + g * 12;
      ctx.moveTo(0, gy);
      for (let x = 0; x <= S; x += 40) {
        ctx.lineTo(x, gy + Math.sin(x * 0.04 + i * 1.7 + g) * 2.2);
      }
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  return makeTex(c, 6, 5, true);
}

/** Pale-green vertical pinstripe wallpaper. */
function makeWallpaperTexture(): THREE.CanvasTexture {
  const S = 256;
  const c = cv(S, S);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#e8f2dc';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#d6e6c8';
  for (let x = 6; x < S; x += 14) ctx.fillRect(x, 0, 3, S);
  ctx.fillStyle = 'rgba(170,196,150,0.5)';
  for (let x = 13; x < S; x += 14) ctx.fillRect(x, 0, 1, S);
  return makeTex(c, 4, 3, true);
}

/** Round rug: colored border ring + center field + decorative inner ring. */
function makeRugTexture(ring: number, center: number): THREE.CanvasTexture {
  const S = 256;
  const c = cv(S, S);
  const ctx = c.getContext('2d')!;
  const m = S / 2;
  ctx.fillStyle = hexc(ring);
  ctx.beginPath();
  ctx.arc(m, m, S / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hexc(center);
  ctx.beginPath();
  ctx.arc(m, m, S / 2 - 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = hexc(ring);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(m, m, S / 2 - 48, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = hexc(center);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(m, m, S / 2 - 60, 0, Math.PI * 2);
  ctx.stroke();
  return makeTex(c);
}

// ── Gallery / photo art canvases ───────────────────────────────────────────

function seelieArtCanvas(): HTMLCanvasElement {
  const W = 380;
  const H = 260;
  const c = cv(W, H);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffd94d';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#5a3a1f';
  const paws: Array<[number, number, number]> = [
    [70, 72, 0.5],
    [198, 112, -0.3],
    [292, 64, 0.2],
    [108, 166, 0.1],
    [300, 168, -0.4],
  ];
  for (const [px, py, rot] of paws) {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot);
    for (let i = 0; i < 4; i++) {
      const a = -0.7 + i * 0.45;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 15, -10 + Math.sin(a) * 7, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(0, 9, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#5a3a1f';
  ctx.font = '800 30px "Baloo 2", "Arial Rounded MT Bold", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Seelie', W / 2, H - 26);
  return c;
}

function bridgeArtCanvas(): HTMLCanvasElement {
  const W = 380;
  const H = 260;
  const c = cv(W, H);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#889df0';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  // main suspension arc
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(W / 2, 175, 120, Math.PI, 0);
  ctx.stroke();
  // deck
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(55, 175);
  ctx.lineTo(W - 55, 175);
  ctx.stroke();
  // towers
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 120, 60);
  ctx.lineTo(W / 2 - 120, 175);
  ctx.moveTo(W / 2 + 120, 60);
  ctx.lineTo(W / 2 + 120, 175);
  ctx.stroke();
  // vertical suspenders
  ctx.lineWidth = 2.5;
  for (let i = -3; i <= 3; i++) {
    const x = W / 2 + i * 32;
    const dy = 175 - Math.sqrt(Math.max(0, 120 * 120 - (x - W / 2) ** 2));
    ctx.beginPath();
    ctx.moveTo(x, dy);
    ctx.lineTo(x, 175);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 22px "Baloo 2", "Arial Rounded MT Bold", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Obsidian Notes Bridge', W / 2, H - 22);
  return c;
}

function solarArtCanvas(): HTMLCanvasElement {
  const W = 380;
  const H = 260;
  const c = cv(W, H);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#1b2a3a';
  ctx.fillRect(0, 0, W, H);
  const rng = mulberry32(23);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 70; i++) {
    ctx.globalAlpha = 0.5 + rng() * 0.5;
    ctx.beginPath();
    ctx.arc(rng() * W, rng() * H, rng() * 1.5 + 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // orbit rings
  ctx.strokeStyle = 'rgba(180,210,255,0.45)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(W / 2, 128, 50 + i * 38, 18 + i * 12, -0.3, 0, Math.PI * 2);
    ctx.stroke();
  }
  // planet
  const grd = ctx.createRadialGradient(W / 2 - 8, 120, 4, W / 2, 130, 30);
  grd.addColorStop(0, '#6fc0ff');
  grd.addColorStop(0.6, '#3a7fd0');
  grd.addColorStop(1, '#1d4a86');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(W / 2, 130, 28, 0, Math.PI * 2);
  ctx.fill();
  // moon
  ctx.fillStyle = '#d8d8d8';
  ctx.beginPath();
  ctx.arc(W / 2 + 72, 110, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d8e6ff';
  ctx.font = '800 24px "Baloo 2", "Arial Rounded MT Bold", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Solar System', W / 2, H - 22);
  return c;
}

/** Mini island scene for the house photo. */
function photoArtCanvas(): HTMLCanvasElement {
  const W = 300;
  const H = 240;
  const c = cv(W, H);
  const ctx = c.getContext('2d')!;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#bfe6f5');
  sky.addColorStop(1, '#e8f5fa');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#4f86c6';
  ctx.beginPath();
  ctx.arc(W / 2, H / 2 + 10, 112, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#9fe4f2';
  ctx.beginPath();
  ctx.arc(W / 2, H / 2 + 10, 96, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6cb83f';
  ctx.beginPath();
  ctx.arc(W / 2, H / 2 + 10, 78, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7ec850';
  ctx.beginPath();
  ctx.arc(W / 2 - 14, H / 2 - 2, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e2574c';
  ctx.fillRect(W / 2 - 20, H / 2 - 14, 40, 30);
  ctx.fillStyle = '#a8463e';
  ctx.beginPath();
  ctx.moveTo(W / 2 - 26, H / 2 - 14);
  ctx.lineTo(W / 2, H / 2 - 40);
  ctx.lineTo(W / 2 + 26, H / 2 - 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5a3a1f';
  ctx.fillRect(W / 2 - 6, H / 2 + 2, 12, 14);
  return c;
}

/** Glowing code-editor screen texture for the laptop. */
function laptopArtCanvas(): HTMLCanvasElement {
  const W = 256;
  const H = 160;
  const c = cv(W, H);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#162234';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#0d1626';
  ctx.fillRect(0, 0, W, 18);
  const dots = ['#ff7f7f', '#ffcf5f', '#5fd08a'];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = dots[i];
    ctx.beginPath();
    ctx.arc(14 + i * 14, 9, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  const rng = mulberry32(5);
  const palette = ['#7dd3fc', '#c4b5fd', '#86efac', '#fda4af', '#fcd34d', '#e5e7eb'];
  let y = 36;
  const indent = [3, 2, 4, 1, 2, 3, 2, 4];
  for (let i = 0; i < indent.length; i++) {
    let x = 14 + (indent[i] - 1) * 14;
    const segs = 2 + ((rng() * 4) | 0);
    for (let s = 0; s < segs && x < W - 20; s++) {
      const w = 22 + rng() * 46;
      ctx.fillStyle = palette[(rng() * palette.length) | 0];
      ctx.fillRect(x, y, w, 8);
      x += w + 8;
    }
    y += 15;
  }
  return c;
}

// ── Furniture / prop builders ──────────────────────────────────────────────

/** Layered gilded (or wooden) picture frame with dark mat + canvas art.
 *  Built facing +Z. */
function makeFrame(
  art: HTMLCanvasElement,
  w: number,
  h: number,
  x: number,
  y: number,
  z: number,
  gold = true,
): THREE.Group {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({
    color: gold ? PAL.gold : PAL.woodLight,
    roughness: gold ? 0.4 : 0.7,
    metalness: gold ? 0.55 : 0,
  });
  const edge = new THREE.Mesh(rbox(w + 0.08, h + 0.08, 0.06, 0.04), std(gold ? PAL.goldDark : PAL.woodDark, 0.5));
  edge.position.z = -0.05;
  const back = new THREE.Mesh(rbox(w, h, 0.1, 0.06), frameMat);
  const matW = w - 0.4;
  const matH = h - 0.4;
  const mat = new THREE.Mesh(new THREE.BoxGeometry(matW, matH, 0.04), std(PAL.mat, 0.9));
  mat.position.z = 0.05;
  const artMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(matW - 0.1, matH - 0.1),
    new THREE.MeshStandardMaterial({ map: makeTex(art), roughness: 0.7 }),
  );
  artMesh.position.z = 0.08;
  g.add(edge, back, mat, artMesh);
  g.position.set(x, y, z);
  return g;
}

/** Long dark-wood museum bench (seat + two slab ends). Faces +Z. */
function makeBench(): THREE.Group {
  const g = new THREE.Group();
  const wood = std(PAL.woodDark, 0.9);
  const seat = new THREE.Mesh(rbox(2.2, 0.14, 0.62, 0.06), wood);
  seat.position.y = 0.5;
  const legGeo = rbox(0.16, 0.5, 0.56, 0.04);
  const lL = new THREE.Mesh(legGeo, wood);
  lL.position.set(-0.92, 0.25, 0);
  const lR = new THREE.Mesh(legGeo, wood);
  lR.position.set(0.92, 0.25, 0);
  g.add(seat, lL, lR);
  return g;
}

/** Blathers-style owl figurine: brown body + wings + big yellow eyes + tufts. */
function makeOwlFigurine(): THREE.Group {
  const g = new THREE.Group();
  const brown = std(PAL.woodMid, 0.85);
  const brownLt = std(PAL.woodLight, 0.85);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 14), brown);
  body.scale.y = 1.1;
  body.position.y = 0.26;
  const wingGeo = new THREE.SphereGeometry(0.17, 12, 10);
  const wL = new THREE.Mesh(wingGeo, brownLt);
  wL.scale.set(0.5, 0.95, 0.7);
  wL.position.set(-0.23, 0.26, 0.02);
  const wR = new THREE.Mesh(wingGeo, brownLt);
  wR.scale.set(0.5, 0.95, 0.7);
  wR.position.set(0.23, 0.26, 0.02);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 14), brown);
  head.position.y = 0.58;
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 14), std(PAL.cream, 0.9));
  face.scale.set(1, 1, 0.5);
  face.position.set(0, 0.6, 0.12);
  const eyeGeo = new THREE.SphereGeometry(0.09, 14, 12);
  const eyeMat = std(PAL.yellow, 0.5);
  const eL = new THREE.Mesh(eyeGeo, eyeMat);
  eL.position.set(-0.1, 0.64, 0.18);
  const eR = new THREE.Mesh(eyeGeo, eyeMat);
  eR.position.set(0.1, 0.64, 0.18);
  const pupilGeo = new THREE.SphereGeometry(0.045, 12, 10);
  const pupilMat = std(0x20140a, 0.5);
  const pL = new THREE.Mesh(pupilGeo, pupilMat);
  pL.position.set(-0.1, 0.64, 0.25);
  const pR = new THREE.Mesh(pupilGeo, pupilMat);
  pR.position.set(0.1, 0.64, 0.25);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.13, 6), std(0xe89a3c, 0.5));
  beak.rotation.x = Math.PI;
  beak.position.set(0, 0.5, 0.22);
  const tuftGeo = new THREE.ConeGeometry(0.05, 0.15, 6);
  const tL = new THREE.Mesh(tuftGeo, brown);
  tL.position.set(-0.16, 0.8, 0);
  tL.rotation.z = 0.4;
  const tR = new THREE.Mesh(tuftGeo, brown);
  tR.position.set(0.16, 0.8, 0);
  tR.rotation.z = -0.4;
  g.add(body, wL, wR, head, face, eL, eR, pL, pR, beak, tL, tR);
  return g;
}

/** Window: rounded frame + glowing sky plane + cross muntins. Faces +Z. */
function makeWindow(w: number, h: number): THREE.Group {
  const g = new THREE.Group();
  const paint = std(0xf7f4ec, 0.9);
  const frame = new THREE.Mesh(rbox(w, h, 0.12, 0.06), paint);
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(w - 0.2, h - 0.2),
    new THREE.MeshStandardMaterial({
      color: PAL.sky,
      roughness: 0.2,
      metalness: 0.1,
      emissive: 0x6fa8c8,
      emissiveIntensity: 0.35,
    }),
  );
  glass.position.z = 0.05;
  const mV = new THREE.Mesh(new THREE.BoxGeometry(0.05, h - 0.2, 0.05), paint);
  mV.position.z = 0.08;
  const mH = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.05, 0.05), paint);
  mH.position.z = 0.08;
  g.add(frame, glass, mV, mH);
  return g;
}

/** Wall-mounted gallery sconce: bracket + warm glowing bulb. Faces +Z. */
function makeSconce(): THREE.Group {
  const g = new THREE.Group();
  const bracket = new THREE.Mesh(rbox(0.14, 0.34, 0.1, 0.03), std(PAL.goldDark, 0.5));
  bracket.position.y = -0.05;
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0xfff2c9, emissive: 0xffd9a0, emissiveIntensity: 1.4, roughness: 0.4 }),
  );
  bulb.position.y = 0.12;
  g.add(bracket, bulb);
  return g;
}

/** Wooden desk + open laptop with glowing code screen. Faces +Z (front). */
function makeDeskSet(): THREE.Group {
  const g = new THREE.Group();
  const woodLt = std(PAL.woodLight, 0.85);
  const woodDk = std(PAL.woodDark, 0.9);
  const top = new THREE.Mesh(rbox(1.7, 0.08, 0.75, 0.03), woodLt);
  top.position.y = 0.78;
  g.add(top);
  const legGeo = rbox(0.1, 0.78, 0.1, 0.02);
  const legPts: Array<[number, number]> = [
    [-0.78, -0.3],
    [0.78, -0.3],
    [-0.78, 0.3],
    [0.78, 0.3],
  ];
  for (const [lx, lz] of legPts) {
    const leg = new THREE.Mesh(legGeo, woodDk);
    leg.position.set(lx, 0.39, lz);
    g.add(leg);
  }
  const drawer = new THREE.Mesh(rbox(1.5, 0.22, 0.04, 0.02), woodDk);
  drawer.position.set(0, 0.5, 0.38);
  g.add(drawer);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), std(PAL.gold, 0.5));
  knob.position.set(0, 0.5, 0.41);
  g.add(knob);
  // laptop
  const laptop = new THREE.Group();
  const base = new THREE.Mesh(rbox(0.62, 0.04, 0.44, 0.02), std(0x3a3a42, 0.55));
  laptop.add(base);
  const screenMat = new THREE.MeshStandardMaterial({
    map: makeTex(laptopArtCanvas()),
    roughness: 0.35,
    metalness: 0.1,
    emissive: 0x2a4a6a,
    emissiveIntensity: 0.5,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.36), screenMat);
  screen.position.set(0, 0.2, -0.2);
  screen.rotation.x = -0.22;
  const sback = new THREE.Mesh(rbox(0.62, 0.4, 0.03, 0.02), std(0x26262c, 0.6));
  sback.position.set(0, 0.2, -0.2);
  sback.rotation.x = -0.22;
  laptop.add(screen, sback);
  laptop.position.set(0, 0.82, 0.04);
  g.add(laptop);
  return g;
}

/** Simple chair (seat + 4 legs + backrest). Faces +Z. */
function makeChair(): THREE.Group {
  const g = new THREE.Group();
  const pad = std(PAL.redDeep, 0.85);
  const wood = std(PAL.woodDark, 0.9);
  const seat = new THREE.Mesh(rbox(0.5, 0.08, 0.5, 0.04), pad);
  seat.position.y = 0.46;
  const legGeo = rbox(0.06, 0.46, 0.06, 0.02);
  const pts: Array<[number, number]> = [
    [-0.2, -0.2],
    [0.2, -0.2],
    [-0.2, 0.2],
    [0.2, 0.2],
  ];
  for (const [lx, lz] of pts) {
    const cl = new THREE.Mesh(legGeo, wood);
    cl.position.set(lx, 0.23, lz);
    g.add(cl);
  }
  const back = new THREE.Mesh(rbox(0.5, 0.5, 0.08, 0.04), pad);
  back.position.set(0, 0.75, -0.21);
  g.add(seat, back);
  return g;
}

/** Cozy pastel bed: frame + mattress + blanket + pillow + headboard. */
function makeBed(): THREE.Group {
  const g = new THREE.Group();
  const frame = std(PAL.woodDark, 0.9);
  const base = new THREE.Mesh(rbox(1.5, 0.3, 2.2, 0.06), frame);
  base.position.y = 0.18;
  const mattress = new THREE.Mesh(rbox(1.4, 0.22, 2.1, 0.06), std(PAL.cream, 0.9));
  mattress.position.y = 0.42;
  const blank = new THREE.Mesh(rbox(1.44, 0.14, 1.3, 0.05), std(PAL.red, 0.9));
  blank.position.set(0, 0.5, 0.35);
  const pillow = new THREE.Mesh(rbox(1.1, 0.16, 0.5, 0.06), std(0xffffff, 0.9));
  pillow.position.set(0, 0.52, -0.75);
  const head = new THREE.Mesh(rbox(1.5, 0.7, 0.12, 0.06), frame);
  head.position.set(0, 0.5, -1.1);
  g.add(base, mattress, blank, pillow, head);
  return g;
}

/** Bookshelf: carcass + back + 3 shelves of colorful tiny book boxes. Faces +Z. */
function makeBookshelf(): THREE.Group {
  const g = new THREE.Group();
  const dark = std(PAL.woodDark, 0.9);
  const light = std(PAL.woodLight, 0.9);
  const carcass = new THREE.Mesh(rbox(1.2, 2.0, 0.4, 0.04), dark);
  carcass.position.y = 1.0;
  g.add(carcass);
  const backp = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.9, 0.04), light);
  backp.position.set(0, 1.0, -0.16);
  g.add(backp);
  const bookColors = [0xe2574c, 0x4f86c6, 0xffd94d, 0x6cb83f, 0xc58cff, 0xff9a5c];
  const rng = mulberry32(99);
  for (let s = 0; s < 3; s++) {
    const sy = 0.55 + s * 0.55;
    const shelf = new THREE.Mesh(rbox(1.12, 0.04, 0.36, 0.02), light);
    shelf.position.set(0, sy, 0);
    g.add(shelf);
    let bx = -0.5;
    let guard = 0;
    while (bx < 0.5 && guard < 14) {
      guard++;
      const bw = 0.07 + rng() * 0.05;
      const bh = 0.36 + rng() * 0.08;
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(bw, bh, 0.28),
        std(bookColors[(rng() * bookColors.length) | 0], 0.85),
      );
      book.position.set(bx + bw / 2, sy + 0.02 + bh / 2, 0.02);
      g.add(book);
      bx += bw + 0.012;
    }
  }
  return g;
}

// ── Wall / baseboard helper ────────────────────────────────────────────────
function addBox(
  scene: THREE.Scene,
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  scene.add(m);
  return m;
}

// ============================================================================
// MUSEUM — Project Gallery
// ============================================================================

function buildMuseum(): InteriorBuild {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf2ead8);
  const colliders: Collider[] = [];
  const points: InteractPoint[] = [];

  const minX = -8;
  const maxX = 8;
  const minZ = -5.5;
  const maxZ = 5.5;
  const WH = 4;
  const T = 0.25;

  // ── Floor ──
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(maxX - minX, maxZ - minZ),
    new THREE.MeshStandardMaterial({ map: makePlankTexture(), roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  scene.add(floor);

  const walkSurface = new THREE.Mesh(
    new THREE.PlaneGeometry(maxX - minX, maxZ - minZ),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  walkSurface.rotation.x = -Math.PI / 2;
  walkSurface.position.y = 0.02;
  scene.add(walkSurface);

  // ── Walls (cream) — south wall split for a 2-wide door gap ──
  const wallMat = std(PAL.creamWall, 0.95);
  addBox(scene, maxX - minX, WH, T, wallMat, 0, WH / 2, minZ); // north
  addBox(scene, T, WH, maxZ - minZ, wallMat, maxX, WH / 2, 0); // east
  addBox(scene, T, WH, maxZ - minZ, wallMat, minX, WH / 2, 0); // west
  const segW = (maxX - minX - 2) / 2; // 7
  addBox(scene, segW, WH, T, wallMat, -(segW / 2 + 1), WH / 2, maxZ); // south-L
  addBox(scene, segW, WH, T, wallMat, segW / 2 + 1, WH / 2, maxZ); // south-R
  addBox(scene, 2.4, 1.0, T, wallMat, 0, WH - 0.5, maxZ); // door lintel
  const trimMat = std(PAL.woodMid, 0.85);
  const postL = new THREE.Mesh(rbox(0.14, 3.0, 0.14, 0.04), trimMat);
  postL.position.set(-1.05, 1.5, maxZ);
  scene.add(postL);
  const postR = new THREE.Mesh(rbox(0.14, 3.0, 0.14, 0.04), trimMat);
  postR.position.set(1.05, 1.5, maxZ);
  scene.add(postR);

  // ── Baseboards ──
  const bbMat = std(PAL.baseboard, 0.9);
  const bbH = 0.3;
  const inZ = 0.08;
  addBox(scene, maxX - minX, bbH, 0.08, bbMat, 0, bbH / 2, minZ + 0.17);
  addBox(scene, segW, bbH, inZ, bbMat, -(segW / 2 + 1), bbH / 2, maxZ - 0.17);
  addBox(scene, segW, bbH, inZ, bbMat, segW / 2 + 1, bbH / 2, maxZ - 0.17);
  addBox(scene, 0.08, bbH, maxZ - minZ, bbMat, maxX - 0.17, bbH / 2, 0);
  addBox(scene, 0.08, bbH, maxZ - minZ, bbMat, minX + 0.17, bbH / 2, 0);

  // ── Three gilded frames on the north wall ──
  const frameZ = minZ + 0.2; // just in front of the inside face
  const frameY = 2.1;
  const frameXs = [-4.6, 0, 4.6];
  const arts = [seelieArtCanvas(), bridgeArtCanvas(), solarArtCanvas()];
  for (let i = 0; i < 3; i++) {
    scene.add(makeFrame(arts[i], 1.9, 1.35, frameXs[i], frameY, frameZ));
    const plaque = new THREE.Mesh(rbox(0.7, 0.18, 0.06, 0.03), std(PAL.cream, 0.9));
    plaque.position.set(frameXs[i], frameY - 0.9, frameZ + 0.06);
    scene.add(plaque);
    const proj: Project = projects[i];
    points.push({
      id: `exhibit-${i}`,
      label: proj.title,
      hint: 'View exhibit',
      exhibit: proj,
      position: new THREE.Vector3(frameXs[i], 0, -4.15),
      markerY: 1.5,
      radius: 1.5,
    });
    // warm gallery spot above each frame
    const spot = new THREE.PointLight(0xffd9a0, 6, 8, 1.6);
    spot.position.set(frameXs[i], 3.3, -4.4);
    scene.add(spot);
  }

  // ── Wall sconces flanking the centre frame ──
  for (const sx of [-1.7, 1.7]) {
    const sc = makeSconce();
    sc.position.set(sx, 2.7, frameZ + 0.02);
    scene.add(sc);
  }

  // ── Side-wall windows (grand-hall clerestory) ──
  const winE = makeWindow(1.6, 1.4);
  winE.position.set(maxX - 0.16, 2.7, 0);
  winE.rotation.y = -Math.PI / 2;
  scene.add(winE);
  const winW = makeWindow(1.6, 1.4);
  winW.position.set(minX + 0.16, 2.7, 0);
  winW.rotation.y = Math.PI / 2;
  scene.add(winW);

  // ── Centre: round rug + long bench ──
  const rug = new THREE.Mesh(
    new THREE.CircleGeometry(2.2, 48),
    new THREE.MeshStandardMaterial({ map: makeRugTexture(PAL.red, PAL.cream), roughness: 0.95 }),
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.025, 0);
  scene.add(rug);

  const bench = makeBench();
  bench.position.set(0, 0, 0.2);
  scene.add(bench);
  colliders.push({ x: 0, z: 0.2, r: 0.9 });

  // ── Corner: owl figurine on a stone pedestal ──
  const pedX = 6.7;
  const pedZ = 3.8;
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.5, 0.9, 18),
    std(PAL.stone, 0.95),
  );
  pedestal.position.set(pedX, 0.45, pedZ);
  scene.add(pedestal);
  const owl = makeOwlFigurine();
  owl.position.set(pedX, 0.9, pedZ);
  scene.add(owl);
  colliders.push({ x: pedX, z: pedZ, r: 0.5 });

  // ── Lighting ──
  scene.add(new THREE.HemisphereLight(0xfff2d0, 0xb07a45, 1.1));

  // ── Exit + spawn + bounds ──
  points.push({
    id: 'exit',
    label: 'Door',
    hint: 'Back to the island',
    exit: true,
    position: new THREE.Vector3(0, 0, 4.4),
    markerY: 2.2,
    radius: 1.6,
  });

  return {
    scene,
    spawn: new THREE.Vector3(0, 0, 3.4),
    walkSurface,
    colliders,
    points,
    bounds: { minX: minX + 0.5, maxX: maxX - 0.5, minZ: minZ + 0.5, maxZ: maxZ - 0.5 },
  };
}

// ============================================================================
// HOUSE — About room
// ============================================================================

function buildHouse(): InteriorBuild {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeef5e2);
  const colliders: Collider[] = [];
  const points: InteractPoint[] = [];

  const minX = -6;
  const maxX = 6;
  const minZ = -4.5;
  const maxZ = 4.5;
  const WH = 3.6;
  const T = 0.22;

  // ── Floor ──
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(maxX - minX, maxZ - minZ),
    new THREE.MeshStandardMaterial({ map: makePlankTexture(), roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  scene.add(floor);

  const walkSurface = new THREE.Mesh(
    new THREE.PlaneGeometry(maxX - minX, maxZ - minZ),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  walkSurface.rotation.x = -Math.PI / 2;
  walkSurface.position.y = 0.02;
  scene.add(walkSurface);

  // ── Walls (pinstripe wallpaper) — south split for door gap ──
  const wallMat = new THREE.MeshStandardMaterial({ map: makeWallpaperTexture(), roughness: 0.95 });
  addBox(scene, maxX - minX, WH, T, wallMat, 0, WH / 2, minZ); // north
  addBox(scene, T, WH, maxZ - minZ, wallMat, maxX, WH / 2, 0); // east
  addBox(scene, T, WH, maxZ - minZ, wallMat, minX, WH / 2, 0); // west
  const segW = (maxX - minX - 2) / 2; // 5
  addBox(scene, segW, WH, T, wallMat, -(segW / 2 + 1), WH / 2, maxZ); // south-L
  addBox(scene, segW, WH, T, wallMat, segW / 2 + 1, WH / 2, maxZ); // south-R
  addBox(scene, 2.4, 0.9, T, wallMat, 0, WH - 0.45, maxZ); // lintel
  const trimMat = std(PAL.woodMid, 0.85);
  const postL = new THREE.Mesh(rbox(0.14, 2.6, 0.14, 0.04), trimMat);
  postL.position.set(-1.05, 1.3, maxZ);
  scene.add(postL);
  const postR = new THREE.Mesh(rbox(0.14, 2.6, 0.14, 0.04), trimMat);
  postR.position.set(1.05, 1.3, maxZ);
  scene.add(postR);

  // ── Baseboards ──
  const bbMat = std(PAL.baseboard, 0.9);
  const bbH = 0.28;
  addBox(scene, maxX - minX, bbH, 0.08, bbMat, 0, bbH / 2, minZ + 0.16);
  addBox(scene, segW, bbH, 0.08, bbMat, -(segW / 2 + 1), bbH / 2, maxZ - 0.16);
  addBox(scene, segW, bbH, 0.08, bbMat, segW / 2 + 1, bbH / 2, maxZ - 0.16);
  addBox(scene, 0.08, bbH, maxZ - minZ, bbMat, maxX - 0.16, bbH / 2, 0);
  addBox(scene, 0.08, bbH, maxZ - minZ, bbMat, minX + 0.16, bbH / 2, 0);

  // ── West wall: desk + laptop + chair ──
  const deskX = -5.35;
  const deskZ = -0.6;
  const desk = makeDeskSet();
  desk.rotation.y = Math.PI / 2; // front faces +X (into room)
  desk.position.set(deskX, 0, deskZ);
  scene.add(desk);
  colliders.push({ x: deskX, z: deskZ, r: 0.9 });

  const chair = makeChair();
  chair.rotation.y = -Math.PI / 2; // face the desk (-X)
  chair.position.set(-4.7, 0, deskZ);
  scene.add(chair);

  points.push({
    id: 'desk',
    label: 'My Desk',
    hint: 'About me',
    route: '/about',
    position: new THREE.Vector3(-4.4, 0, deskZ),
    markerY: 1.6,
    radius: 1.5,
  });

  // ── North wall: framed island photo ──
  const photoZ = minZ + 0.17;
  scene.add(makeFrame(photoArtCanvas(), 1.5, 1.2, 1.8, 2.0, photoZ, false));
  points.push({
    id: 'photo',
    label: 'Photo',
    hint: 'My links',
    route: '/contact',
    position: new THREE.Vector3(1.8, 0, -3.4),
    markerY: 1.8,
    radius: 1.5,
  });

  // ── East side: bed + side table + lamp + bookshelf ──
  const bed = makeBed();
  bed.position.set(5.0, 0, -2.4);
  scene.add(bed);
  colliders.push({ x: 5.0, z: -2.4, r: 1.3 });

  // side table
  const stX = 5.0;
  const stZ = -0.6;
  const sideTable = new THREE.Group();
  const stTop = new THREE.Mesh(rbox(0.5, 0.06, 0.5, 0.03), std(PAL.woodLight, 0.9));
  stTop.position.y = 0.5;
  const stLegGeo = rbox(0.06, 0.5, 0.06, 0.02);
  const stPts: Array<[number, number]> = [
    [-0.2, -0.2],
    [0.2, -0.2],
    [-0.2, 0.2],
    [0.2, 0.2],
  ];
  for (const [lx, lz] of stPts) {
    const sl = new THREE.Mesh(stLegGeo, std(PAL.woodDark, 0.9));
    sl.position.set(lx, 0.25, lz);
    sideTable.add(sl);
  }
  sideTable.add(stTop);
  sideTable.position.set(stX, 0, stZ);
  scene.add(sideTable);
  colliders.push({ x: stX, z: stZ, r: 0.3 });

  // lamp on the table
  const lamp = new THREE.Group();
  const lpole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.3, 10), std(PAL.woodDark, 0.9));
  lpole.position.y = 0.65;
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.2, 0.24, 14),
    new THREE.MeshStandardMaterial({
      color: 0xfff2c9,
      emissive: 0xffe9a8,
      emissiveIntensity: 1.2,
      roughness: 0.5,
      transparent: true,
      opacity: 0.95,
    }),
  );
  shade.position.y = 0.9;
  lamp.add(lpole, shade);
  lamp.position.set(stX, 0, stZ);
  scene.add(lamp);
  const lampLight = new THREE.PointLight(0xffe9a8, 5, 8, 1.6);
  lampLight.position.set(stX, 1.0, stZ);
  scene.add(lampLight);

  // bookshelf against the east wall
  const shelfX = 5.1;
  const shelfZ = 1.8;
  const shelf = makeBookshelf();
  shelf.position.set(shelfX, 0, shelfZ);
  scene.add(shelf);
  colliders.push({ x: shelfX, z: shelfZ, r: 0.6 });

  // ── Centre rug ──
  const rug = new THREE.Mesh(
    new THREE.CircleGeometry(1.8, 40),
    new THREE.MeshStandardMaterial({ map: makeRugTexture(PAL.red, PAL.cream), roughness: 0.95 }),
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.025, 0.6);
  scene.add(rug);

  // ── Windows: north (left of photo) + west (above desk) ──
  const winN = makeWindow(1.1, 1.1);
  winN.position.set(-2.1, 2.0, minZ + 0.12);
  scene.add(winN);
  const winW = makeWindow(1.1, 1.1);
  winW.position.set(minX + 0.13, 2.1, deskZ);
  winW.rotation.y = Math.PI / 2;
  scene.add(winW);

  // ── Lighting ──
  scene.add(new THREE.HemisphereLight(0xfff8e8, 0xb0a070, 1.0));

  // ── Exit + spawn + bounds ──
  points.push({
    id: 'exit',
    label: 'Door',
    hint: 'Back to the island',
    exit: true,
    position: new THREE.Vector3(0, 0, 3.6),
    markerY: 2.2,
    radius: 1.5,
  });

  return {
    scene,
    spawn: new THREE.Vector3(0, 0, 2.8),
    walkSurface,
    colliders,
    points,
    bounds: { minX: minX + 0.5, maxX: maxX - 0.5, minZ: minZ + 0.5, maxZ: maxZ - 0.5 },
  };
}
