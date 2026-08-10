import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** Multiply an sRGB hex color by a factor (for roof light/shade variants). */
function shadeOf(hex: number, f: number): number {
  const r = Math.min(255, Math.round(((hex >> 16) & 0xff) * f));
  const g = Math.min(255, Math.round(((hex >> 8) & 0xff) * f));
  const b = Math.min(255, Math.round((hex & 0xff) * f));
  return (r << 16) | (g << 8) | b;
}

export interface BuildingTheme {
  roof: number;
  door: number;
  museumRoof: number;
  museumWall: number;
  /** Explicit triplet overrides (bypass shadeOf derivation) so a legacy
   *  palette can be reproduced exactly. */
  doorDark?: number;
  doorHi?: number;
  museumRoofLight?: number;
  museumRoofDeep?: number;
}

/** House roof palette — themed per island via setBuildingTheme. */
let ROOF = { base: 0xe2574c, light: 0, deep: 0, shade: 0 };
let DOOR = { dark: 0x5a3f22, mid: 0x7a5326, hi: 0x9c6f3a };
let MUSEUM = { roof: 0x4f86c6, roofLight: 0x6fa0d8, roofDeep: 0x2f527f, wall: 0xffeed0 };

export function setBuildingTheme(t: BuildingTheme): void {
  ROOF = { base: t.roof, light: shadeOf(t.roof, 1.12), deep: shadeOf(t.roof, 0.62), shade: shadeOf(t.roof, 0.74) };
  DOOR = { dark: t.doorDark ?? shadeOf(t.door, 0.85), mid: t.door, hi: t.doorHi ?? shadeOf(t.door, 1.28) };
  MUSEUM = {
    roof: t.museumRoof,
    roofLight: t.museumRoofLight ?? shadeOf(t.museumRoof, 1.32),
    roofDeep: t.museumRoofDeep ?? shadeOf(t.museumRoof, 0.64),
    wall: t.museumWall,
  };
}

// Home defaults = the legacy hardcoded palette (exact, not derived).
setBuildingTheme({
  roof: 0xe2574c,
  door: 0x7a5326,
  doorDark: 0x5a3f22,
  doorHi: 0x9c6f3a,
  museumRoof: 0x4f86c6,
  museumRoofLight: 0x6fa0d8,
  museumRoofDeep: 0x2f527f,
  museumWall: 0xffeed0,
});

// ============================================================================
// Palette & shared materials
// ============================================================================

const COL = {
  cream: 0xfff2d0,
  creamWall: 0xffeed0,
  red: 0xe2574c,
  redShade: 0xa8463e,
  redDeep: 0x8e3a36,
  blue: 0x4f86c6,
  blueShade: 0x3a6699,
  blueDeep: 0x2f527f,
  white: 0xf7f4ec,
  pureWhite: 0xffffff,
  woodDark: 0x8a5a33,
  woodLight: 0xb07a45,
  woodPost: 0x74542f,
  bark: 0x5e4126,
  gold: 0xffd94d,
  glass: 0xbfe6f5,
  navy: 0x2b3550,
  navyLight: 0x3a4a5a,
  cork: 0xd9b38c,
  paper: 0xfffdf2,
  stone: 0xd8cdb5,
  stoneDark: 0xbfb39a,
  pink: 0xff7fa8,
  yellow: 0xffd94d,
  leaf: 0x6fbf5b,
  beak: 0xe89a3c,
  pupil: 0x20140a,
  brown: 0x8a5a33,
  brownLight: 0xa9744c,
};

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

function std(color: number, roughness = 0.9): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
}

function shadowed<T extends THREE.Mesh>(m: T, cast = true, receive = false): T {
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

/** Rounded box helper (single material — RoundedBoxGeometry has no face groups). */
function rbox(w: number, h: number, d: number, r: number): RoundedBoxGeometry {
  return new RoundedBoxGeometry(w, h, d, 3, r);
}

// Shared plain materials (reused across buildings to keep draw-setup cheap).
const M = {
  creamWall: std(COL.creamWall, 0.92),
  cream: std(COL.cream, 0.9),
  white: std(COL.white, 0.9),
  pureWhite: std(COL.pureWhite, 0.85),
  redShade: std(COL.redShade, 0.85),
  blueShade: std(COL.blueShade, 0.85),
  woodDark: std(COL.woodDark, 0.92),
  woodLight: std(COL.woodLight, 0.9),
  woodPost: std(COL.woodPost, 0.95),
  bark: std(COL.bark, 0.95),
  navy: std(COL.navy, 0.7),
  navyLight: std(COL.navyLight, 0.7),
  stone: std(COL.stone, 0.95),
  stoneDark: std(COL.stoneDark, 0.95),
  doorDark: std(0x5a3f22, 0.85),
  brown: std(COL.brown, 0.9),
  brownLight: std(COL.brownLight, 0.9),
  leaf: std(COL.leaf, 0.8),
};

/** House roof shade material — per-island (setBuildingTheme), built at use. */
const roofShadeMat = () => std(ROOF.shade, 0.85);

function glassMat(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: COL.glass,
    roughness: 0.18,
    metalness: 0.1,
    transparent: true,
    opacity: 0.82,
  });
}

function goldMat(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: COL.gold, roughness: 0.35, metalness: 0.6 });
}

// ============================================================================
// Canvas textures
// ============================================================================

function cv(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function makeTex(c: HTMLCanvasElement, rx = 1, ry = 1, tile = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (tile) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
  }
  return t;
}

/** Scalloped shingle / Spanish-tile roof texture, seamless tile. */
function shingleCanvas(base: number, light: number, shade: number): HTMLCanvasElement {
  const S = 256;
  const c = cv(S, S);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = hex(base);
  ctx.fillRect(0, 0, S, S);
  const r = 18;
  const sp = 32;
  const rowH = 16;
  const rows = Math.ceil(S / rowH) + 1;
  for (let row = 0; row < rows; row++) {
    const yTop = row * rowH;
    const off = row % 2 === 0 ? 0 : sp / 2;
    for (let cx = -sp; cx <= S + sp; cx += sp) {
      const x = cx + off;
      const variant = (row * 3 + Math.round(x / sp)) % 3;
      ctx.fillStyle = variant === 0 ? hex(light) : variant === 1 ? hex(base) : hex(shade);
      ctx.beginPath();
      ctx.arc(x, yTop, r, 0, Math.PI);
      ctx.fill();
      // lower shadow
      ctx.strokeStyle = hex(shade);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, yTop, r, 0.12 * Math.PI, 0.88 * Math.PI);
      ctx.stroke();
      // top highlight
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x, yTop, r - 2, 1.12 * Math.PI, 1.88 * Math.PI);
      ctx.stroke();
    }
  }
  return c;
}

/** Subtle window-glass reflection: blue gradient + soft diagonal streak. */
function glassCanvas(): HTMLCanvasElement {
  const S = 64;
  const c = cv(S, S);
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, '#dff3ff');
  g.addColorStop(0.5, '#bfe6f5');
  g.addColorStop(1, '#8fcde8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(8, 52);
  ctx.lineTo(46, 10);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(4, 40);
  ctx.lineTo(34, 8);
  ctx.stroke();
  return c;
}

/** Paneled wooden door, optionally double, with a round porthole window. */
function doorCanvas(double: boolean): HTMLCanvasElement {
  const W = double ? 256 : 160;
  const H = 300;
  const c = cv(W, H);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = hex(DOOR.dark);
  ctx.fillRect(0, 0, W, H);
  const cols = double ? 2 : 1;
  const cw = W / cols;
  const pad = 12;
  for (let i = 0; i < cols; i++) {
    const ox = i * cw;
    // upper panel zone (with porthole)
    const up = { x: ox + pad, y: 18, w: cw - pad * 2, h: 96 };
    // lower stacked panels
    const lp1 = { x: ox + pad, y: 132, w: cw - pad * 2, h: 66 };
    const lp2 = { x: ox + pad, y: 210, w: cw - pad * 2, h: 66 };
    for (const p of [lp1, lp2]) {
      ctx.fillStyle = hex(DOOR.mid);
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = hex(DOOR.hi);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + p.h);
      ctx.lineTo(p.x, p.y);
      ctx.lineTo(p.x + p.w, p.y);
      ctx.stroke();
      ctx.strokeStyle = hex(DOOR.dark);
      ctx.beginPath();
      ctx.moveTo(p.x + p.w, p.y);
      ctx.lineTo(p.x + p.w, p.y + p.h);
      ctx.lineTo(p.x, p.y + p.h);
      ctx.stroke();
    }
    // porthole window on upper panel
    const cxp = ox + cw / 2;
    const cyp = up.y + up.h / 2;
    const rr = 30;
    ctx.fillStyle = hex(DOOR.mid);
    ctx.fillRect(up.x, up.y, up.w, up.h);
    ctx.strokeStyle = hex(DOOR.hi);
    ctx.lineWidth = 3;
    ctx.strokeRect(up.x, up.y, up.w, up.h);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cxp, cyp, rr + 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#bfe6f5';
    ctx.beginPath();
    ctx.arc(cxp, cyp, rr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cxp, cyp - rr);
    ctx.lineTo(cxp, cyp + rr);
    ctx.moveTo(cxp - rr, cyp);
    ctx.lineTo(cxp + rr, cyp);
    ctx.stroke();
  }
  // center seam for double door
  if (double) {
    ctx.strokeStyle = hex(DOOR.dark);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(W / 2, 10);
    ctx.lineTo(W / 2, H - 10);
    ctx.stroke();
  }
  return c;
}

/** Cork-board texture: tan with speckled grain. */
function corkCanvas(): HTMLCanvasElement {
  const S = 128;
  const c = cv(S, S);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = hex(COL.cork);
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const sh = Math.random();
    ctx.fillStyle = sh > 0.5 ? 'rgba(120,80,40,0.25)' : 'rgba(255,240,210,0.25)';
    ctx.fillRect(x, y, 2, 2);
  }
  return c;
}

/** Pinned paper: ruled lines + optional chalk doodle. */
function paperCanvas(doodle: 'mail' | 'star' | 'lines' | null): HTMLCanvasElement {
  const W = 96;
  const H = 120;
  const c = cv(W, H);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = hex(COL.paper);
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(120,170,220,0.5)';
  ctx.lineWidth = 1;
  for (let y = 16; y < H; y += 12) {
    ctx.beginPath();
    ctx.moveTo(6, y);
    ctx.lineTo(W - 6, y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(60,40,20,0.75)';
  ctx.fillStyle = 'rgba(60,40,20,0.75)';
  ctx.lineWidth = 2;
  if (doodle === 'mail') {
    const x0 = 24;
    const y0 = 60;
    const w = 48;
    const h = 32;
    ctx.strokeRect(x0, y0, w, h);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + w / 2, y0 + h * 0.7);
    ctx.lineTo(x0 + w, y0);
    ctx.stroke();
  } else if (doodle === 'star') {
    const cxp = W / 2;
    const cyp = 70;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rad = i % 2 === 0 ? 16 : 7;
      const px = cxp + Math.cos(a) * rad;
      const py = cyp + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(12, 40 + i * 16);
      ctx.lineTo(W - 12 - i * 6, 40 + i * 16);
      ctx.stroke();
    }
  }
  return c;
}

/** Painted sign board: wooden border, cream face, label + directional chevron. */
function signCanvas(text: string): HTMLCanvasElement {
  const W = 360;
  const H = 150;
  const c = cv(W, H);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = hex(COL.woodLight);
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 22);
  ctx.fill();
  ctx.fillStyle = hex(COL.paper);
  ctx.beginPath();
  ctx.roundRect(12, 12, W - 24, H - 24, 16);
  ctx.fill();
  ctx.fillStyle = hex(DOOR.dark);
  ctx.font = '800 58px "Baloo 2", "Arial Rounded MT Bold", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, 58);
  // downward chevron pointing the way
  ctx.strokeStyle = hex(COL.red);
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(W / 2 - 18, 104);
  ctx.lineTo(W / 2, 124);
  ctx.lineTo(W / 2 + 18, 104);
  ctx.stroke();
  return c;
}

/** Engraved stone inscription plaque texture. */
function inscriptionCanvas(text: string): HTMLCanvasElement {
  const W = 512;
  const H = 128;
  const c = cv(W, H);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = hex(COL.stoneDark);
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = hex(COL.stone);
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, W - 20, H - 20);
  ctx.fillStyle = hex(COL.creamWall);
  ctx.font = '800 72px "Baloo 2", "Georgia", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, H / 2 + 4);
  return c;
}

// ============================================================================
// HOUSE  ("About" building)
// ============================================================================

export function makeHouse(): THREE.Group {
  const g = new THREE.Group();
  const W = 4;
  const D = 3.1;
  const WH = 2.5; // wall height
  const baseY = 0.35; // top of foundation
  const wallTop = baseY + WH;

  // --- Foundation skirt (stone) ---
  const found = shadowed(new THREE.Mesh(rbox(W + 0.34, 0.42, D + 0.34, 0.1), M.stone), true, true);
  found.position.y = 0.17;

  // --- Walls (cream, rounded) ---
  const walls = shadowed(new THREE.Mesh(rbox(W, WH, D, 0.14), M.creamWall), true, true);
  walls.position.y = baseY + WH / 2;

  // --- Gable roof (shingled) ---
  const overX = 0.28;
  const overZ = 0.38;
  const halfSpan = W / 2 + overX; // roof eave half-width
  const peakH = 1.18;
  const slopeLen = Math.hypot(halfSpan, peakH);
  const pitch = Math.atan2(peakH, halfSpan);

  // Gable-end triangle fills (cream wall colour) on +Z / -Z faces.
  const gableHalf = W / 2 + 0.04;
  const triShape = new THREE.Shape();
  triShape.moveTo(-gableHalf, 0);
  triShape.lineTo(gableHalf, 0);
  triShape.lineTo(0, peakH);
  triShape.closePath();
  const triGeo = new THREE.ExtrudeGeometry(triShape, { depth: 0.14, bevelEnabled: false });
  const gableFront = shadowed(new THREE.Mesh(triGeo, M.creamWall), true, true);
  gableFront.position.set(0, wallTop, D / 2 - 0.02);
  const gableBack = shadowed(new THREE.Mesh(triGeo.clone(), M.creamWall), true, true);
  gableBack.position.set(0, wallTop, -D / 2 - 0.12);
  gableBack.rotation.y = Math.PI;

  // Two sloped roof panels with scalloped shingles (per-island theme).
  const roofTex = makeTex(shingleCanvas(ROOF.base, ROOF.light, ROOF.deep), 6, 4, true);
  const roofMat = new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.85, metalness: 0 });
  const panelGeo = new THREE.BoxGeometry(slopeLen, 0.14, D + overZ * 2);
  const roofPx = shadowed(new THREE.Mesh(panelGeo, roofMat), true, true);
  roofPx.position.set(halfSpan / 2, wallTop + peakH / 2, 0);
  roofPx.rotation.z = -pitch;
  const roofNx = shadowed(new THREE.Mesh(panelGeo, roofMat), true, true);
  roofNx.position.set(-halfSpan / 2, wallTop + peakH / 2, 0);
  roofNx.rotation.z = pitch;

  // Ridge cap (rounded box along the apex)
  const ridge = shadowed(
    new THREE.Mesh(rbox(0.22, 0.16, D + overZ * 2 + 0.12, 0.06), roofShadeMat()),
    true,
    false,
  );
  ridge.position.set(0, wallTop + peakH + 0.02, 0);

  // --- Front door (panelled, porthole, knob, step) ---
  const doorTex = makeTex(doorCanvas(false));
  const doorFront = new THREE.MeshStandardMaterial({ map: doorTex, roughness: 0.82, metalness: 0 });
  const doorSide = M.doorDark;
  const doorH = 1.5;
  const door = shadowed(
    new THREE.Mesh(new THREE.BoxGeometry(0.96, doorH, 0.12), [
      doorSide,
      doorSide,
      doorSide,
      doorSide,
      doorFront,
      doorSide,
    ]),
    true,
    false,
  );
  door.position.set(0, baseY + doorH / 2, D / 2 - 0.05);
  // trim frame
  const trim = shadowed(new THREE.Mesh(rbox(1.2, 1.74, 0.1, 0.06), M.pureWhite), true, false);
  trim.position.set(0, baseY + doorH / 2 + 0.02, D / 2 - 0.1);
  // porthole ring
  const ring = shadowed(
    new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 18), goldMat()),
    true,
    false,
  );
  ring.position.set(0, baseY + doorH - 0.42, D / 2 + 0.02);
  // knob
  const knob = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), goldMat()), true, false);
  knob.position.set(0.32, baseY + doorH * 0.5, D / 2 + 0.04);
  // door step
  const step = shadowed(new THREE.Mesh(rbox(1.34, 0.16, 0.34, 0.05), M.stoneDark), true, true);
  step.position.set(0, 0.08, D / 2 + 0.2);

  // --- Flanking windows (rounded white frame + cross muntins + blue glass) ---
  const glassT = makeTex(glassCanvas(), 1, 1, true);
  const glassMatTx = new THREE.MeshStandardMaterial({
    map: glassT,
    color: COL.glass,
    roughness: 0.2,
    metalness: 0.1,
    transparent: true,
    opacity: 0.85,
  });
  const winY = baseY + 1.32;
  const makeWindow = (x: number): THREE.Group => {
    const wg = new THREE.Group();
    const frame = shadowed(new THREE.Mesh(rbox(0.92, 0.92, 0.12, 0.1), M.pureWhite), true, false);
    const gl = shadowed(
      new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.66, 0.06), glassMatTx),
      false,
      false,
    );
    gl.position.z = 0.04;
    const mV = shadowed(
      new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.66, 0.05), M.pureWhite),
      true,
      false,
    );
    mV.position.z = 0.08;
    const mH = shadowed(
      new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.05, 0.05), M.pureWhite),
      true,
      false,
    );
    mH.position.z = 0.08;
    const sill = shadowed(new THREE.Mesh(rbox(1.02, 0.1, 0.18, 0.03), M.pureWhite), true, true);
    sill.position.set(0, -0.52, 0.08);
    wg.add(frame, gl, mV, mH, sill);
    wg.position.set(x, winY, D / 2 - 0.04);
    return wg;
  };
  const winL = makeWindow(-1.34);
  const winR = makeWindow(1.34);

  // --- Flower box under right window ---
  const fb = new THREE.Group();
  const box = shadowed(new THREE.Mesh(rbox(0.7, 0.2, 0.26, 0.04), M.woodLight), true, true);
  const flowerCols = [COL.pink, COL.yellow, 0xff7fa8];
  flowerCols.forEach((fc, i) => {
    const f = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), std(fc, 0.8)), true, false);
    f.position.set(-0.22 + i * 0.22, 0.14, 0);
    const leaf = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), M.leaf), false, false);
    leaf.position.set(-0.22 + i * 0.22, 0.06, 0.04);
    fb.add(f, leaf);
  });
  fb.add(box);
  fb.position.set(1.34, winY - 0.62, D / 2 + 0.04);

  // --- Chimney with cap ---
  const chimY = wallTop + 0.5;
  const chimney = shadowed(new THREE.Mesh(rbox(0.5, 1.0, 0.5, 0.06), roofShadeMat()), true, true);
  chimney.position.set(-1.1, chimY, -0.55);
  const chimCap = shadowed(new THREE.Mesh(rbox(0.6, 0.14, 0.6, 0.04), M.cream), true, true);
  chimCap.position.set(-1.1, chimY + 0.57, -0.55);

  // --- Tiny picket fence segment (front-right corner) ---
  const fence = new THREE.Group();
  const picketGeo = rbox(0.08, 0.5, 0.06, 0.03);
  for (const pz of [0.4, 0.95, 1.5]) {
    const p = shadowed(new THREE.Mesh(picketGeo, M.pureWhite), true, false);
    p.position.set(2.05, 0.32, pz);
    fence.add(p);
  }
  const rail = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 1.2), M.pureWhite), true, false);
  rail.position.set(2.05, 0.42, 0.95);
  fence.add(rail);

  // --- Door wreath (green torus ring + 3 red berries) ---
  const wreathRing = shadowed(
    new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.028, 6, 16), M.leaf),
    true,
    false,
  );
  wreathRing.position.set(0, baseY + doorH - 0.17, D / 2 + 0.03);
  const berryGeo = new THREE.SphereGeometry(0.026, 8, 6);
  const berryMat = std(COL.red, 0.6);
  const wreathBerries: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i - 1) * 0.55;
    const b = shadowed(new THREE.Mesh(berryGeo, berryMat), true, false);
    b.position.set(Math.cos(a) * 0.12, baseY + doorH - 0.17 + Math.sin(a) * 0.12, D / 2 + 0.05);
    wreathBerries.push(b);
  }

  // --- Window shutters (white, two boards each) ---
  const shutterBoardGeo = rbox(0.14, 0.36, 0.08, 0.03);
  const makeShutter = (x: number): THREE.Group => {
    const sg = new THREE.Group();
    const top = shadowed(new THREE.Mesh(shutterBoardGeo, M.pureWhite), true, false);
    top.position.y = 0.22;
    const bot = shadowed(new THREE.Mesh(shutterBoardGeo, M.pureWhite), true, false);
    bot.position.y = -0.22;
    sg.add(top, bot);
    sg.position.set(x, winY, D / 2 - 0.04);
    return sg;
  };
  const shutters: THREE.Group[] = [
    makeShutter(-1.34 - 0.53),
    makeShutter(-1.34 + 0.53),
    makeShutter(1.34 - 0.53),
    makeShutter(1.34 + 0.53),
  ];

  // --- Welcome mat at doorstep ---
  const mat = shadowed(new THREE.Mesh(rbox(0.9, 0.04, 0.45, 0.02), roofShadeMat()), true, true);
  mat.position.set(0, 0.02, D / 2 + 0.6);

  g.add(
    found,
    walls,
    gableFront,
    gableBack,
    roofPx,
    roofNx,
    ridge,
    trim,
    door,
    ring,
    knob,
    step,
    winL,
    winR,
    fb,
    chimney,
    chimCap,
    fence,
    wreathRing,
    ...wreathBerries,
    ...shutters,
    mat,
  );
  return g;
}

// ============================================================================
// MUSEUM  ("Projects" building)
// ============================================================================

export function makeOwl(): THREE.Group {
  const owl = new THREE.Group();
  const body = shadowed(
    new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 14), M.brown),
    true,
    false,
  );
  body.scale.y = 1.12;
  body.position.y = 0.26;
  const wingGeo = new THREE.SphereGeometry(0.17, 12, 10);
  const wL = shadowed(new THREE.Mesh(wingGeo, M.brownLight), true, false);
  wL.scale.set(0.45, 0.95, 0.7);
  wL.position.set(-0.24, 0.26, 0.02);
  const wR = shadowed(new THREE.Mesh(wingGeo, M.brownLight), true, false);
  wR.scale.set(0.45, 0.95, 0.7);
  wR.position.set(0.24, 0.26, 0.02);
  // head
  const head = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.23, 16, 14), M.brown), true, false);
  head.position.y = 0.6;
  // face disc
  const face = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 14), M.cream), false, false);
  face.scale.set(1, 1, 0.5);
  face.position.set(0, 0.62, 0.13);
  // eyes (white + pupil)
  const eyeWhite = new THREE.SphereGeometry(0.092, 14, 12);
  const pupil = new THREE.SphereGeometry(0.05, 12, 10);
  const eL = shadowed(new THREE.Mesh(eyeWhite, M.pureWhite), true, false);
  eL.position.set(-0.1, 0.66, 0.2);
  const eR = shadowed(new THREE.Mesh(eyeWhite, M.pureWhite), true, false);
  eR.position.set(0.1, 0.66, 0.2);
  const pL = shadowed(
    new THREE.Mesh(pupil, new THREE.MeshStandardMaterial({ color: COL.pupil, roughness: 0.5 })),
    true,
    false,
  );
  pL.position.set(-0.1, 0.66, 0.27);
  const pR = shadowed(
    new THREE.Mesh(pupil, new THREE.MeshStandardMaterial({ color: COL.pupil, roughness: 0.5 })),
    true,
    false,
  );
  pR.position.set(0.1, 0.66, 0.27);
  // beak
  const beak = shadowed(
    new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 6), std(COL.beak, 0.6)),
    true,
    false,
  );
  beak.rotation.x = Math.PI;
  beak.position.set(0, 0.5, 0.24);
  // ear tufts
  const tuftGeo = new THREE.ConeGeometry(0.05, 0.16, 6);
  const tL = shadowed(new THREE.Mesh(tuftGeo, M.brown), true, false);
  tL.position.set(-0.17, 0.82, 0);
  tL.rotation.z = 0.4;
  const tR = shadowed(new THREE.Mesh(tuftGeo, M.brown), true, false);
  tR.position.set(0.17, 0.82, 0);
  tR.rotation.z = -0.4;

  owl.add(body, wL, wR, head, face, eL, eR, pL, pR, beak, tL, tR);
  return owl;
}

export function makeMuseum(): THREE.Group {
  const g = new THREE.Group();
  const W = 5.6;
  const D = 3.4;
  const WH = 2.9;
  const baseY = 0.35;
  const wallTop = baseY + WH;

  // foundation
  const found = shadowed(new THREE.Mesh(rbox(W + 0.34, 0.42, D + 0.34, 0.1), M.stone), true, true);
  found.position.y = 0.17;
  // walls (per-island museum wall tint; the house keeps M.creamWall)
  const walls = shadowed(new THREE.Mesh(rbox(W, WH, D, 0.14), std(MUSEUM.wall, 0.92)), true, true);
  walls.position.y = baseY + WH / 2;

  // cornice / entablature band under the roof
  const cornice = shadowed(new THREE.Mesh(rbox(W + 0.4, 0.3, D + 0.4, 0.06), M.white), true, true);
  cornice.position.y = wallTop + 0.13;

  // --- Hip roof (per-island shingles) ---
  const over = 0.4;
  const baseSide = W + over * 2; // 6.4
  const rBottom = baseSide / Math.SQRT2; // square half-diagonal to vertex
  const roofH = 1.25;
  const rTop = rBottom * 0.1;
  const roofGeo = new THREE.CylinderGeometry(rTop, rBottom, roofH, 4, 1);
  const roofTex = makeTex(shingleCanvas(MUSEUM.roof, MUSEUM.roofLight, MUSEUM.roofDeep), 6, 5, true);
  const roofMat = new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.85, metalness: 0 });
  const roof = shadowed(new THREE.Mesh(roofGeo, roofMat), true, true);
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = (D + over * 2) / baseSide;
  roof.position.y = wallTop + 0.28 + roofH / 2;
  // flat cap on top
  const capW = 0.9;
  const cap = shadowed(
    new THREE.Mesh(rbox(capW, 0.16, capW * ((D + over * 2) / baseSide) + 0.1, 0.04), M.blueShade),
    true,
    true,
  );
  cap.position.y = wallTop + 0.28 + roofH + 0.04;

  // --- Steps ---
  const step1 = shadowed(new THREE.Mesh(rbox(3.4, 0.2, 0.9, 0.05), M.stoneDark), true, true);
  step1.position.set(0, 0.1, D / 2 + 0.55);
  const step2 = shadowed(new THREE.Mesh(rbox(2.8, 0.2, 0.7, 0.05), M.stone), true, true);
  step2.position.set(0, 0.3, D / 2 + 0.35);

  // --- Four columns (base + shaft + cap) ---
  const colShaftGeo = new THREE.CylinderGeometry(0.17, 0.19, WH - 0.1, 14);
  const colBaseGeo = rbox(0.54, 0.2, 0.54, 0.04);
  const colCapGeo = rbox(0.56, 0.2, 0.56, 0.04);
  for (const cx of [-2.15, -0.75, 0.75, 2.15]) {
    const cb = shadowed(new THREE.Mesh(colBaseGeo, M.pureWhite), true, true);
    cb.position.set(cx, baseY + 0.08, D / 2 + 0.45);
    const cs = shadowed(new THREE.Mesh(colShaftGeo, M.pureWhite), true, false);
    cs.position.set(cx, baseY + 0.1 + (WH - 0.1) / 2, D / 2 + 0.45);
    const cc = shadowed(new THREE.Mesh(colCapGeo, M.pureWhite), true, false);
    cc.position.set(cx, baseY + 0.1 + (WH - 0.1) + 0.04, D / 2 + 0.45);
    g.add(cb, cs, cc);
  }

  // --- Grand double door ---
  const doorTex = makeTex(doorCanvas(true));
  const doorFront = new THREE.MeshStandardMaterial({ map: doorTex, roughness: 0.82, metalness: 0 });
  const doorSide = new THREE.MeshStandardMaterial({ color: 0x3a4a5a, roughness: 0.85, metalness: 0 });
  const doorH = 2.0;
  const door = shadowed(
    new THREE.Mesh(new THREE.BoxGeometry(1.5, doorH, 0.14), [
      doorSide,
      doorSide,
      doorSide,
      doorSide,
      doorFront,
      doorSide,
    ]),
    true,
    false,
  );
  door.position.set(0, baseY + doorH / 2, D / 2 - 0.06);
  const doorFrame = shadowed(new THREE.Mesh(rbox(1.78, 2.28, 0.12, 0.06), M.pureWhite), true, false);
  doorFrame.position.set(0, baseY + doorH / 2 + 0.04, D / 2 - 0.12);
  // two golden handles
  const handleGeo = new THREE.SphereGeometry(0.06, 12, 10);
  const hL = shadowed(new THREE.Mesh(handleGeo, goldMat()), true, false);
  hL.position.set(-0.28, baseY + doorH * 0.5, D / 2 + 0.03);
  const hR = shadowed(new THREE.Mesh(handleGeo, goldMat()), true, false);
  hR.position.set(0.28, baseY + doorH * 0.5, D / 2 + 0.03);

  // --- Owl emblem on bracket above entrance ---
  const bracket = shadowed(new THREE.Mesh(rbox(0.6, 0.16, 0.32, 0.04), M.cream), true, true);
  bracket.position.set(0, baseY + doorH + 0.12, D / 2 + 0.12);
  const owl = makeOwl();
  owl.position.set(0, baseY + doorH + 0.2, D / 2 + 0.24);
  owl.scale.setScalar(1.05);

  // --- Second-story round windows on side walls ---
  const sideWin = (x: number, rot: number): THREE.Group => {
    const swg = new THREE.Group();
    const ringG = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.06, 8, 20), M.pureWhite), true, false);
    const gl = shadowed(
      new THREE.Mesh(new THREE.CircleGeometry(0.24, 20), glassMat()),
      false,
      false,
    );
    gl.position.z = 0.01;
    const mV = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.46, 0.04), M.pureWhite), true, false);
    mV.position.z = 0.04;
    const mH = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.04, 0.04), M.pureWhite), true, false);
    mH.position.z = 0.04;
    swg.add(ringG, gl, mV, mH);
    swg.position.set(x, baseY + WH - 0.7, 0);
    swg.rotation.y = rot;
    return swg;
  };
  const swL = sideWin(-W / 2 - 0.02, -Math.PI / 2);
  const swR = sideWin(W / 2 + 0.02, Math.PI / 2);

  // --- Roof flag pole + pennant ---
  const pole = shadowed(
    new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8), std(0xdddddd, 0.5)),
    true,
    false,
  );
  pole.position.set(0, wallTop + 0.28 + roofH + 0.34, 0);
  const flagShape = new THREE.Shape();
  flagShape.moveTo(0, 0);
  flagShape.lineTo(0.34, 0.1);
  flagShape.lineTo(0, 0.2);
  flagShape.closePath();
  const flag = shadowed(
    new THREE.Mesh(
      new THREE.ExtrudeGeometry(flagShape, { depth: 0.02, bevelEnabled: false }),
      std(COL.red, 0.8),
    ),
    true,
    false,
  );
  flag.position.set(0.03, wallTop + 0.28 + roofH + 0.42, 0.01);

  // --- Hip-roof ridge caps along the 4 edges ---
  const hipY0 = wallTop + 0.28;
  const hipLen = Math.sqrt(3.2 * 3.2 + roofH * roofH + 2.1 * 2.1);
  const hipCapGeo = rbox(0.14, hipLen * 0.94, 0.12, 0.04);
  const upVec = new THREE.Vector3(0, 1, 0);
  const hipCorners: Array<[number, number]> = [
    [3.2, 2.1],
    [3.2, -2.1],
    [-3.2, -2.1],
    [-3.2, 2.1],
  ];
  const hipCaps: THREE.Mesh[] = [];
  for (const [hx, hz] of hipCorners) {
    const dir = new THREE.Vector3(-hx, roofH, -hz).normalize();
    const hc = shadowed(new THREE.Mesh(hipCapGeo, M.blueShade), true, false);
    hc.position.set(hx / 2, hipY0 + roofH / 2, hz / 2);
    hc.quaternion.setFromUnitVectors(upVec, dir);
    hipCaps.push(hc);
  }

  // --- Entablature inscription plaque ---
  const insTex = makeTex(inscriptionCanvas('MUSEUM'));
  const insFront = new THREE.MeshStandardMaterial({ map: insTex, roughness: 0.9, metalness: 0 });
  const insSide = M.stoneDark;
  const inscription = shadowed(
    new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.2, 0.06), [
      insSide,
      insSide,
      insSide,
      insSide,
      insFront,
      insSide,
    ]),
    true,
    false,
  );
  inscription.position.set(0, wallTop + 0.13, (D + 0.4) / 2 + 0.01);

  // --- Flanking bushes in stone planters ---
  const planterPotGeo = rbox(0.5, 0.3, 0.5, 0.06);
  const foliageGeo = new THREE.SphereGeometry(0.22, 12, 10);
  const foliage2Geo = new THREE.SphereGeometry(0.15, 10, 8);
  const makePlanter = (x: number): THREE.Group => {
    const pg = new THREE.Group();
    const pot = shadowed(new THREE.Mesh(planterPotGeo, M.stone), true, true);
    pot.position.y = 0.15;
    const f1 = shadowed(new THREE.Mesh(foliageGeo, M.leaf), true, false);
    f1.position.y = 0.42;
    f1.scale.set(1, 0.85, 1);
    const f2 = shadowed(new THREE.Mesh(foliage2Geo, M.leaf), true, false);
    f2.position.set(0.13, 0.5, 0.06);
    pg.add(pot, f1, f2);
    pg.position.set(x, 0, D / 2 + 0.55);
    return pg;
  };
  const planterL = makePlanter(-1.5);
  const planterR = makePlanter(1.5);

  g.add(
    found,
    walls,
    cornice,
    roof,
    cap,
    step1,
    step2,
    door,
    doorFrame,
    hL,
    hR,
    bracket,
    owl,
    swL,
    swR,
    pole,
    flag,
    ...hipCaps,
    inscription,
    planterL,
    planterR,
  );
  return g;
}

// ============================================================================
// NOTICE BOARD
// ============================================================================

export function makeNoticeBoard(): THREE.Group {
  const g = new THREE.Group();

  // two bark posts
  const postGeo = new THREE.CylinderGeometry(0.09, 0.11, 1.9, 10);
  const pL = shadowed(new THREE.Mesh(postGeo, M.bark), true, true);
  pL.position.set(-0.78, 0.95, 0);
  const pR = shadowed(new THREE.Mesh(postGeo, M.bark), true, true);
  pR.position.set(0.78, 0.95, 0);

  // wooden frame + cork board
  const frame = shadowed(new THREE.Mesh(rbox(2.12, 1.32, 0.16, 0.08), M.woodDark), true, true);
  frame.position.y = 1.42;
  const corkTex = makeTex(corkCanvas(), 1, 1, true);
  const corkFront = new THREE.MeshStandardMaterial({ map: corkTex, roughness: 0.95, metalness: 0 });
  const corkSide = std(COL.cork, 0.95);
  const board = shadowed(
    new THREE.Mesh(new THREE.BoxGeometry(1.84, 1.04, 0.06), [corkSide, corkSide, corkSide, corkSide, corkFront, corkSide]),
    false,
    false,
  );
  board.position.set(0, 1.42, 0.07);

  // tiny hip roof overhang over the board (shingled)
  const roofGeo = new THREE.ConeGeometry(1.55, 0.5, 4);
  const boardRoofTex = makeTex(shingleCanvas(COL.woodDark, 0x9c6c3c, 0x5a3a1f), 3, 2, true);
  const boardRoofMat = new THREE.MeshStandardMaterial({ map: boardRoofTex, roughness: 0.9, metalness: 0 });
  const roof = shadowed(new THREE.Mesh(roofGeo, boardRoofMat), true, true);
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.74;
  roof.position.y = 2.28;

  // pinned notes
  const pinColors = [COL.red, COL.blue, COL.yellow, 0xc58cff, COL.pink, 0x4fcf6f];
  const doodles: Array<'mail' | 'star' | 'lines' | null> = ['mail', 'star', 'lines', null, 'star', 'lines'];
  const notes: Array<[number, number, number]> = [
    [-0.5, 1.5, 0.08],
    [-0.02, 1.32, -0.1],
    [0.5, 1.5, 0.12],
    [0.28, 1.62, -0.07],
    [-0.32, 1.7, 0.05],
    [0.64, 1.3, -0.09],
  ];
  notes.forEach(([nx, ny, rz], i) => {
    const tex = makeTex(paperCanvas(doodles[i]));
    const front = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: 0 });
    const back = std(COL.paper, 0.8);
    const paper = shadowed(
      new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.52, 0.02), [back, back, back, back, front, back]),
      true,
      false,
    );
    paper.position.set(nx, ny, 0.12);
    paper.rotation.z = rz;
    const pin = shadowed(
      new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), std(pinColors[i], 0.5)),
      true,
      false,
    );
    pin.position.set(nx, ny + 0.22, 0.16);
    g.add(paper, pin);
  });

  // --- Back panel frame (so it reads finished from behind) ---
  const backZ = -0.1;
  const bkTop = shadowed(new THREE.Mesh(rbox(2.12, 0.1, 0.05, 0.03), M.woodDark), true, false);
  bkTop.position.set(0, 1.42 + 0.61, backZ);
  const bkBot = shadowed(new THREE.Mesh(rbox(2.12, 0.1, 0.05, 0.03), M.woodDark), true, false);
  bkBot.position.set(0, 1.42 - 0.61, backZ);
  const bkL = shadowed(new THREE.Mesh(rbox(0.1, 1.12, 0.05, 0.03), M.woodDark), true, false);
  bkL.position.set(-1.01, 1.42, backZ);
  const bkR = shadowed(new THREE.Mesh(rbox(0.1, 1.12, 0.05, 0.03), M.woodDark), true, false);
  bkR.position.set(1.01, 1.42, backZ);

  g.add(pL, pR, frame, board, roof, bkTop, bkBot, bkL, bkR);
  return g;
}

// ============================================================================
// SIGNS
// ============================================================================

export function makeSign(text: string): THREE.Group {
  const g = new THREE.Group();
  // bark post
  const post = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 1.6, 10), M.woodPost), true, true);
  post.position.y = 0.8;
  // rounded frame + inner text board
  const frame = shadowed(new THREE.Mesh(rbox(1.66, 0.74, 0.12, 0.08), M.woodDark), true, true);
  frame.position.y = 1.18;
  const signTex = makeTex(signCanvas(text));
  const front = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.8, metalness: 0 });
  const back = M.woodDark;
  const board = shadowed(
    new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.6, 0.04), [back, back, back, back, front, back]),
    true,
    false,
  );
  board.position.set(0, 1.18, 0.07);
  // finial on top of the post
  const finial = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), goldMat()), true, false);
  finial.position.set(0, 1.62, 0);
  // little 3D arrow wedge below the board pointing the way
  const arrow = shadowed(
    new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.22, 4), M.redShade),
    true,
    false,
  );
  arrow.rotation.x = Math.PI;
  arrow.rotation.y = Math.PI / 4;
  arrow.position.set(0, 0.78, 0.06);

  g.add(post, frame, board, finial, arrow);
  return g;
}

// ============================================================================
// LAMPS
// ============================================================================

export function makeLamp(): THREE.Group {
  const g = new THREE.Group();
  // base
  const base = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.14, 14), M.navy), true, true);
  base.position.y = 0.07;
  // pole
  const pole = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.2, 12), M.navy), true, true);
  pole.position.y = 1.21;
  // collar
  const collar = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.1, 12), M.navyLight), true, false);
  collar.position.y = 2.34;

  // lantern glass cage (translucent)
  const cage = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.23, 0.52, 8, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0xcfe6f2,
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
    }),
  );
  cage.position.y = 2.62;

  // four thin cage bars
  const barGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.56, 6);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 8;
    const bar = shadowed(new THREE.Mesh(barGeo, M.navy), true, false);
    bar.position.set(Math.cos(a) * 0.21, 2.62, Math.sin(a) * 0.21);
    g.add(bar);
  }

  // warm glowing bulb
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 16, 14),
    new THREE.MeshStandardMaterial({ color: 0xfff2c9, emissive: 0xffe9a8, emissiveIntensity: 1.6, roughness: 0.4 }),
  );
  bulb.position.y = 2.6;

  // top cap + finial
  const cap = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.22, 8), M.navy), true, false);
  cap.position.y = 2.94;
  const finial = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), goldMat()), true, false);
  finial.position.y = 3.08;

  // point light (warm, no shadow)
  const light = new THREE.PointLight(0xffe9a8, 5.5, 9, 1.6);
  light.position.y = 2.65;

  g.add(base, pole, collar, cage, bulb, cap, finial, light);
  return g;
}
