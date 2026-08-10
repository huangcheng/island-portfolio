import * as THREE from 'three';
import { std, mulberry32, G_SPHERE, G_SPHERE_LO } from './core';
import type { Butterfly } from './types';

// ── Cloud: puffy AC cumulus — flat base, rounded bumps rising from it ───────
export function makeCloud(seed: number): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  const shade = new THREE.MeshStandardMaterial({ color: 0xdfeefc, roughness: 1 });
  const rng = mulberry32(seed * 97 + 13);
  // Base row: bumps whose BOTTOMS all sit on the same plane (flat-bottom look)
  const n = 3 + ((rng() * 3) | 0);
  for (let i = 0; i < n; i++) {
    const r = 0.75 + rng() * 0.55;
    const s = new THREE.Mesh(G_SPHERE, m);
    const sy = r * 0.52;
    s.position.set((i - (n - 1) / 2) * (1.05 + rng() * 0.3), sy, (rng() - 0.5) * 0.7);
    s.scale.set(r, sy, r * 0.8);
    g.add(s);
  }
  // One smaller cap bump rising above the middle (the cumulus peak)
  const cap = new THREE.Mesh(G_SPHERE, m);
  const cr = 0.65 + rng() * 0.3;
  cap.position.set((rng() - 0.5) * 0.6, 0.52 + cr * 0.42, (rng() - 0.5) * 0.3);
  cap.scale.set(cr, cr * 0.62, cr * 0.8);
  g.add(cap);
  // Thin cool-toned skirt under the base sells the flat-bottomed shading
  const skirt = new THREE.Mesh(G_SPHERE, shade);
  skirt.position.set(0, 0.06, 0);
  skirt.scale.set(n * 0.75, 0.1, 0.85);
  g.add(skirt);
  return g;
}

/** One wing: big forewing lobe + smaller hindwing lobe, pivot at the body. */
function makeWingGroup(color: number, mirror: boolean): THREE.Group {
  const grp = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.01, 0.09, 0.1, 0.15, 0.16, 0.115); // forewing top
  s.bezierCurveTo(0.21, 0.09, 0.21, 0.03, 0.135, 0.005); // forewing tip
  s.bezierCurveTo(0.185, -0.03, 0.16, -0.1, 0.095, -0.105); // hindwing lobe
  s.bezierCurveTo(0.05, -0.11, 0.008, -0.05, 0, 0); // back to body
  const geo = new THREE.ShapeGeometry(s, 10);
  geo.rotateX(-Math.PI / 2); // lie flat (XZ plane)
  if (mirror) geo.scale(-1, 1, 1);
  const wing = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color, roughness: 0.7, side: THREE.DoubleSide }),
  );
  grp.add(wing);

  // White spots riding the wing
  const spotMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide });
  const spotGeo = new THREE.CircleGeometry(0.016, 8);
  spotGeo.rotateX(-Math.PI / 2);
  for (const [px, pz, ps] of [
    [0.12, -0.055, 1],
    [0.1, 0.06, 0.8],
  ] as const) {
    const spot = new THREE.Mesh(spotGeo, spotMat);
    spot.position.set(mirror ? -px : px, 0.002, -pz);
    spot.scale.setScalar(ps);
    grp.add(spot);
  }
  return grp;
}

export function makeButterfly(color: number, anchor: THREE.Vector3, phase: number): Butterfly {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.09, 4, 6), std(0x3a3230, 0.7));
  body.rotation.x = Math.PI / 2;
  g.add(body);
  // Little antennae
  const antGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 0.07, 4);
  for (const sx of [-0.02, 0.02]) {
    const ant = new THREE.Mesh(antGeo, std(0x3a3230, 0.7));
    ant.position.set(sx, 0.03, 0.055);
    ant.rotation.set(0.5, 0, sx < 0 ? 0.35 : -0.35);
    g.add(ant);
  }
  const wingL = makeWingGroup(color, true);
  const wingR = makeWingGroup(color, false);
  g.add(wingL, wingR);
  return { group: g, wingL, wingR, anchor, phase };
}

// ── Seagull: tiny dark silhouette + two arc wings (engine orbits + flaps) ───
export function makeGull(seed: number): THREE.Group {
  const g = new THREE.Group();
  const rng = mulberry32(seed * 131 + 7);
  const bodyMat = std(0x4a4a52, 0.95);
  const body = new THREE.Mesh(G_SPHERE_LO, bodyMat);
  body.scale.set(0.05, 0.06, 0.14); // tiny body, long along Z (forward)
  g.add(body);
  const head = new THREE.Mesh(G_SPHERE_LO, bodyMat);
  head.scale.setScalar(0.04);
  head.position.set(0, 0.012, 0.1);
  g.add(head);

  // Half-torus arch per wing: shift so the arch base anchors at the body and
  // the arc spreads sideways (+X / -X), arcing up in Y → the classic gull "M".
  const wingGeo = new THREE.TorusGeometry(0.15, 0.013, 5, 16, Math.PI);
  const wingMat = std(0x5a5a62, 0.95);
  const makeWing = (side: number): THREE.Group => {
    const wg = new THREE.Group();
    const w = new THREE.Mesh(wingGeo, wingMat);
    w.position.x = side * 0.15;
    w.scale.set(1, 0.45 + rng() * 0.1, 1); // shallow arc
    wg.add(w);
    return wg;
  };
  const wingL = makeWing(-1);
  const wingR = makeWing(1);
  g.add(wingL, wingR);
  g.userData = { wingL, wingR, angle: 0, radius: 0, speed: 0, y: 0 };
  return g;
}
