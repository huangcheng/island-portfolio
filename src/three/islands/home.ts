import * as THREE from 'three';
import { locations } from '../../content';
import type { IslandTheme } from '../theme';
import type { IslandBuild, InteractPoint, Collider, Butterfly } from '../kit/types';
import { mulberry32, std } from '../kit/core';
import { buildBase } from '../kit/base';
import {
  makeHardwoodTree,
  makePalm,
  makeCedar,
  makeBush,
  makeFlowerCluster,
  makeTulipCluster,
  makeMushroom,
  makeWeedTuft,
  makeClover,
  makeGrassTuft,
  makeShell,
  makeStarfish,
  makeDriftwood,
  makeBoulder,
  makePebble,
  makeHyacinth,
  TULIP_RED,
  TULIP_YELLOW,
  TULIP_WHITE,
} from '../kit/flora';
import { makeCloud, makeButterfly, makeGull } from '../kit/critters';
import {
  makePier,
  makeSeaplane,
  makeCampfire,
  makeLogBench,
  makeTikiTorch,
  makeHammock,
  makeBirdbath,
  makePicketFence,
  makeBeachTowel,
  placePath,
} from '../kit/props';
import { setBuildingTheme, makeHouse, makeMuseum, makeNoticeBoard, makeSign, makeLamp } from '../kit/buildings';

export const theme: IslandTheme = {
  outline: { f1: 5, p1: 0.7, f2: 9, p2: 2.1 },
  turf: {
    base: '#7ec850',
    shades: ['#6cb83f', '#5fa835', '#74c045', '#69bf40'],
    dark: 0x6cb83f,
  },
  sand: { base: '#f7e6ad', wet: 0xe6cf8e },
  path: { center: 0xece0b0, rim: 0xcdb884 },
  sky: {
    night:  { horizon: 0x1a2c47, mid: 0x101f38, zenith: 0x0a1526, fog: 0x1a2c47 },
    dawn:   { horizon: 0xffc98a, mid: 0x9fb8e0, zenith: 0x5f9fd8, fog: 0xffd9a8 },
    day:    { horizon: 0xffe9c9, mid: 0xa8dcf0, zenith: 0x6ec3f0, fog: 0xdfe8e6 },
    sunset: { horizon: 0xffb36b, mid: 0xe8a0b8, zenith: 0x8a70b8, fog: 0xe8a878 },
    dusk:   { horizon: 0x9a6a9a, mid: 0x54487e, zenith: 0x22305c, fog: 0x7a5f7e },
  },
  particles: { palette: [0xff9ec4, 0xffd98a, 0xfff3c0, 0xffb380, 0xc9a3ff, 0xffffff], count: 34 },
  ui: {},
  buildings: {
    roof: 0xe2574c,
    door: 0x7a5326,
    doorDark: 0x5a3f22,
    doorHi: 0x9c6f3a,
    museumRoof: 0x4f86c6,
    museumRoofLight: 0x6fa0d8,
    museumRoofDeep: 0x2f527f,
    museumWall: 0xffeed0,
  },
  interior: { houseWall: '#e8f2dc', rugRing: 0xe2574c, rugCenter: 0xfff2d0, museumBg: 0xf2ead8 },
};

export function build(): IslandBuild {
  setBuildingTheme(theme.buildings);
  const group = new THREE.Group();
  const colliders: Collider[] = [];
  const clouds: THREE.Group[] = [];
  const rng = mulberry32(424242);

  // ── Base world (terrain/sand/cliff/sea/foam/waves + tonal patches) ────────
  const base = buildBase(theme, rng);
  group.add(base.group);
  const { walkSurface, sea, foam, waves } = base;

  // ── Plaza + organic winding paths ─────────────────────────────────────────
  const plazaRim = new THREE.Mesh(new THREE.CircleGeometry(2.3, 48), std(theme.path.rim));
  plazaRim.rotation.x = -Math.PI / 2;
  plazaRim.position.set(0, 0.03, 0.5);
  plazaRim.receiveShadow = true;
  const plazaCtr = new THREE.Mesh(new THREE.CircleGeometry(2.0, 48), std(theme.path.center));
  plazaCtr.rotation.x = -Math.PI / 2;
  plazaCtr.position.set(0, 0.045, 0.5);
  plazaCtr.receiveShadow = true;
  group.add(plazaRim, plazaCtr);

  const plaza: [number, number] = [0, 0.5];
  placePath(group, plaza, [-5.4, -2.4], rng, theme.path.center, theme.path.rim); // to house
  placePath(group, plaza, [5.4, -2.7], rng, theme.path.center, theme.path.rim); // to museum
  placePath(group, plaza, [5.3, 3.4], rng, theme.path.center, theme.path.rim); // to notice board

  // ── Buildings (footprints/rotations are contract-fixed) ───────────────────
  const house = makeHouse();
  house.position.set(-6.5, 0, -4.6);
  house.rotation.y = Math.atan2(6.5, 5.1);
  group.add(house);
  colliders.push({ x: -6.5, z: -4.6, r: 3.0 });

  const houseSign = makeSign('Home');
  houseSign.position.set(-5.3, 0, -1.6); // flanks the door approach (never blocks it)
  houseSign.rotation.y = Math.atan2(5.3, 2.1);
  group.add(houseSign);
  colliders.push({ x: -5.3, z: -1.6, r: 0.5 });

  const museum = makeMuseum();
  museum.position.set(6.6, 0, -5.2);
  museum.rotation.y = Math.atan2(-6.6, 5.7);
  group.add(museum);
  colliders.push({ x: 6.6, z: -5.2, r: 3.6 });

  const museumSign = makeSign(locations.projects.name);
  museumSign.position.set(5.6, 0, -1.2); // flanks the door approach
  museumSign.rotation.y = Math.atan2(-5.6, 1.7);
  group.add(museumSign);
  colliders.push({ x: 5.6, z: -1.2, r: 0.5 });

  const board = makeNoticeBoard();
  board.position.set(6.2, 0, 5.2);
  board.rotation.y = Math.atan2(-6.2, -5.2);
  group.add(board);
  colliders.push({ x: 6.2, z: 5.2, r: 1.35 });

  for (const [lx, lz] of [
    [-2.8, -2.6],
    [3.1, 1.6],
  ]) {
    const lamp = makeLamp();
    lamp.position.set(lx, 0, lz);
    group.add(lamp);
    colliders.push({ x: lx, z: lz, r: 0.32 });
  }

  // ── Trees ─────────────────────────────────────────────────────────────────
  const cedarConeGeo = new THREE.ConeGeometry(1, 1, 12);
  const hardwood: [number, number, number | undefined][] = [
    [-11.0, -1.5, 0xff8c42], // orange
    [-10.0, 4.5, 0xff8fa3], // peach
    [-6.0, 9.7, undefined],
    [0.5, 11.5, 0xff8c42],
    [6.5, 9.6, undefined],
    [11.2, 5.5, 0xff8fa3],
    [12.2, -1.5, 0xff8c42],
    [8.5, -9.6, undefined],
    [-3.5, -10.6, 0xff8fa3],
  ];
  for (const [tx, tz, fruit] of hardwood) {
    const { tree, collider } = makeHardwoodTree(rng, tx, tz, fruit !== undefined ? { fruit } : {});
    group.add(tree);
    colliders.push(collider);
  }
  const cedars: [number, number][] = [
    [-9.6, 7.6],
    [10.2, 8.2],
    [-12.2, 2.6],
  ];
  for (const [cx, cz] of cedars) {
    const { tree, collider } = makeCedar(rng, cx, cz, cedarConeGeo);
    group.add(tree);
    colliders.push(collider);
  }

  // ── Palm trees on the beach sand ring ─────────────────────────────────────
  const palms: [number, number][] = [
    [-13.5, 7.5],
    [13.0, -10.5],
  ];
  for (const [px, pz] of palms) {
    const { palm, collider } = makePalm(rng, px, pz);
    group.add(palm);
    colliders.push(collider);
  }

  // ── Bushes near building edges / clearings ────────────────────────────────
  const bushes: [number, number][] = [
    [-9.0, -4.2],
    [-4.2, -7.6],
    [3.6, -7.2],
    [9.2, -1.0],
    [-8.6, 5.2],
    [4.2, 8.6],
  ];
  for (const [bx, bz] of bushes) {
    const { bush, collider } = makeBush(bx, bz, rng);
    group.add(bush);
    colliders.push(collider);
  }

  // ── Flowers in clusters (multiple colours) ────────────────────────────────
  const flowerPalette: Record<string, number[]> = {
    pink: [0xff7fa8, 0xffaac6],
    yellow: [0xffd94d, 0xfff0a0],
    white: [0xfff6e0, 0xffffff],
    orange: [0xff9a5c, 0xffb88a],
    purple: [0xc58cff, 0xdcb3ff],
    red: [0xff5a5a, 0xff8a8a],
  };
  const flowerSpots: [number, number, string][] = [
    [-3.6, 3.2, 'pink'],
    [3.4, 3.6, 'yellow'],
    [-6.2, 0.8, 'white'],
    [5.2, 0.2, 'purple'],
    [-7.6, -7.2, 'orange'],
    [8.2, 3.6, 'red'],
    [2.0, 6.8, 'pink'],
    [-1.0, -3.8, 'yellow'],
  ];
  for (const [fx, fz, name] of flowerSpots) {
    group.add(makeFlowerCluster(fx, fz, flowerPalette[name], rng));
  }

  // ── Tulip clusters (cup-shaped AC blooms) ─────────────────────────────────
  const tulipSpots: [number, number, number[]][] = [
    [-5.5, 5.5, [TULIP_RED, TULIP_YELLOW]],
    [8.5, 2.5, [TULIP_YELLOW, TULIP_WHITE]],
    [-2.5, -6.5, [TULIP_RED, TULIP_WHITE, TULIP_YELLOW]],
  ];
  for (const [tx, tz, cols] of tulipSpots) {
    group.add(makeTulipCluster(tx, tz, cols, rng));
  }

  // ── Mushrooms / weeds / clover / grass tufts: ground interest ─────────────
  const mushrooms: [number, number, boolean][] = [
    [-4.6, 5.6, true],
    [6.6, -1.2, false],
    [-8.2, 2.2, false],
    [2.2, 6.6, true],
  ];
  for (const [mx, mz, red] of mushrooms) group.add(makeMushroom(mx, mz, red, rng));

  const weedSpots: [number, number][] = [
    [-2.0, 6.2],
    [4.4, -3.2],
    [-5.0, -2.2],
    [7.0, 1.2],
    [-9.2, -1.2],
  ];
  for (const [wx, wz] of weedSpots) group.add(makeWeedTuft(wx, wz, rng));

  const cloverSpots: [number, number][] = [
    [1.2, 4.4],
    [-1.6, -1.2],
    [3.0, 1.6],
    [-3.2, 6.6],
  ];
  for (const [cx, cz] of cloverSpots) group.add(makeClover(cx, cz, rng));

  // scatter grass tufts with rejection against plaza + buildings
  const buildingFootprints: [number, number, number][] = [
    [-6.5, -4.6, 3.0],
    [6.6, -5.2, 3.6],
    [6.2, 5.2, 1.35],
  ];
  let placed = 0;
  let guard = 0;
  while (placed < 16 && guard < 200) {
    guard++;
    const x = (rng() - 0.5) * 28;
    const z = (rng() - 0.5) * 28;
    if (Math.hypot(x, z) > 14.5) continue;
    if (Math.hypot(x, z - 0) < 2.5 && Math.hypot(x, z - 0.5) < 2.8) continue;
    let ok = true;
    for (const [bx, bz, br] of buildingFootprints) {
      if (Math.hypot(x - bx, z - bz) < br + 0.4) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    group.add(makeGrassTuft(x, z, rng));
    placed++;
  }

  // ── Beach props on the sand ring ──────────────────────────────────────────
  const shells: [number, number][] = [
    [16.0, 5.5],
    [-14.5, 7.0],
    [5.5, -15.2],
  ];
  for (const [sx, sz] of shells) group.add(makeShell(sx, sz, rng));
  group.add(makeStarfish(-6.0, -15.6));
  const { log, collider: logCol } = makeDriftwood(12.6, -9.6, rng);
  group.add(log);
  colliders.push(logCol);

  // ── Rocks ─────────────────────────────────────────────────────────────────
  const boulders: [number, number, number][] = [
    [-12.5, -4.0, 0.55],
    [11.6, -4.6, 0.5],
    [-3.0, -12.6, 0.48],
    [-10.6, -7.6, 0.42],
  ];
  for (const [bx, bz, bs] of boulders) {
    const { rock, collider } = makeBoulder(bx, bz, bs, rng);
    group.add(rock);
    colliders.push(collider);
  }
  // pebbles around boulders + on the beach
  for (let i = 0; i < 10; i++) {
    const near = boulders[(rng() * boulders.length) | 0];
    const px = near[0] + (rng() - 0.5) * 1.8;
    const pz = near[1] + (rng() - 0.5) * 1.8;
    if (Math.hypot(px, pz) < 14.8) group.add(makePebble(px, pz, rng));
  }
  for (let i = 0; i < 6; i++) {
    const ang = rng() * Math.PI * 2;
    const pr = 16.2 + rng() * 1.0;
    group.add(makePebble(Math.cos(ang) * pr, Math.sin(ang) * pr, rng));
  }

  // ── Cozy corner: campfire + bench + torch, hammock, birdbath, fence ──────
  const flames: THREE.Mesh[] = [];
  const campfire = makeCampfire();
  campfire.g.position.set(-7.4, 0, 8.9);
  group.add(campfire.g);
  flames.push(...campfire.flames);
  colliders.push({ x: -7.4, z: 8.9, r: 0.85 });

  const bench = makeLogBench();
  bench.position.set(-8.6, 0, 7.8);
  bench.rotation.y = Math.atan2(-7.4 - -8.6, 8.9 - 7.8) + Math.PI / 2;
  group.add(bench);
  colliders.push({ x: -8.6, z: 7.8, r: 0.7 });

  const torch = makeTikiTorch();
  torch.g.position.set(-5.9, 0, 9.9);
  group.add(torch.g);
  flames.push(torch.flame);
  colliders.push({ x: -5.9, z: 9.9, r: 0.28 });

  const hammock = makeHammock();
  hammock.position.set(5.4, -0.04, 15.1);
  hammock.rotation.y = 1.15; // sheet length runs along the shoreline
  group.add(hammock);
  // Colliders follow the rotated beam: centre + both posts
  colliders.push(
    { x: 5.4, z: 15.1, r: 0.6 },
    { x: 6.31, z: 15.51, r: 0.38 },
    { x: 4.49, z: 14.69, r: 0.38 },
  );

  const birdbath = makeBirdbath();
  birdbath.position.set(-3.6, 0, 4.6);
  group.add(birdbath);
  colliders.push({ x: -3.6, z: 4.6, r: 0.45 });

  group.add(makePicketFence(-9.9, -6.4, 7));
  // Colliders along the whole fence run (7 pickets × 0.42 from z=-6.4)
  colliders.push(
    { x: -9.9, z: -6.3, r: 0.42 },
    { x: -9.9, z: -5.15, r: 0.42 },
    { x: -9.9, z: -4.0, r: 0.42 },
  );

  const towel = makeBeachTowel();
  towel.position.set(1.6, 0.0, 15.9);
  towel.rotation.y = 0.35;
  group.add(towel);

  group.add(makeHyacinth(-5.4, 2.6, 0xe87fa0, rng));
  group.add(makeHyacinth(7.6, -0.8, 0x7f9fe8, rng));
  group.add(makeHyacinth(1.8, 7.8, 0xffffff, rng));

  // ── Butterflies fluttering over the flower beds ──────────────────────────
  const butterflies: Butterfly[] = [
    makeButterfly(0xff9a3c, new THREE.Vector3(-2.2, 0, 3.2), 0),
    makeButterfly(0xffffff, new THREE.Vector3(8.8, 0, 0.4), 2.4),
    makeButterfly(0x63b3e8, new THREE.Vector3(-5.4, 0, 2.6), 4.8),
  ];
  for (const b of butterflies) group.add(b.group);

  // ── Clouds ─────────────────────────────────────────────────────────────────
  for (let i = 0; i < 5; i++) {
    const c = makeCloud(i * 3 + 1);
    const angle = (i / 5) * Math.PI * 2;
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
    [25, 7.5, 0.016, 4.0],
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
  pier.position.set(10.6, 0.12, 14.4); // straight out to sea (+z)
  group.add(pier);
  // The pier deck is WALKABLE: raycast plane + raised walk zone (bounds-exempt)
  const pierDeck = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 5.7),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  pierDeck.rotation.x = -Math.PI / 2;
  pierDeck.position.set(10.6, 0.165, 17.15);
  group.add(pierDeck);
  const pierZone = { minX: 9.75, maxX: 11.45, minZ: 14.3, maxZ: 20.0, y: 0.165 };
  // Approach strip: bounds-exempt but ground-level, overlapping the r16.8
  // circle edge (at x≈10.6 the circle ends at z≈13.05) so the pier is reachable.
  const pierApproach = { minX: 9.75, maxX: 11.45, minZ: 12.6, maxZ: 14.4, y: 0 };

  const seaplane = makeSeaplane();
  seaplane.position.set(13.2, -0.82, 19.4);
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
      position: new THREE.Vector3(-3.63, 0, -2.35),
      markerY: 2.4,
      radius: 2.2,
    },
    {
      id: 'projects',
      label: locations.projects.name,
      hint: locations.projects.hint,
      enterTo: 'museum',
      position: new THREE.Vector3(3.49, 0, -2.53),
      markerY: 2.4,
      radius: 2.2,
    },
    {
      id: 'contact',
      label: locations.contact.name,
      hint: locations.contact.hint,
      route: locations.contact.route,
      position: new THREE.Vector3(5.4, 0, 3.6),
      markerY: 2.9,
      radius: 2.1,
    },
    {
      id: 'airport',
      label: 'Seaplane Dock',
      hint: 'Fly to another island',
      airport: true,
      position: new THREE.Vector3(10.6, 0, 19.2), // pier end, next to the plane
      markerY: 1.4,
      radius: 1.9,
    },
  ];

  return { group, walkSurface, colliders, points, clouds, foam, flames, waves, sea, butterflies, gulls, seaplane, extraWalkSurfaces: [pierDeck], walkZones: [pierZone, pierApproach] };
}
