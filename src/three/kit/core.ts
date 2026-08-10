import * as THREE from 'three';

export function std(color: number, roughness = 0.9, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

export function shadowed<T extends THREE.Mesh>(m: T, cast = true, receive = false): T {
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

/** Deterministic PRNG so the island looks identical every load. */
export function mulberry32(seed: number) {
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
export const G_SPHERE = new THREE.SphereGeometry(1, 16, 12);
export const G_SPHERE_LO = new THREE.SphereGeometry(1, 12, 8);
export const G_ICO = new THREE.IcosahedronGeometry(1, 0);
export const G_STEM = new THREE.CylinderGeometry(0.025, 0.03, 0.34, 6);
export const G_BLADE = new THREE.ConeGeometry(0.035, 0.32, 5);
export const G_PALM_SEG = new THREE.CylinderGeometry(0.14, 0.16, 1, 8);
export const G_TULIP = new THREE.LatheGeometry(
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
