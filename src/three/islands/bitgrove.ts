import * as THREE from 'three';
import { locations } from '../../content';
import type { IslandTheme } from '../theme';
import type { IslandBuild, InteractPoint, Collider } from '../kit/types';
import { mulberry32, std } from '../kit/core';
import { buildBase } from '../kit/base';
import {
  placePath,
  makePier,
  makeSeaplane,
  makeBamboo,
  makeStoneLantern,
  makeStoneTablet,
} from '../kit/props';
import { makeHardwoodTree, makeBush, makeFlowerCluster, makeGrassTuft } from '../kit/flora';
import { makeCloud, makeGull } from '../kit/critters';
import { setBuildingTheme, makeHouse, makeMuseum, makeNoticeBoard, makeSign, makeLamp } from '../kit/buildings';

export const theme: IslandTheme = {
  outline: { f1: 5, p1: 3.0, f2: 9, p2: 4.2 },
  turf: { base: '#7ab887', shades: ['#6fae7d', '#5e9a6a', '#86c494', '#66a472'], dark: 0x5e9a6a },
  sand: { base: '#f0e8c8', wet: 0xd8cca0 },
  path: { center: 0xc8c8be, rim: 0x9a9a90 }, // grey stone
  sky: {
    night:  { horizon: 0x2a3a4a, mid: 0x141c2c, zenith: 0x0a1018, fog: 0x141c2c },
    dawn:   { horizon: 0xd8e8d8, mid: 0xa8c8c0, zenith: 0x7aa8b8, fog: 0xd0e0d8 },
    day:    { horizon: 0xe8f2e4, mid: 0xbad8da, zenith: 0x87b8c9, fog: 0xdfe8e2 },
    sunset: { horizon: 0xf2c98a, mid: 0xe0a45e, zenith: 0x5a7a8a, fog: 0xd8b88a },
    dusk:   { horizon: 0xc09a7a, mid: 0x7a6a7e, zenith: 0x3a4258, fog: 0x8a7a80 },
  },
  particles: { palette: [0xcfe8c0, 0xaed8a8, 0xe8f2d8], count: 18 },
  ui: { paper: 0xf4f0e4, paperWarm: 0xe9e2d0, line: 0x2e2420, body: 0x3a3028, heading: 0xa32e2e },
  buildings: { roof: 0xf2a541, door: 0x54331a, museumRoof: 0x54331a, museumWall: 0xe8e2d4 },
  interior: { houseWall: '#e4ece0', rugRing: 0x2e6e4b, rugCenter: 0xd8cdb5, museumBg: 0xe6eae0 },
};

/** Building/prop footprints (collider circles) — one source for the collider
 *  pushes AND the grass-tuft scatter rejection below. */
const FOOTPRINTS = {
  house: { x: 6.5, z: -11.5, r: 3.0 },
  museum: { x: 7.9, z: 4.9, r: 3.6 },
  board: { x: -2.5, z: -8.6, r: 1.35 },
  tablet: { x: -1.3, z: -0.4, r: 0.9 },
  pond: { x: -3.2, z: 9.4, r: 3.3 },
} as const;

export function build(): IslandBuild {
  setBuildingTheme(theme.buildings);
  const group = new THREE.Group();
  const colliders: Collider[] = [];
  const clouds: THREE.Group[] = [];
  const sway: THREE.Group[] = [];
  const rng = mulberry32(20260812);

  // ── Base world (terrain/sand/cliff/sea/foam/waves + tonal patches) ────────
  const base = buildBase(theme, rng);
  group.add(base.group);
  const { walkSurface, sea, foam, waves } = base;

  // ── Stone plaza + grey paths ──────────────────────────────────────────────
  const plazaRim = new THREE.Mesh(new THREE.CircleGeometry(2.3, 48), std(theme.path.rim));
  plazaRim.rotation.x = -Math.PI / 2;
  plazaRim.position.set(0, 0.035, 0);
  plazaRim.receiveShadow = true;
  const plazaCtr = new THREE.Mesh(new THREE.CircleGeometry(2.0, 48), std(theme.path.center));
  plazaCtr.rotation.x = -Math.PI / 2;
  plazaCtr.position.set(0, 0.045, 0);
  plazaCtr.receiveShadow = true;
  group.add(plazaRim, plazaCtr);

  const plaza: [number, number] = [0, 0];
  placePath(group, plaza, [4.6, -8.1], rng, theme.path.center, theme.path.rim); // to house door
  placePath(group, plaza, [4.1, 2.5], rng, theme.path.center, theme.path.rim); // to museum door
  placePath(group, plaza, [-2.5, -6.4], rng, theme.path.center, theme.path.rim); // to notice board
  placePath(group, plaza, [-2.6, 6.8], rng, theme.path.center, theme.path.rim); // toward pond rim

  // ── Engraved stone tablet standing ON the plaza (ZeroOne Island) ──────────
  const tablet = makeStoneTablet('01');
  tablet.position.set(FOOTPRINTS.tablet.x, 0, FOOTPRINTS.tablet.z);
  tablet.rotation.y = 0.4;
  group.add(tablet);
  colliders.push({ ...FOOTPRINTS.tablet });

  // ── Bamboo wall along the west edge (engine sways them via IslandBuild.sway) ──
  for (const [bx, zoff] of [
    [-12.2, 0],
    [-10.8, 0.65],
  ] as const) {
    for (let z = -14 + zoff; z <= 2; z += 1.3) {
      const b = makeBamboo(rng);
      b.position.set(bx, 0, z);
      group.add(b);
      colliders.push({ x: bx, z, r: 0.3 });
      sway.push(b);
    }
  }

  // ── Teal pond with stone rim + stepping stones ────────────────────────────
  const pondRim = new THREE.Mesh(new THREE.RingGeometry(3.0, 3.5, 40), std(0xb8b8ae));
  pondRim.rotation.x = -Math.PI / 2;
  pondRim.position.set(FOOTPRINTS.pond.x, 0.028, FOOTPRINTS.pond.z);
  pondRim.receiveShadow = true;
  const pondWater = new THREE.Mesh(
    new THREE.CircleGeometry(3.0, 40),
    new THREE.MeshStandardMaterial({ color: 0x4f9a9c, roughness: 0.3 }),
  );
  pondWater.rotation.x = -Math.PI / 2;
  pondWater.position.set(FOOTPRINTS.pond.x, 0.03, FOOTPRINTS.pond.z);
  pondWater.receiveShadow = true;
  group.add(pondRim, pondWater);
  for (const [sx, sz] of [
    [-4.4, 8.2],
    [-3.2, 9.4],
    [-2.0, 10.6],
  ]) {
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.08, 9), std(0x9aa0a4));
    stone.position.set(sx, 0.06, sz);
    stone.receiveShadow = true;
    group.add(stone);
  }
  colliders.push({ ...FOOTPRINTS.pond });

  // ── Stone lanterns (toro) flanking the west path + the pond approach ──────
  for (const [lx, lz] of [
    [-6.5, -5.5],
    [3.0, 6.5],
  ]) {
    const lantern = makeStoneLantern();
    lantern.position.set(lx, 0, lz);
    group.add(lantern);
    colliders.push({ x: lx, z: lz, r: 0.35 });
  }

  // ── Buildings (footprints/rotations are contract-fixed) ───────────────────
  const house = makeHouse();
  house.position.set(FOOTPRINTS.house.x, 0, FOOTPRINTS.house.z);
  house.rotation.y = Math.atan2(-6.5, 11.5);
  group.add(house);
  colliders.push({ ...FOOTPRINTS.house });

  const houseSign = makeSign('Home');
  houseSign.position.set(5.0, 0, -8.2); // flanks the door approach (never blocks it)
  houseSign.rotation.y = Math.atan2(-5.0, 8.2);
  group.add(houseSign);
  colliders.push({ x: 5.0, z: -8.2, r: 0.5 });

  const museum = makeMuseum();
  museum.position.set(FOOTPRINTS.museum.x, 0, FOOTPRINTS.museum.z);
  museum.rotation.y = Math.atan2(-7.9, -4.9);
  group.add(museum);
  colliders.push({ ...FOOTPRINTS.museum });

  const museumSign = makeSign(locations.projects.name);
  museumSign.position.set(5.6, 0, 3.2); // flanks the door approach
  museumSign.rotation.y = Math.atan2(-5.6, -3.2);
  group.add(museumSign);
  colliders.push({ x: 5.6, z: 3.2, r: 0.5 });

  const board = makeNoticeBoard();
  board.position.set(FOOTPRINTS.board.x, 0, FOOTPRINTS.board.z);
  board.rotation.y = Math.atan2(2.5, 8.6);
  group.add(board);
  colliders.push({ ...FOOTPRINTS.board });

  for (const [lx, lz] of [
    [-4.5, -2.5],
    [3.5, -3.5],
  ]) {
    const lamp = makeLamp();
    lamp.position.set(lx, 0, lz);
    group.add(lamp);
    colliders.push({ x: lx, z: lz, r: 0.32 });
  }

  // ── Peach fruit trees ─────────────────────────────────────────────────────
  const peaches: [number, number][] = [
    [11.5, -5.5],
    [-5.5, -13.0],
    [12.0, 6.0],
  ];
  for (const [tx, tz] of peaches) {
    const { tree, collider } = makeHardwoodTree(rng, tx, tz, { fruit: 0xffb08a });
    group.add(tree);
    colliders.push(collider);
  }

  // ── Bushes near building edges / clearings ────────────────────────────────
  const bushes: [number, number][] = [
    [1.5, -6.0],
    [-7.5, -9.0],
  ];
  for (const [bx, bz] of bushes) {
    const { bush, collider } = makeBush(bx, bz, rng);
    group.add(bush);
    colliders.push(collider);
  }

  // ── Flowers: white/green zen ground colour ────────────────────────────────
  group.add(makeFlowerCluster(-8.0, 4.5, [0xffffff, 0xe8f2d8, 0xcfe8c0], rng));
  group.add(makeFlowerCluster(6.0, 8.5, [0xffffff, 0xe8f2d8, 0xcfe8c0], rng));

  // scatter grass tufts with rejection against plaza + footprints
  let placed = 0;
  let guard = 0;
  while (placed < 12 && guard < 200) {
    guard++;
    const x = (rng() - 0.5) * 26;
    const z = (rng() - 0.5) * 26;
    if (Math.hypot(x, z) > 14.5) continue;
    if (Math.hypot(x, z) < 2.5) continue; // keep the plaza clear
    let ok = true;
    for (const b of Object.values(FOOTPRINTS)) {
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
  for (let i = 0; i < 5; i++) {
    const c = makeCloud(i * 7 + 3);
    const angle = rng() * Math.PI * 2;
    const radius = 26 + (i % 3) * 7;
    const y = 10 + (i % 3) * 2.2;
    c.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    c.userData = { angle, radius, speed: 0.008 + (i % 3) * 0.004, y };
    clouds.push(c);
    group.add(c);
  }

  // ── Seagulls circling far out over the sea (engine orbits + flaps) ────────
  const gulls: THREE.Group[] = [];
  const gullSpecs: [number, number, number, number][] = [
    // [radius, y, speed, angleStart]
    [27, 8.5, 0.012, 0.4],
    [33, 10.5, 0.01, 2.2],
  ];
  for (let i = 0; i < gullSpecs.length; i++) {
    const [gr, gy, gs, ga] = gullSpecs[i];
    const gull = makeGull(900 + i);
    gull.userData.angle = ga;
    gull.userData.radius = gr;
    gull.userData.speed = gs;
    gull.userData.y = gy;
    gull.position.set(Math.cos(ga) * gr, gy, Math.sin(ga) * gr);
    gulls.push(gull);
    group.add(gull);
  }

  // ── Seaplane dock (Dodo Airlines): pier reaching into the sea + moored plane ──
  const pier = makePier();
  pier.position.set(1.1, 0.12, 13.2); // straight out to sea (+z)
  group.add(pier);
  // The pier deck is WALKABLE: raycast plane + raised walk zone (bounds-exempt)
  const pierDeck = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 5.7),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  pierDeck.rotation.x = -Math.PI / 2;
  pierDeck.position.set(1.1, 0.165, 15.95);
  group.add(pierDeck);
  const pierZone = { minX: 0.25, maxX: 1.95, minZ: 13.1, maxZ: 18.8, y: 0.165 };
  // Approach strip: bounds-exempt but ground-level, overlapping the island
  // circle edge so the pier is reachable.
  const pierApproach = { minX: 0.25, maxX: 1.95, minZ: 11.1, maxZ: 13.3, y: 0 };

  const seaplane = makeSeaplane();
  seaplane.position.set(3.7, -0.82, 18.0);
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
      position: new THREE.Vector3(4.6, 0, -8.1),
      markerY: 2.4,
      radius: 2.2,
    },
    {
      id: 'projects',
      label: locations.projects.name,
      hint: locations.projects.hint,
      enterTo: 'museum',
      position: new THREE.Vector3(4.1, 0, 2.5),
      markerY: 2.4,
      radius: 2.2,
    },
    {
      id: 'contact',
      label: locations.contact.name,
      hint: locations.contact.hint,
      route: locations.contact.route,
      position: new THREE.Vector3(-2.5, 0, -6.4),
      markerY: 2.9,
      radius: 2.1,
    },
    {
      id: 'airport',
      label: 'Seaplane Dock',
      hint: 'Fly to another island',
      airport: true,
      position: new THREE.Vector3(1.1, 0, 17.8), // pier end, next to the plane
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
    sway,
  };
}
