import * as THREE from 'three';
import { std, shadowed, G_ICO } from './core';
import { makeStripedTexture, makeChevronTexture } from './textures';

// ── Seaplane dock (Dodo Airlines) ──────────────────────────────────────────

/** Wooden pier deck extending from the beach into the sea. */
export function makePier(): THREE.Group {
  const g = new THREE.Group();
  const wood = std(0xa0714f, 0.85);
  const woodDark = std(0x8a5f42, 0.85);
  // Deck planks (alternating tones), running along +z
  for (let i = 0; i < 11; i++) {
    const plank = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.09, 0.5), i % 2 ? wood : woodDark), true, true);
    plank.position.set(0, 0, i * 0.56);
    g.add(plank);
  }
  // Support posts dropping into the water
  for (const [px, pz] of [
    [-0.75, 0.8], [0.75, 0.8],
    [-0.75, 3.1], [0.75, 3.1],
    [-0.75, 5.4], [0.75, 5.4],
  ] as const) {
    const post = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 1.5, 8), woodDark));
    post.position.set(px, -0.7, pz);
    g.add(post);
  }
  // Mooring bollard at the end
  const bollard = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.35, 10), woodDark));
  bollard.position.set(0.6, 0.2, 5.6);
  g.add(bollard);
  return g;
}

/** Cute low-poly seaplane (white + red), floats on the water. */
export function makeSeaplane(): THREE.Group {
  const g = new THREE.Group();
  const white = std(0xf2f4f6, 0.55);
  const red = std(0xe2574c, 0.6);
  const dark = std(0x3a4a5a, 0.5);

  // Fuselage along +z
  const fuselage = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.15, 6, 14), white));
  fuselage.rotation.x = Math.PI / 2;
  g.add(fuselage);
  // Nose + propeller (spins via userData.prop)
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), red);
  nose.position.set(0, 0, 0.72);
  nose.scale.z = 0.7;
  g.add(nose);
  const prop = new THREE.Group();
  const bladeGeo = new THREE.BoxGeometry(0.95, 0.09, 0.03);
  const b1 = new THREE.Mesh(bladeGeo, dark);
  const b2 = new THREE.Mesh(bladeGeo, dark);
  b2.rotation.z = Math.PI / 2;
  prop.add(b1, b2);
  prop.position.set(0, 0, 0.95);
  g.add(prop);
  g.userData.prop = prop;
  // Cockpit windshield
  const shield = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshStandardMaterial({ color: 0x9fd4e8, roughness: 0.15 }));
  shield.position.set(0, 0.26, 0.18);
  shield.scale.set(0.8, 0.55, 1.1);
  g.add(shield);
  // High wing + red tips
  const wing = shadowed(new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.07, 0.5), white));
  wing.position.set(0, 0.42, 0.1);
  g.add(wing);
  for (const wx of [-1.1, 1.1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.075, 0.5), red);
    tip.position.set(wx, 0.42, 0.1);
    g.add(tip);
  }
  // Tail fin + stabilizer
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.42, 0.34), red);
  fin.position.set(0, 0.28, -0.72);
  g.add(fin);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.05, 0.28), white);
  stab.position.set(0, 0.12, -0.7);
  g.add(stab);
  // Twin floats + struts
  for (const fx of [-0.42, 0.42]) {
    const float = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 1.15, 4, 10), white));
    float.rotation.x = Math.PI / 2;
    float.position.set(fx, -0.42, 0.05);
    g.add(float);
    for (const fz of [-0.25, 0.35]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.42, 6), dark);
      strut.position.set(fx, -0.2, fz);
      strut.rotation.z = fx < 0 ? -0.12 : 0.12;
      g.add(strut);
    }
  }
  return g;
}

// ── Cozy corner props (from the official decorating refs) ───────────────────

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
export function makeCampfire(): { g: THREE.Group; flames: THREE.Mesh[] } {
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
export function makeLogBench(): THREE.Group {
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

/** Paper lantern on a wooden post — warm glow, AC-festival style. */
export function makeLantern(post = 0x6b4f2a, glow = 0xffd9a0): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.5, 8), std(post, 0.85));
  pole.position.y = 0.75;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.06), std(post, 0.85));
  arm.position.set(0.2, 1.48, 0);
  const paper = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xfff2d0, emissive: glow, emissiveIntensity: 0.85, roughness: 0.6 }),
  );
  paper.scale.y = 1.15;
  paper.position.set(0.42, 1.3, 0);
  const light = new THREE.PointLight(glow, 3.2, 6, 1.8);
  light.position.copy(paper.position);
  g.add(pole, arm, paper, light);
  g.traverse((o) => { if (o instanceof THREE.Mesh) shadowed(o); });
  return g;
}

/** Tiki torch with a small flame. */
export function makeTikiTorch(): { g: THREE.Group; flame: THREE.Mesh } {
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
export function makeHammock(): THREE.Group {
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
export function makeBirdbath(): THREE.Group {
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
export function makePicketFence(x: number, z0: number, count: number): THREE.Group {
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
export function makeBeachTowel(): THREE.Mesh {
  const towel = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 0.045, 1.75),
    new THREE.MeshStandardMaterial({ map: makeChevronTexture(), roughness: 0.95 }),
  );
  towel.receiveShadow = true;
  return towel;
}

/** Single bamboo stalk with leaf tufts — add to island.sway for gentle rocking. */
export function makeBamboo(rng: () => number): THREE.Group {
  const g = new THREE.Group();
  const h = 3.2 + rng() * 1.6;
  const stalk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.09, h, 7),
    std(rng() > 0.5 ? 0x3e8e5f : 0x4ba06c, 0.7),
  );
  stalk.position.y = h / 2;
  g.add(stalk);
  // node rings
  for (let y = 0.8; y < h - 0.3; y += 0.8) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.018, 6, 10), std(0x2c6e4b, 0.7));
    ring.rotation.x = Math.PI / 2; ring.position.y = y; g.add(ring);
  }
  for (let i = 0; i < 3; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), std(0x5cb87a, 0.8));
    leaf.scale.set(1.6, 0.35, 0.7);
    leaf.position.set((rng() - 0.5) * 0.9, h - 0.2 - i * 0.35, (rng() - 0.5) * 0.9);
    leaf.rotation.y = rng() * Math.PI;
    g.add(leaf);
  }
  g.userData.phase = rng() * Math.PI * 2;
  g.traverse((o) => { if (o instanceof THREE.Mesh) shadowed(o); });
  return g;
}

/** Stone lantern (toro) — soft glow at night. */
export function makeStoneLantern(): THREE.Group {
  const g = new THREE.Group();
  const stone = std(0x9aa0a4, 0.95);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5), stone);
  base.position.y = 0.08;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.6, 8), stone);
  post.position.y = 0.46;
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.34),
    new THREE.MeshStandardMaterial({ color: 0xd8cdb5, emissive: 0xffe9a8, emissiveIntensity: 0.7, roughness: 0.8 }));
  box.position.y = 0.92;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.24, 4), stone);
  cap.position.y = 1.2; cap.rotation.y = Math.PI / 4;
  const light = new THREE.PointLight(0xffe9a8, 2.6, 5, 1.8);
  light.position.y = 0.95;
  g.add(base, post, box, cap, light);
  g.traverse((o) => { if (o instanceof THREE.Mesh) shadowed(o); });
  return g;
}

/** Engraved stone tablet — Latin digits only. */
export function makeStoneTablet(text: string): THREE.Group {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.5, 0.22), std(0x8b8f94, 0.9));
  slab.position.y = 0.75;
  const foot = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.5), std(0x7a7e82, 0.95));
  foot.position.y = 0.11;
  g.add(slab, foot);
  // engraved face: canvas texture with big glyphs
  const c = document.createElement('canvas'); c.width = 128; c.height = 176;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#8b8f94'; ctx.fillRect(0, 0, 128, 176);
  ctx.fillStyle = '#5e6266'; ctx.font = 'bold 84px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 92);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 1.36),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  face.position.set(0, 0.78, 0.115);
  g.add(face);
  g.traverse((o) => { if (o instanceof THREE.Mesh) shadowed(o); });
  return g;
}

// ── Organic winding path of overlapping flattened blobs ─────────────────────
export function placePath(
  group: THREE.Group,
  from: [number, number],
  to: [number, number],
  rng: () => number,
  center = 0xece0b0,
  rim = 0xcdb884,
): void {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const nx = -dz / len;
  const nz = dx / len;
  const off = (rng() - 0.5) * len * 0.25;
  const cx = (from[0] + to[0]) / 2 + nx * off;
  const cz = (from[1] + to[1]) / 2 + nz * off;
  const steps = Math.max(6, Math.floor(len / 0.95));
  const rimMat = std(rim);
  const ctrMat = std(center);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const it = 1 - t;
    const x = it * it * from[0] + 2 * it * t * cx + t * t * to[0];
    const z = it * it * from[1] + 2 * it * t * cz + t * t * to[1];
    const wobble = 0.78 + rng() * 0.18;
    const rimBlob = new THREE.Mesh(G_ICO, rimMat);
    rimBlob.position.set(x, 0.035, z);
    rimBlob.scale.set(wobble, 0.05, wobble);
    rimBlob.rotation.y = rng() * Math.PI;
    rimBlob.receiveShadow = true;
    const ctr = new THREE.Mesh(G_ICO, ctrMat);
    ctr.position.set(x, 0.05, z);
    ctr.scale.set(wobble * 0.72, 0.04, wobble * 0.72);
    ctr.rotation.y = rng() * Math.PI;
    ctr.receiveShadow = true;
    group.add(rimBlob, ctr);
  }
}
