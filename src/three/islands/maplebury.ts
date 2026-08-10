import * as THREE from 'three';
import { locations } from '../../content';
import type { IslandTheme } from '../theme';
import type { IslandBuild, InteractPoint, Collider } from '../kit/types';
import { mulberry32, std } from '../kit/core';
import { buildBase } from '../kit/base';
import { placePath, makePier, makeSeaplane, makeLogBench, makeLantern } from '../kit/props';
import {
  makeHardwoodTree,
  makeBush,
  makeFlowerCluster,
  makeTulipCluster,
  makeMushroom,
  makeGrassTuft,
  makeBoulder,
  makeShell,
  TULIP_RED,
  TULIP_YELLOW,
} from '../kit/flora';
import { makeCloud, makeGull } from '../kit/critters';
import { setBuildingTheme, makeHouse, makeMuseum, makeNoticeBoard, makeSign, makeLamp } from '../kit/buildings';

export const theme: IslandTheme = {
  outline: { f1: 4, p1: 1.3, f2: 7, p2: 0.4 },
  turf: {
    base: '#d4af66',
    shades: ['#c9a258', '#b8933f', '#daba72', '#c09a4a'],
    dark: 0xb08a44,
  },
  sand: { base: '#f7e6ad', wet: 0xe6cf8e },
  path: { center: 0xe8d9a8, rim: 0xc2a96e },
  sky: {
    night:  { horizon: 0x3a3460, mid: 0x23204a, zenith: 0x12102e, fog: 0x23204a },
    dawn:   { horizon: 0xffcf9a, mid: 0xd8a06a, zenith: 0x7a8fc0, fog: 0xffd9a8 },
    day:    { horizon: 0xffe9c4, mid: 0xeec27f, zenith: 0x8fa8d0, fog: 0xe8dcc8 },
    sunset: { horizon: 0xffc98a, mid: 0xe07840, zenith: 0x6a5a90, fog: 0xe8a878 },
    dusk:   { horizon: 0xffb37a, mid: 0xd96b3b, zenith: 0x7a4a58, fog: 0xb0785a },
  },
  particles: { palette: [0xd97b2f, 0xc14e2e, 0xe8a04a, 0xb0402a, 0xe8c05a], count: 40 },
  ui: { paper: 0xf7ecda, paperWarm: 0xefe0c4, line: 0x5a3d22, body: 0x5a4228, heading: 0x4a2f16 },
  buildings: { roof: 0x4f86c6, door: 0x3a4a5a, museumRoof: 0x6b4f2a, museumWall: 0xf0e2c8 },
  interior: { houseWall: '#f2e4cc', rugRing: 0x8a5a2b, rugCenter: 0xd96b3b, museumBg: 0xefe4d0 },
};

// Maple canopy looks (dark core / mid rim + highlight)
const MAPLE = { canopyDark: 0xa8402a, canopyMid: 0xd97b2f };
const MAPLE_RED = { canopyDark: 0x8e3a2a, canopyMid: 0xc14e2e };

/** Building footprints (collider circles) — one source for the collider
 *  pushes AND the grass-tuft scatter rejection below. */
const FOOTPRINTS = {
  house: { x: -12.2, z: -5.0, r: 3.0 },
  museum: { x: 0, z: -11.3, r: 3.6 },
  board: { x: -0.5, z: 1.9, r: 1.35 },
} as const;

export function build(): IslandBuild {
  setBuildingTheme(theme.buildings);
  const group = new THREE.Group();
  const colliders: Collider[] = [];
  const clouds: THREE.Group[] = [];
  const rng = mulberry32(20260810);

  // ── Base world (terrain/sand/cliff/sea/foam/waves + tonal patches) ────────
  const base = buildBase(theme, rng);
  group.add(base.group);
  const { walkSurface, sea, foam, waves } = base;

  // ── Plaza + organic winding paths ─────────────────────────────────────────
  const plazaRim = new THREE.Mesh(new THREE.CircleGeometry(2.3, 48), std(theme.path.rim));
  plazaRim.rotation.x = -Math.PI / 2;
  plazaRim.position.set(0, 0.035, -0.5);
  plazaRim.receiveShadow = true;
  const plazaCtr = new THREE.Mesh(new THREE.CircleGeometry(2.0, 48), std(theme.path.center));
  plazaCtr.rotation.x = -Math.PI / 2;
  plazaCtr.position.set(0, 0.045, -0.5);
  plazaCtr.receiveShadow = true;
  group.add(plazaRim, plazaCtr);

  const plaza: [number, number] = [0, -0.5];
  placePath(group, plaza, [-9.2, -4.0], rng, theme.path.center, theme.path.rim); // to house door
  placePath(group, plaza, [0, -6.6], rng, theme.path.center, theme.path.rim); // to museum door
  placePath(group, plaza, [-0.5, 3.2], rng, theme.path.center, theme.path.rim); // to notice board
  placePath(group, plaza, [5.4, 0.4], rng, theme.path.center, theme.path.rim); // to reading bench

  // ── Buildings (footprints/rotations are contract-fixed) ───────────────────
  const house = makeHouse();
  house.position.set(FOOTPRINTS.house.x, 0, FOOTPRINTS.house.z);
  house.rotation.y = Math.atan2(12.2, 4.5);
  group.add(house);
  colliders.push({ ...FOOTPRINTS.house });

  const houseSign = makeSign('Home');
  houseSign.position.set(-9.4, 0, -3.9); // flanks the door approach (never blocks it)
  houseSign.rotation.y = Math.atan2(9.4, 3.4);
  group.add(houseSign);
  colliders.push({ x: -9.4, z: -3.9, r: 0.5 });

  const museum = makeMuseum();
  museum.position.set(FOOTPRINTS.museum.x, 0, FOOTPRINTS.museum.z);
  museum.rotation.y = 0;
  group.add(museum);
  colliders.push({ ...FOOTPRINTS.museum });

  const museumSign = makeSign(locations.projects.name);
  museumSign.position.set(2.4, 0, -7.6); // flanks the door approach
  museumSign.rotation.y = Math.atan2(-2.4, 7.1);
  group.add(museumSign);
  colliders.push({ x: 2.4, z: -7.6, r: 0.5 });

  const board = makeNoticeBoard();
  board.position.set(FOOTPRINTS.board.x, 0, FOOTPRINTS.board.z);
  board.rotation.y = Math.atan2(0.5, -2.4);
  group.add(board);
  colliders.push({ ...FOOTPRINTS.board });

  for (const [lx, lz] of [
    [-3.2, -3.0],
    [2.6, 1.2],
  ]) {
    const lamp = makeLamp();
    lamp.position.set(lx, 0, lz);
    group.add(lamp);
    colliders.push({ x: lx, z: lz, r: 0.32 });
  }

  // ── Maple grove (red/orange hardwoods) + pear fruit trees ─────────────────
  const maples: [number, number, typeof MAPLE][] = [
    [-7.2, -14.4, MAPLE],
    [4.3, -14.0, MAPLE_RED],
    [6.5, -10.1, MAPLE],
    [-9.4, -13.7, MAPLE_RED],
    [0.5, -14.6, MAPLE],
  ];
  for (const [tx, tz, look] of maples) {
    const { tree, collider } = makeHardwoodTree(rng, tx, tz, look);
    group.add(tree);
    colliders.push(collider);
  }
  const pears: [number, number][] = [
    [11.5, 3.5],
    [-12.5, 1.0],
    [8.5, -7.5],
  ];
  for (const [tx, tz] of pears) {
    const { tree, collider } = makeHardwoodTree(rng, tx, tz, { fruit: 0xd8e07a });
    group.add(tree);
    colliders.push(collider);
  }

  // ── Reading corner: log bench + paper lanterns ────────────────────────────
  const bench = makeLogBench();
  bench.position.set(5.8, 0, 0.7);
  bench.rotation.y = -1.2;
  group.add(bench);
  colliders.push({ x: 5.8, z: 0.7, r: 0.7 });

  for (const [lx, lz] of [
    [10.1, -2.2],
    [3.6, 3.6],
  ]) {
    const lantern = makeLantern();
    lantern.position.set(lx, 0, lz);
    group.add(lantern);
    colliders.push({ x: lx, z: lz, r: 0.3 });
  }

  // ── Bushes near building edges / clearings ────────────────────────────────
  const bushes: [number, number][] = [
    [-6.0, 2.5],
    [4.0, -4.6],
    [-3.5, 6.8],
  ];
  for (const [bx, bz] of bushes) {
    const { bush, collider } = makeBush(bx, bz, rng);
    group.add(bush);
    colliders.push(collider);
  }

  // ── Flowers / tulips / mushroom: autumn ground colour ─────────────────────
  group.add(makeFlowerCluster(-3.6, 4.2, [0xd96b3b, 0xe8a04a], rng));
  group.add(makeFlowerCluster(7.4, 4.8, [0xc14e2e, 0xe8c05a], rng));
  group.add(makeTulipCluster(-7.8, -1.5, [TULIP_RED, TULIP_YELLOW], rng));
  group.add(makeMushroom(-4.6, -8.6, true, rng));

  // scatter grass tufts with rejection against plaza + buildings
  let placed = 0;
  let guard = 0;
  while (placed < 12 && guard < 200) {
    guard++;
    const x = (rng() - 0.5) * 26;
    const z = (rng() - 0.5) * 26;
    if (Math.hypot(x, z) > 14.5) continue;
    if (Math.hypot(x, z + 0.5) < 2.5) continue; // keep the plaza clear
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

  // ── Rock + beach shell ────────────────────────────────────────────────────
  {
    const { rock, collider } = makeBoulder(-12.0, -7.8, 0.5, rng);
    group.add(rock);
    colliders.push(collider);
  }
  group.add(makeShell(15.5, 6.0, rng));

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
      position: new THREE.Vector3(-8.5, 0, -3.65),
      markerY: 2.4,
      radius: 2.2,
    },
    {
      id: 'projects',
      label: locations.projects.name,
      hint: locations.projects.hint,
      enterTo: 'museum',
      position: new THREE.Vector3(0, 0, -6.8),
      markerY: 2.4,
      radius: 2.2,
    },
    {
      id: 'contact',
      label: locations.contact.name,
      hint: locations.contact.hint,
      route: locations.contact.route,
      position: new THREE.Vector3(-0.5, 0, 4.4),
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
