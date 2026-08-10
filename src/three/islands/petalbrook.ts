import * as THREE from 'three';
import { locations } from '../../content';
import type { IslandTheme } from '../theme';
import type { IslandBuild, InteractPoint, Collider, Butterfly } from '../kit/types';
import { mulberry32, std } from '../kit/core';
import { buildBase } from '../kit/base';
import { placePath, makePier, makeSeaplane } from '../kit/props';
import {
  makeHardwoodTree,
  makeBush,
  makeFlowerCluster,
  makeGrassTuft,
} from '../kit/flora';
import { makeCloud, makeButterfly, makeGull } from '../kit/critters';
import { setBuildingTheme, makeHouse, makeMuseum, makeNoticeBoard, makeSign, makeLamp } from '../kit/buildings';

export const theme: IslandTheme = {
  outline: { f1: 6, p1: 2.2, f2: 8, p2: 1.1 },
  turf: {
    base: '#abe288',
    shades: ['#9ed67c', '#8cc864', '#b8e894', '#96d070'],
    dark: 0x86c464,
  },
  sand: { base: '#f7e6ad', wet: 0xe6cf8e },
  path: { center: 0xf0eee6, rim: 0xcfc8b8 }, // light stone
  sky: {
    night:  { horizon: 0x3d3660, mid: 0x2a2547, zenith: 0x171230, fog: 0x2a2547 },
    dawn:   { horizon: 0xffe4ee, mid: 0xd8c4e0, zenith: 0x8fa8d0, fog: 0xf2d8e4 },
    day:    { horizon: 0xfff0f5, mid: 0xc8e4f4, zenith: 0xa8d8f0, fog: 0xe4eef2 },
    sunset: { horizon: 0xffd9e8, mid: 0xe8b7d4, zenith: 0x9a86b8, fog: 0xe8ccd8 },
    dusk:   { horizon: 0xd8a8c8, mid: 0x9a7aa8, zenith: 0x4a4472, fog: 0x9a86a8 },
  },
  particles: { palette: [0xffb7d5, 0xffcfe2, 0xf4a7c3, 0xffffff, 0xffe4ee], count: 44 },
  ui: { paper: 0xfffdf8, paperWarm: 0xfdf3f6, line: 0xe8b8cc, body: 0x7a5a66, heading: 0xa24878 },
  buildings: { roof: 0x53a05a, door: 0x4a3520, museumRoof: 0xd8d2c4, museumWall: 0xfdfaf2 },
  interior: { houseWall: '#fdeef4', rugRing: 0xf4a7c3, rugCenter: 0xffffff, museumBg: 0xf6ecef },
};

// Sakura canopy look (dark core / mid rim + highlight)
const SAKURA = { canopyDark: 0xe892b4, canopyMid: 0xf7bcd4 };

/** Building footprints (collider circles) — one source for the collider
 *  pushes AND the grass-tuft scatter rejection below. */
const FOOTPRINTS = {
  house: { x: 6.5, z: -2.5, r: 3.0 },
  museum: { x: 7.2, z: -11.2, r: 3.6 },
  board: { x: 0.4, z: 1.4, r: 1.35 },
} as const;

export function build(): IslandBuild {
  setBuildingTheme(theme.buildings);
  const group = new THREE.Group();
  const colliders: Collider[] = [];
  const clouds: THREE.Group[] = [];
  const rng = mulberry32(20260811);

  // ── Base world (terrain/sand/cliff/sea/foam/waves + tonal patches) ────────
  const base = buildBase(theme, rng);
  group.add(base.group);
  const { walkSurface, sea, foam, waves } = base;

  // ── Plaza + organic winding paths ─────────────────────────────────────────
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
  placePath(group, plaza, [2.9, -1.1], rng, theme.path.center, theme.path.rim); // to house door
  placePath(group, plaza, [4.8, -7.4], rng, theme.path.center, theme.path.rim); // to museum door
  placePath(group, plaza, [0.4, 3.2], rng, theme.path.center, theme.path.rim); // to notice board
  placePath(group, plaza, [-3.4, 1.2], rng, theme.path.center, theme.path.rim); // to pond rim

  // ── Buildings (footprints/rotations are contract-fixed) ───────────────────
  const house = makeHouse();
  house.position.set(FOOTPRINTS.house.x, 0, FOOTPRINTS.house.z);
  house.rotation.y = Math.atan2(-6.5, 2.5);
  group.add(house);
  colliders.push({ ...FOOTPRINTS.house });

  const houseSign = makeSign('Home');
  houseSign.position.set(4.6, 0, -2.0); // flanks the door approach (never blocks it)
  houseSign.rotation.y = Math.atan2(-4.6, 2.0);
  group.add(houseSign);
  colliders.push({ x: 4.6, z: -2.0, r: 0.5 });

  const museum = makeMuseum();
  museum.position.set(FOOTPRINTS.museum.x, 0, FOOTPRINTS.museum.z);
  museum.rotation.y = Math.atan2(-7.2, 11.2);
  group.add(museum);
  colliders.push({ ...FOOTPRINTS.museum });

  const museumSign = makeSign(locations.projects.name);
  museumSign.position.set(4.6, 0, -8.4); // flanks the door approach
  museumSign.rotation.y = Math.atan2(-4.6, 8.4);
  group.add(museumSign);
  colliders.push({ x: 4.6, z: -8.4, r: 0.5 });

  const board = makeNoticeBoard();
  board.position.set(FOOTPRINTS.board.x, 0, FOOTPRINTS.board.z);
  board.rotation.y = Math.atan2(-0.4, -1.4);
  group.add(board);
  colliders.push({ ...FOOTPRINTS.board });

  for (const [lx, lz] of [
    [-2.8, -2.6],
    [3.4, 2.2],
  ]) {
    const lamp = makeLamp();
    lamp.position.set(lx, 0, lz);
    group.add(lamp);
    colliders.push({ x: lx, z: lz, r: 0.32 });
  }

  // ── Sakura grove along the north edge + apple fruit trees ─────────────────
  const sakuras: [number, number][] = [
    [-10.8, -11.7],
    [-6.5, -12.3],
    [-2.2, -12.6],
    [2.2, -12.2],
    [6.0, -11.8],
  ];
  for (const [tx, tz] of sakuras) {
    const { tree, collider } = makeHardwoodTree(rng, tx, tz, SAKURA);
    group.add(tree);
    colliders.push(collider);
  }
  const apples: [number, number][] = [
    [-12.0, 6.0],
    [11.8, -3.0],
    [-3.0, 10.5],
  ];
  for (const [tx, tz] of apples) {
    const { tree, collider } = makeHardwoodTree(rng, tx, tz, { fruit: 0xe85a5a });
    group.add(tree);
    colliders.push(collider);
  }

  // ── Pond: still water, stone rim, drifting petals ─────────────────────────
  const POND = { x: -5.8, z: 1.8, r: 3.2 };
  const pondRim = new THREE.Mesh(new THREE.RingGeometry(POND.r, POND.r + 0.45, 40), std(0xe8e0cc));
  pondRim.rotation.x = -Math.PI / 2;
  pondRim.position.set(POND.x, 0.028, POND.z);
  pondRim.receiveShadow = true;
  const pondWater = new THREE.Mesh(
    new THREE.CircleGeometry(POND.r, 40),
    new THREE.MeshStandardMaterial({ color: 0x7ec8e8, roughness: 0.35 }),
  );
  pondWater.rotation.x = -Math.PI / 2;
  pondWater.position.set(POND.x, 0.03, POND.z);
  pondWater.receiveShadow = true;
  group.add(pondRim, pondWater);
  for (let i = 0; i < 6; i++) {
    const petal = new THREE.Mesh(
      new THREE.CircleGeometry(0.09, 12),
      std(i % 2 === 0 ? 0xffb7d5 : 0xffffff),
    );
    petal.rotation.x = -Math.PI / 2;
    const pa = rng() * Math.PI * 2;
    const pr = rng() * (POND.r - 0.6);
    petal.position.set(POND.x + Math.cos(pa) * pr, 0.045, POND.z + Math.sin(pa) * pr);
    group.add(petal);
  }
  colliders.push({ x: POND.x, z: POND.z, r: 3.5 });

  // ── Bushes near building edges / clearings ────────────────────────────────
  const bushes: [number, number][] = [
    [-4.0, -6.5],
    [10.5, -6.0],
  ];
  for (const [bx, bz] of bushes) {
    const { bush, collider } = makeBush(bx, bz, rng);
    group.add(bush);
    colliders.push(collider);
  }

  // ── Flowers: spring ground colour ─────────────────────────────────────────
  group.add(makeFlowerCluster(-8.6, -4.0, [0xfff6e0, 0xffffff], rng));
  group.add(makeFlowerCluster(1.5, 6.5, [0xff9ec4, 0xffcfe2], rng));
  group.add(makeFlowerCluster(9.0, 1.0, [0xfff6e0, 0xffffff, 0xff9ec4, 0xffcfe2], rng));

  // scatter grass tufts with rejection against plaza + buildings
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

  // ── Butterflies fluttering over the flower beds ──────────────────────────
  const butterflies: Butterfly[] = [
    makeButterfly(0xff9a3c, new THREE.Vector3(-2.2, 0, 3.2), 0),
    makeButterfly(0xffffff, new THREE.Vector3(8.8, 0, 0.4), 2.4),
    makeButterfly(0x63b3e8, new THREE.Vector3(-5.4, 0, 2.6), 4.8),
  ];
  for (const b of butterflies) group.add(b.group);

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
  pier.position.set(-9.5, 0.12, 13.0); // straight out to sea (+z)
  group.add(pier);
  // The pier deck is WALKABLE: raycast plane + raised walk zone (bounds-exempt)
  const pierDeck = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 5.7),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  pierDeck.rotation.x = -Math.PI / 2;
  pierDeck.position.set(-9.5, 0.165, 15.75);
  group.add(pierDeck);
  const pierZone = { minX: -10.35, maxX: -8.65, minZ: 12.9, maxZ: 18.6, y: 0.165 };
  // Approach strip: bounds-exempt but ground-level, overlapping the island
  // circle edge so the pier is reachable.
  const pierApproach = { minX: -10.35, maxX: -8.65, minZ: 10.9, maxZ: 13.0, y: 0 };

  const seaplane = makeSeaplane();
  seaplane.position.set(-6.9, -0.82, 17.8);
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
      position: new THREE.Vector3(2.9, 0, -1.1),
      markerY: 2.4,
      radius: 2.2,
    },
    {
      id: 'projects',
      label: locations.projects.name,
      hint: locations.projects.hint,
      enterTo: 'museum',
      position: new THREE.Vector3(4.8, 0, -7.4),
      markerY: 2.4,
      radius: 2.2,
    },
    {
      id: 'contact',
      label: locations.contact.name,
      hint: locations.contact.hint,
      route: locations.contact.route,
      position: new THREE.Vector3(0.4, 0, 3.6),
      markerY: 2.9,
      radius: 2.1,
    },
    {
      id: 'airport',
      label: 'Seaplane Dock',
      hint: 'Fly to another island',
      airport: true,
      position: new THREE.Vector3(-9.5, 0, 17.6), // pier end, next to the plane
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
    butterflies,
    gulls,
    seaplane,
    extraWalkSurfaces: [pierDeck],
    walkZones: [pierZone, pierApproach],
  };
}
