import * as THREE from 'three';
import { locations } from '../../content';
import type { IslandTheme } from '../theme';
import type { IslandBuild, InteractPoint, Collider } from '../kit/types';
import { mulberry32, std } from '../kit/core';
import { buildBase } from '../kit/base';
import { placePath, makePier, makeSeaplane, makeCone, makeScaffold } from '../kit/props';
import { makeHardwoodTree, makeWeedTuft, makeGrassTuft } from '../kit/flora';
import { makeCloud, makeGull } from '../kit/critters';
import { setBuildingTheme, makeHouse, makeMuseum, makeNoticeBoard, makeSign, makeLamp } from '../kit/buildings';

export const theme: IslandTheme = {
  outline: { f1: 4, p1: 0.2, f2: 6, p2: 2.8 },
  turf: {
    base: '#b0a8ca',
    shades: ['#a89ec2', '#968eb2', '#bcb4d4', '#9e96b8'],
    dark: 0x968eb2,
  },
  sand: { base: '#e8dfc0', wet: 0xd0c4a0 },
  path: { center: 0xd6cdb4, rim: 0xa89a7e },
  sky: {
    night:  { horizon: 0x3a3c4e, mid: 0x252636, zenith: 0x14151f, fog: 0x252636 },
    dawn:   { horizon: 0xd8c8b0, mid: 0xa8a8bc, zenith: 0x7a84a0, fog: 0xd0c8bc },
    day:    { horizon: 0xd8dce4, mid: 0xb8c0d0, zenith: 0x9aa3b5, fog: 0xd0d4da },
    sunset: { horizon: 0xe0b88a, mid: 0xc99a6b, zenith: 0x6a6a80, fog: 0xc8a884 },
    dusk:   { horizon: 0xa88a7e, mid: 0x6a6478, zenith: 0x3c3c50, fog: 0x8a7e84 },
  },
  particles: { palette: [0xd8cfc0, 0xc9beb2, 0xe8e0d0], count: 22 },
  ui: { paper: 0xf5eeda, paperWarm: 0xeadfc2, line: 0xb89a5a, body: 0x6a5a3a, heading: 0x8a6a1a },
  buildings: { roof: 0x9a8fb8, door: 0x4a3520, museumRoof: 0x9a8fb8, museumWall: 0xd9d2c4 },
  interior: { houseWall: '#e0dce8', rugRing: 0x9a8fb8, rugCenter: 0xd8d3e8, museumBg: 0xe2dee6 },
};

/** Building footprints (collider circles) — one source for the collider
 *  pushes AND the grass-tuft scatter rejection below. */
const FOOTPRINTS = {
  house: { x: -9.7, z: -2.2, r: 3.0 },
  museum: { x: 0, z: -11.5, r: 3.6 },
  board: { x: 0, z: 3.6, r: 1.35 },
} as const;

// Extra grass rejection: the scaffold ring around the museum.
const GRASS_REJECT = [...Object.values(FOOTPRINTS), { x: 0, z: -11.5, r: 4.5 }];

export function build(): IslandBuild {
  setBuildingTheme(theme.buildings);
  const group = new THREE.Group();
  const colliders: Collider[] = [];
  const clouds: THREE.Group[] = [];
  const rng = mulberry32(20260813);

  // ── Base world (terrain/sand/cliff/sea/foam/waves + tonal patches) ────────
  const base = buildBase(theme, rng);
  group.add(base.group);
  const { walkSurface, sea, foam, waves } = base;

  // ── Plaza + organic winding paths ─────────────────────────────────────────
  const plazaRim = new THREE.Mesh(new THREE.CircleGeometry(2.3, 48), std(theme.path.rim));
  plazaRim.rotation.x = -Math.PI / 2;
  plazaRim.position.set(0, 0.035, 1.5);
  plazaRim.receiveShadow = true;
  const plazaCtr = new THREE.Mesh(new THREE.CircleGeometry(2.0, 48), std(theme.path.center));
  plazaCtr.rotation.x = -Math.PI / 2;
  plazaCtr.position.set(0, 0.045, 1.5);
  plazaCtr.receiveShadow = true;
  group.add(plazaRim, plazaCtr);

  const plaza: [number, number] = [0, 1.5];
  placePath(group, plaza, [0, -7.0], rng, theme.path.center, theme.path.rim); // to museum door
  placePath(group, plaza, [-5.9, -1.3], rng, theme.path.center, theme.path.rim); // to house door
  placePath(group, plaza, [0, 5.4], rng, theme.path.center, theme.path.rim); // to notice board

  // ── Buildings (footprints/rotations are contract-fixed) ───────────────────
  const museum = makeMuseum();
  museum.position.set(FOOTPRINTS.museum.x, 0, FOOTPRINTS.museum.z);
  museum.rotation.y = 0;
  group.add(museum);
  colliders.push({ ...FOOTPRINTS.museum });

  // Scaffolding hugging the museum face — the island is a construction site.
  const scaffold = makeScaffold();
  scaffold.position.set(0, 0, -11.5);
  group.add(scaffold);
  for (const [px, pz] of [
    [-3.5, -13.7],
    [3.5, -13.7],
    [-3.5, -9.3],
    [3.5, -9.3],
  ]) {
    colliders.push({ x: px, z: pz, r: 0.3 });
  }

  const museumSign = makeSign(locations.projects.name);
  museumSign.position.set(2.6, 0, -8.2);
  museumSign.rotation.y = Math.atan2(-2.6, 8.2);
  group.add(museumSign);
  colliders.push({ x: 2.6, z: -8.2, r: 0.5 });

  const house = makeHouse();
  house.position.set(FOOTPRINTS.house.x, 0, FOOTPRINTS.house.z);
  house.rotation.y = Math.atan2(9.7, 2.2);
  group.add(house);
  colliders.push({ ...FOOTPRINTS.house });

  const houseSign = makeSign('Home');
  houseSign.position.set(-7.4, 0, -1.6);
  houseSign.rotation.y = Math.atan2(7.4, 1.6);
  group.add(houseSign);
  colliders.push({ x: -7.4, z: -1.6, r: 0.5 });

  const board = makeNoticeBoard();
  board.position.set(FOOTPRINTS.board.x, 0, FOOTPRINTS.board.z);
  board.rotation.y = Math.atan2(0, -3.6);
  group.add(board);
  colliders.push({ ...FOOTPRINTS.board });

  // Hand-placed "coming soon" sign, leaning by the museum approach.
  const soonSign = makeSign('Soon!');
  soonSign.position.set(2.8, 0, -8.9);
  soonSign.rotation.y = -0.4;
  soonSign.rotation.z = 0.1; // leaning
  group.add(soonSign);
  colliders.push({ x: 2.8, z: -8.9, r: 0.5 });

  for (const [lx, lz] of [
    [-3.0, -1.0],
    [3.0, 4.0],
  ]) {
    const lamp = makeLamp();
    lamp.position.set(lx, 0, lz);
    group.add(lamp);
    colliders.push({ x: lx, z: lz, r: 0.32 });
  }

  // ── Construction dressing: bare dirt patches + traffic cones ──────────────
  for (const [dx, dz, dr] of [
    [-4.3, 4.7, 2.6],
    [3.2, -5.8, 2.1],
  ] as const) {
    const dirt = new THREE.Mesh(
      new THREE.CircleGeometry(dr, 36),
      new THREE.MeshStandardMaterial({ color: 0x8f8266, roughness: 1 }),
    );
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.set(dx, 0.03, dz);
    dirt.receiveShadow = true;
    group.add(dirt);
  }

  for (const [cx, cz] of [
    [-1.2, -3.0],
    [1.2, -4.6],
    [-1.2, -6.2],
    [4.5, 1.0],
    [-6.5, 2.0],
  ]) {
    const cone = makeCone();
    cone.position.set(cx, 0, cz);
    group.add(cone); // no colliders — walkable dressing
  }

  // ── Cherry saplings (freshly planted, scaled down) ────────────────────────
  const saplingLook = { canopyDark: 0x7a9a5e, canopyMid: 0x8fae6e, fruit: 0xffb7c9, scale: 0.55 };
  for (const [tx, tz] of [
    [10.5, -4.5],
    [-11.5, 3.0],
    [5.0, 9.0],
  ]) {
    const { tree, collider } = makeHardwoodTree(rng, tx, tz, saplingLook);
    group.add(tree);
    colliders.push(collider);
  }

  // ── No flowers on a construction site — weed tufts instead ────────────────
  for (const [wx, wz] of [
    [6.5, 6.5],
    [-8.0, -6.0],
    [2.0, 8.5],
    [-5.5, -8.5],
  ]) {
    group.add(makeWeedTuft(wx, wz, rng));
  }

  // scatter grass tufts with rejection against plaza + buildings + scaffold
  let placed = 0;
  let guard = 0;
  while (placed < 12 && guard < 200) {
    guard++;
    const x = (rng() - 0.5) * 26;
    const z = (rng() - 0.5) * 26;
    if (Math.hypot(x, z) > 14.5) continue;
    if (Math.hypot(x, z - 1.5) < 2.5) continue; // keep the plaza clear
    let ok = true;
    for (const b of GRASS_REJECT) {
      if (Math.hypot(x - b.x, z - b.z) < b.r + 0.4) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    group.add(makeGrassTuft(x, z, rng));
    placed++;
  }

  // ── Clouds ─────────────────────────────────────────────────────────────────
  for (let i = 0; i < 4; i++) {
    const c = makeCloud(i * 7 + 3);
    const angle = rng() * Math.PI * 2;
    const radius = 26 + (i % 3) * 7;
    const y = 10 + (i % 3) * 2.2;
    c.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    c.userData = { angle, radius, speed: 0.008 + (i % 3) * 0.004, y };
    clouds.push(c);
    group.add(c);
  }

  // ── A lone gull circling far out over the sea ─────────────────────────────
  const gulls: THREE.Group[] = [];
  {
    const gull = makeGull(900);
    gull.userData.angle = 0.4;
    gull.userData.radius = 27;
    gull.userData.speed = 0.012;
    gull.userData.y = 8.5;
    gull.position.set(Math.cos(0.4) * 27, 8.5, Math.sin(0.4) * 27);
    gulls.push(gull);
    group.add(gull);
  }

  // ── Seaplane dock (Dodo Airlines): pier reaching into the sea + moored plane ──
  const pier = makePier();
  pier.position.set(9.4, 0.12, 13.2); // straight out to sea (+z)
  group.add(pier);
  // The pier deck is WALKABLE: raycast plane + raised walk zone (bounds-exempt)
  const pierDeck = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 5.7),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  pierDeck.rotation.x = -Math.PI / 2;
  pierDeck.position.set(9.4, 0.165, 15.95);
  group.add(pierDeck);
  const pierZone = { minX: 8.55, maxX: 10.25, minZ: 13.1, maxZ: 18.8, y: 0.165 };
  // Approach strip: bounds-exempt but ground-level, overlapping the island
  // circle edge so the pier is reachable.
  const pierApproach = { minX: 8.55, maxX: 10.25, minZ: 11.2, maxZ: 13.3, y: 0 };

  const seaplane = makeSeaplane();
  seaplane.position.set(12.0, -0.82, 18.0);
  seaplane.rotation.y = -0.5;
  group.add(seaplane);

  // ── Interaction points (positions/radii fixed by contract) ────────────────
  // House & museum points sit in FRONT of their doors but OUTSIDE the
  // building colliders (otherwise the villager gets pushed out of range).
  const points: InteractPoint[] = [
    {
      id: 'about',
      label: locations.about.name,
      hint: locations.about.hint,
      enterTo: 'house',
      position: new THREE.Vector3(-5.9, 0, -1.3),
      markerY: 2.4,
      radius: 2.2,
    },
    {
      id: 'projects',
      label: locations.projects.name,
      hint: locations.projects.hint,
      enterTo: 'museum',
      position: new THREE.Vector3(0, 0, -7.0),
      markerY: 2.4,
      radius: 2.2,
    },
    {
      id: 'contact',
      label: locations.contact.name,
      hint: locations.contact.hint,
      route: locations.contact.route,
      position: new THREE.Vector3(0, 0, 5.8),
      markerY: 2.9,
      radius: 2.1,
    },
    {
      id: 'airport',
      label: 'Seaplane Dock',
      hint: 'Fly to another island',
      airport: true,
      position: new THREE.Vector3(9.4, 0, 17.8), // pier end, next to the plane
      markerY: 1.4,
      radius: 1.9,
    },
  ];

  return {
    group,
    walkSurface,
    colliders,
    points,
    clouds,
    foam,
    flames: [],
    waves,
    sea,
    butterflies: [],
    gulls,
    seaplane,
    extraWalkSurfaces: [pierDeck],
    walkZones: [pierZone, pierApproach],
  };
}
