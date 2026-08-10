# Per-Island Designs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every island in the federation its own terrain, flora, palette, UI skin, day/night mood, and content — spec: `docs/superpowers/specs/2026-08-10-per-island-designs-design.md`.

**Architecture:** Shared kit (`src/three/kit/`) extracted from `island.ts`/`buildings.ts`, parameterized by an `IslandTheme`. Fully separate per-island scene modules in `src/three/islands/` each exporting `{ theme, build(): IslandBuild }`; `engine.ts` dispatches via a static map keyed on `SITE.id`. Content moves to `src/content/<island>.ts` behind an index that picks via `SITE.id`.

**Tech Stack:** Vite 8, React 19, TS strict, three.js 0.185, troika-three-text 0.52, Playwright e2e (`scripts/verify.mjs`).

**Testing note:** this repo has no unit-test runner. The regression suite is `pnpm verify` (= `tsc --noEmit && vite build` + Playwright e2e, zero-console-error + interaction checks, screenshots in `test-shots/`). Every task ends with `pnpm build` (or `pnpm verify` where scene behavior changes) green. That is the TDD "test" here — run it BEFORE the task where useful to establish the green baseline, and after to prove no regression.

**Hard gotchas (from AGENTS.md — do not break):**
1. troika needs TTF fonts, not woff2.
2. `src/types/troika-three-text.d.ts` is required.
3. Baloo 2 has NO Chinese/emoji glyphs — 3D text may only use Latin/digits (so the Bitgrove tablet reads `01`, never 零壹; Chinese appears only in HTML `<head>` meta).
4. Click priority: `Controls.pickUi` raycasts 3D UI first.
5. Dispose dialog content on route change (`clearDialog`).
6. Camera-anchored UI: `depthTest:false`, renderOrder 900 root.
7. Keep `window.__engine` in App.tsx.
8. Door interact points must sit OUTSIDE building colliders (+ body radius 0.42).

---

## File structure

**Create:**
- `src/content/types.ts` — `Exhibit`, `IslandContent` contracts
- `src/content/{home,maplebury,petalbrook,bitgrove,noveo}.ts` — per-island content
- `src/content/index.ts` — dispatch by `SITE.id` (replaces `src/content.ts`)
- `src/three/theme.ts` — `IslandTheme`, `SkyPalette` interfaces
- `src/three/kit/core.ts` — std/shadowed/mulberry32/shared geometries (moved)
- `src/three/kit/textures.ts` — grass/dirt/sand/striped/chevron textures (parameterized)
- `src/three/kit/base.ts` — terrain + sand + cliffs + sea + foam + waves + walkSurface
- `src/three/kit/flora.ts` — trees/bushes/flowers/etc. (parameterized)
- `src/three/kit/critters.ts` — clouds/butterflies/gulls (moved)
- `src/three/kit/props.ts` — pier/seaplane/campfire/bench/torch/hammock/birdbath/fence/towel + NEW lantern/tablet/bamboo/cone/scaffold
- `src/three/kit/buildings.ts` — moved `buildings.ts`, themeable via `setBuildingTheme`
- `src/three/kit/types.ts` — `Collider`, `InteractPoint`, `IslandBuild`, `Butterfly` (moved from island.ts)
- `src/three/islands/{home,maplebury,petalbrook,bitgrove,noveo}.ts` — scene modules
- `src/three/islands/index.ts` — static module map + `ACTIVE`

**Modify:** `src/three/engine.ts` (dispatch, day/night, particles, flyby tint), `src/three/uiKit.ts` (`setUiTheme`), `src/three/uiPanels.ts` (exhibits, TITLES from locations, flight-board chips), `src/three/interiors.ts` (tints, exhibit-count frames, generic art), `src/site.ts` (slim + names + chip), `scripts/verify.mjs` (site arg, dynamic points, per-site screenshots), `package.json` (verify scripts), `AGENTS.md` (architecture), `index.html` is untouched.

**Delete:** `src/content.ts`, `src/three/island.ts`, `src/three/buildings.ts` (all absorbed).

---

### Task 1: Content layer (per-island content behind `src/content/`)

**Files:**
- Create: `src/content/types.ts`
- Create: `src/content/home.ts`, `src/content/maplebury.ts`, `src/content/petalbrook.ts`, `src/content/bitgrove.ts`, `src/content/noveo.ts`
- Create: `src/content/index.ts`
- Delete: `src/content.ts`
- Modify: `src/three/uiPanels.ts`, `src/three/island.ts`, `src/three/interiors.ts` (imports only for now)

- [ ] **Step 1: Establish green baseline**

Run: `pnpm verify`
Expected: build succeeds, all e2e checks pass (exit 0). If anything is red before changes, STOP and report.

- [ ] **Step 2: Write `src/content/types.ts`**

```ts
/** Per-island content contract — one module per island implements this. */

export interface Exhibit {
  title: string;
  /** One or two sentences shown on the museum placard. */
  summary: string;
  /** Where the "Open"/"GitHub" button goes. */
  url: string;
  kind: 'project' | 'post' | 'note' | 'log';
  /** Optional extras, shown only when present. */
  date?: string;
  stars?: number;
  stack?: string[];
  /** Custom museum art key (home island's hand-drawn pieces). */
  art?: 'seelie' | 'bridge' | 'solar';
}

export interface IslandContent {
  profile: {
    name: string;
    role: string;
    /** Villager greeting in the About dialog. */
    greeting: string;
    blog: { label: string; url: string };
    github: { label: string; url: string };
    email: { label: string; url: string };
  };
  /** Museum exhibits — interior shows at most 5 frames. */
  exhibits: Exhibit[];
  /** Subtitle line under the museum dialog title. */
  exhibitsSubtitle: string;
  /** Island locations and which route they open. */
  locations: {
    about: { name: string; route: '/about'; hint: string };
    projects: { name: string; route: '/projects'; hint: string };
    contact: { name: string; route: '/contact'; hint: string };
  };
}
```

- [ ] **Step 3: Write `src/content/home.ts`** (today's content, verbatim values)

```ts
import type { IslandContent } from './types';

const content: IslandContent = {
  profile: {
    name: 'HUANG Cheng',
    role: 'Software Engineer',
    greeting:
      "Hi there! I'm Cheng — I build things with TypeScript, Rust, C++ and Python. " +
      'I like desktop pets, AI agents, note-taking tools and little widgets that make computers feel alive. ' +
      'Welcome to my island!',
    blog: { label: 'cheng.im', url: 'https://cheng.im' },
    github: { label: 'github.com/huangcheng', url: 'https://github.com/huangcheng' },
    email: { label: 'cheng@wuhan.dev', url: 'mailto:cheng@wuhan.dev' },
  },
  exhibits: [
    {
      title: 'Seelie',
      summary:
        'Native Qt6/C++ desktop pet that reacts to AI coding tool events (Claude Code, Codex, OpenCode).',
      url: 'https://github.com/huangcheng/Seelie',
      kind: 'project',
      stars: 1,
      stack: ['C++', 'Qt6'],
      art: 'seelie',
    },
    {
      title: 'Obsidian Notes Bridge',
      summary:
        'Obsidian plugin that exports notes as portable Markdown and bridges your vault with Bear, WPS Cloud Note, Youdao Note, flomo, Yinxiang, WeKnora and IMA.',
      url: 'https://github.com/huangcheng/obsidian-notes-bridge',
      kind: 'project',
      stars: 1,
      stack: ['TypeScript', 'Obsidian'],
      art: 'bridge',
    },
    {
      title: 'Solar System',
      summary:
        'Tiny desktop Earth globe widget for Windows — real-time day/night, flat-map mode, and a growing solar-system view.',
      url: 'https://github.com/huangcheng/solar-system',
      kind: 'project',
      stars: 0,
      stack: ['C++', 'Qt6'],
      art: 'solar',
    },
  ],
  exhibitsSubtitle: 'github.com/huangcheng',
  locations: {
    about: { name: 'My House', route: '/about', hint: 'Enter my house' },
    projects: { name: 'Museum', route: '/projects', hint: 'Explore the museum' },
    contact: { name: 'Notice Board', route: '/contact', hint: 'Read the notice board' },
  },
};

export default content;
```

- [ ] **Step 4: Write the four placeholder content modules**

`src/content/maplebury.ts`:

```ts
import type { IslandContent } from './types';

// PLACEHOLDER exhibits — replace with real posts from cheng.sh.
const content: IslandContent = {
  profile: {
    name: 'HUANG Cheng',
    role: 'Software Engineer',
    greeting:
      'Welcome to Maplebury! This is where my longer writing lives — posts, articles and travelogues. ' +
      'Take your time, browse around, and say hi from the notice board.',
    blog: { label: 'cheng.sh', url: 'https://cheng.sh' },
    github: { label: 'github.com/huangcheng', url: 'https://github.com/huangcheng' },
    email: { label: 'cheng@wuhan.dev', url: 'mailto:cheng@wuhan.dev' },
  },
  exhibits: [
    {
      title: 'Placeholder Post One',
      summary: 'TODO: replace with a real post from cheng.sh — title, two-sentence summary, and link.',
      url: 'https://cheng.sh',
      kind: 'post',
      date: '2026-01-01',
    },
    {
      title: 'Placeholder Post Two',
      summary: 'TODO: replace with a real post from cheng.sh — title, two-sentence summary, and link.',
      url: 'https://cheng.sh',
      kind: 'post',
      date: '2026-01-01',
    },
    {
      title: 'Placeholder Post Three',
      summary: 'TODO: replace with a real post from cheng.sh — title, two-sentence summary, and link.',
      url: 'https://cheng.sh',
      kind: 'post',
      date: '2026-01-01',
    },
  ],
  exhibitsSubtitle: 'long-form writing',
  locations: {
    about: { name: 'My House', route: '/about', hint: 'Enter my house' },
    projects: { name: 'The Reading Room', route: '/projects', hint: 'Browse the reading room' },
    contact: { name: 'Notice Board', route: '/contact', hint: 'Read the notice board' },
  },
};

export default content;
```

`src/content/petalbrook.ts` — same shape; greeting `'Welcome to Petalbrook! Short notes, fragments and essays — a public notebook of sorts. Wander the gallery, or fly onward to another island.'`; blog `{ label: 'misthois.cn', url: 'https://misthois.cn' }`; 3 exhibits kind `'note'`, titles `Placeholder Note One/Two/Three`, summary `TODO: replace with a real note from misthois.cn.`, url `https://misthois.cn`; exhibitsSubtitle `'notes & fragments'`; projects location `{ name: 'The Gallery', route: '/projects', hint: 'Browse the gallery' }`.

`src/content/bitgrove.ts` — greeting `'Welcome to Bitgrove (ZeroOne Island)! Learning records and project logs — little by little, everything adds up.'`; blog `{ label: 'kleos.cn', url: 'https://kleos.cn' }`; 3 exhibits kind `'log'`, titles `Placeholder Log One/Two/Three`, summary `TODO: replace with a real learning record from kleos.cn.`, url `https://kleos.cn`; exhibitsSubtitle `'learning records'`; projects location `{ name: 'The Archive', route: '/projects', hint: 'Browse the archive' }`.

`src/content/noveo.ts` — greeting `'This island is still being built. Check back later!'`; blog `{ label: 'noveo.cn', url: 'https://noveo.cn' }`; 3 exhibits kind `'note'`, titles `Coming Soon`, summary `This exhibit is still under construction.`, url `https://noveo.cn`; exhibitsSubtitle `'under construction'`; locations all default names/hints.

- [ ] **Step 5: Write `src/content/index.ts` and delete `src/content.ts`**

```ts
import { SITE } from '../site';
import type { IslandContent } from './types';
import home from './home';
import maplebury from './maplebury';
import petalbrook from './petalbrook';
import bitgrove from './bitgrove';
import noveo from './noveo';

const ALL: Record<string, IslandContent> = { home, maplebury, petalbrook, bitgrove, noveo };
// Legacy island ids -> content modules (site.ts ids predate the rename).
const BY_SITE: Record<string, IslandContent> = {
  chengim: home,
  chengsh: maplebury,
  misthois: petalbrook,
  kleos: bitgrove,
  noveo,
};

const content = BY_SITE[SITE.id] ?? ALL.home;

export const profile = content.profile;
export const exhibits = content.exhibits;
export const exhibitsSubtitle = content.exhibitsSubtitle;
export const locations = content.locations;
export type { Exhibit } from './types';
```

Delete `src/content.ts` (git rm). Note: `Exhibit` replaces the old `Project` type everywhere (`repo`→`url`, `tagline`→`summary`).

- [ ] **Step 6: Update `src/three/island.ts` imports**

Line 2 currently: `import { locations, type Project } from '../content';`
Replace with: `import { locations, type Exhibit } from '../content';`
In `InteractPoint` (line ~22): `exhibit?: Project;` → `exhibit?: Exhibit;`

- [ ] **Step 7: Update `src/three/uiPanels.ts` to exhibits**

Line 4: `import { profile, projects, type Project } from '../content';`
→ `import { profile, exhibits, exhibitsSubtitle, locations, type Exhibit } from '../content';`

`TITLES` (lines 48–53) becomes:
```ts
const TITLES: Record<string, string> = {
  '/': SITE.name,
  '/about': locations.about.name,
  '/projects': locations.projects.name,
  '/contact': locations.contact.name,
};
```

`buildAbout` line ~490: `SITE.greeting` → `profile.greeting`.

`showExhibit(p: Project)` → `showExhibit(p: Exhibit)`; inside: `p.tagline` → `p.summary`, `p.repo` → `p.url`. Star pill: wrap in `if (p.stars !== undefined) { ... }`. Stack chips: wrap in `if (p.stack) { ... }`. Button label: `p.kind === 'project' ? 'GitHub' : 'Read'`. When `p.date`, add a small date label under the title (same style as the tagline label, `size 0.085`, color `C.body`, y offset between title and summary).

`buildProjects(W)`: rename to `buildExhibits(W)` (update the dispatcher in `showRoute`); `projects.length` → `exhibits.length`; iterate `exhibits`; subtitle `profile.github.label` (line ~539) → `exhibitsSubtitle`; card click opens `e.url`; star pill on cards only when `e.stars !== undefined` (placeholders have none — render a small kind chip instead: `makeLabel(e.kind, { size: 0.08, color: C.body })`).

- [ ] **Step 8: Update `src/three/interiors.ts` imports**

Line 11: `import { projects, type Project } from '../content';`
→ `import { exhibits, type Exhibit } from '../content';`
Museum exhibit points (lines ~721–730): `projects[i]` → `exhibits[i]` (frame-count generalization is Task 5 — keep `exhibits[i]` indexing for now, all islands ship 3).

- [ ] **Step 9: Typecheck + full verify**

Run: `pnpm verify`
Expected: PASS — this is a pure rename/restructure; home build must look and behave identically.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "refactor: per-island content layer (src/content/<island>.ts, projects -> exhibits)"
```

---

### Task 2: `setUiTheme` in uiKit

**Files:**
- Modify: `src/three/uiKit.ts:14-32`

- [ ] **Step 1: Make the palette settable**

Replace lines 14–32 with:

```ts
export interface UiPalette {
  paper: number; paperWarm: number; line: number; body: number; heading: number;
  teal: number; pink: number; pinkEdge: number; green: number; greenEdge: number;
  blue: number; blueEdge: number; orange: number; orangeEdge: number;
  gold: number; goldEdge: number; white: number;
}

/** Live UI palette — island modules re-skin it via setUiTheme before UI is built. */
export const C: UiPalette = {
  paper: 0xfffef7, paperWarm: 0xf7f3df, line: 0xd9cdb4, body: 0x725d42, heading: 0x794f27,
  teal: 0x19c8b9, pink: 0xf8a6b2, pinkEdge: 0xf07f96, green: 0x8ac68a, greenEdge: 0x6fb36f,
  blue: 0x889df0, blueEdge: 0x6b80d8, orange: 0xe59266, orangeEdge: 0xc97a4e,
  gold: 0xf7cd67, goldEdge: 0xe0b84e, white: 0xffffff,
};

const C_DEFAULTS: UiPalette = { ...C };

/** Apply an island's UI skin. Omit keys to keep defaults. Call BEFORE building UI. */
export function setUiTheme(overrides: Partial<UiPalette> = {}): void {
  Object.assign(C, C_DEFAULTS, overrides);
}
```

(Note: the original `C` object literal gains an explicit `UiPalette` shape — values unchanged.)

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (`C` consumers read at build time; mutation before construction is safe).

- [ ] **Step 3: Commit**

```bash
git add src/three/uiKit.ts && git commit -m "feat: setUiTheme — per-island UI palette hook"
```

---

### Task 3: Kit extraction + Home island module + engine dispatch

Big mechanical refactor. Home must come out pixel-identical — the e2e suite is the proof.

**Files:**
- Create: `src/three/theme.ts`, `src/three/kit/{types,core,textures,base,flora,critters,props,buildings}.ts`, `src/three/islands/{home.ts,index.ts}`
- Modify: `src/three/engine.ts`
- Modify: `src/site.ts` (slim `SisterIsland`, rename islands, add `chip`)
- Delete: `src/three/island.ts`, `src/three/buildings.ts`

- [ ] **Step 1: Write `src/three/theme.ts`**

```ts
import type { UiPalette } from './uiKit';

/** One sky state: the 3-stop gradient + fog the engine lerps between. */
export interface SkyState {
  horizon: number;
  mid: number;
  zenith: number;
  fog: number;
}

export interface IslandTheme {
  /** Terrain outline: r = 15 + sin(t*f1+p1)*0.3 + sin(t*f2+p2)*0.16 */
  outline: { f1: number; p1: number; f2: number; p2: number };
  turf: {
    /** Grass texture base + shade dabs (css hex strings for canvas). */
    base: string;
    shades: string[];
    /** Dark overlay + tonal patch color. */
    dark: number;
  };
  sand: { base: string; wet: number };
  path: { center: number; rim: number };
  sky: { night: SkyState; dawn: SkyState; day: SkyState; sunset: SkyState; dusk: SkyState };
  /** Ambient drifting particles (petals/leaves/dust). */
  particles: { palette: number[]; count: number };
  /** UI wood skin. */
  ui: Partial<UiPalette>;
  /** Building colors. */
  buildings: { roof: number; door: number; museumRoof: number; museumWall: number };
  /** Interior tints. */
  interior: { houseWall: string; rugRing: number; rugCenter: number; museumBg: number };
}
```

- [ ] **Step 2: Move types — `src/three/kit/types.ts`**

Move `Collider` (island.ts:5–9), `InteractPoint` (island.ts:11–28), `IslandBuild` (island.ts:30–54), `Butterfly` (island.ts:663–669) verbatim. `InteractPoint.exhibit` keeps the Task 1 `Exhibit` type (`import { type Exhibit } from '../../content'`). Add one optional field to `IslandBuild`:

```ts
  /** Groups the engine gently rocks (bamboo sway). phase in userData.phase. */
  sway?: THREE.Group[];
```

- [ ] **Step 3: Move helpers — `src/three/kit/core.ts`**

Move island.ts:76–115 verbatim: `std`, `shadowed`, `mulberry32`, and shared geometries `G_SPHERE, G_SPHERE_LO, G_ICO, G_STEM, G_BLADE, G_PALM_SEG, G_TULIP`. Export all.

- [ ] **Step 4: Move + parameterize textures — `src/three/kit/textures.ts`**

Move `makeGrassTexture` (118–158), `makeDirtTexture` (757–788), `makeSandTexture` (1190–1214), `makeStripedTexture` (884–896), `makeChevronTexture` (898–920). Signature changes:

```ts
export function makeGrassTexture(
  base = '#7ec850',
  shades = ['#6cb83f', '#5fa835', '#74c045', '#69bf40'],
): THREE.CanvasTexture { /* moved body; replace the hardcoded base/shades with the params */ }

export function makeSandTexture(base = '#f7e6ad'): THREE.CanvasTexture { /* moved body; base param */ }
```

`makeDirtTexture`, `makeStripedTexture`, `makeChevronTexture` moved unchanged (already parameterized).

- [ ] **Step 5: Parameterized base world — `src/three/kit/base.ts`**

Move buildIsland's base-world sections (island.ts:1301–1434 + 1366–1405 + sea material 1112–1187 + foam 1220–1240 + wave crest 1243–1254) into:

```ts
import * as THREE from 'three';
import type { IslandTheme } from '../theme';
import { mulberry32 } from './core';
import { makeGrassTexture, makeSandTexture, makeDirtTexture } from './textures';

export interface BaseBuild {
  group: THREE.Group;
  walkSurface: THREE.Mesh;
  sea: THREE.Mesh;
  foam: THREE.Mesh[];
  waves: THREE.Mesh[];
}

export function buildBase(theme: IslandTheme): BaseBuild {
  // Terrain grass: ShapeGeometry EDGE_N=128 with
  //   r = 15 + sin(t*theme.outline.f1 + theme.outline.p1)*0.3
  //          + sin(t*theme.outline.f2 + theme.outline.p2)*0.16   (y = 0.02)
  //   map = makeGrassTexture(theme.turf.base, theme.turf.shades)
  // Sand disc CircleGeometry(18, 96) y=-0.04 (makeSandTexture(theme.sand.base));
  //   wet ring RingGeometry(17.0, 17.85) color theme.sand.wet
  // 3 dirt cliff tiers (unchanged geometry/colors, island.ts:1330-1365)
  // Sea disc CircleGeometry(110, 96) y=-1.15 with moved makeSeaMaterial()
  // Shallow ring RingGeometry(18.8, 21.6) 0x9fe4f2 y=-1.13
  // Foam: waterline torus r=19.05 y=-1.12; makeFoamRibbon(19.55,0.3,5,0.32,0) y=-1.05 op .95;
  //       makeFoamRibbon(21.3,0.17,7,0.48,2.1) y=-1.08 op .4
  // 44 wave crests r = 21.5 + rng*36, y=-1.06 (rng = mulberry32(424242))
  // walkSurface CircleGeometry(17.6, 48) y=0.02 invisible
  // 3 tonal patches color theme.turf.dark op 0.25 at [-7.5,6.5,3.2] [9.0,4.5,2.6] [4.5,-8.5,3.6]
}
```

`makeSeaMaterial`, `makeFoamRibbon`, `makeWaveCrest` are exported from this file (moved verbatim; sea colors stay shared across islands).

- [ ] **Step 6: Move flora — `src/three/kit/flora.ts`**

Move island.ts:161–660 flora/prop makers: `makeHardwoodTree`, `makePalm`, `makeCedar`, `makeBush`, `makeFlower`, `makeFlowerCluster`, `makeTulip`, `makeTulipCluster`, `makeMushroom`, `makeWeedTuft`, `makeClover`, `makeGrassTuft`, `makeShell`, `makeStarfish`, `makeDriftwood`, `makeBoulder`, `makePebble`, `makeHyacinth`. Change ONE signature — `makeHardwoodTree` (161–241) becomes fully color-parameterized so maple/sakura/saplings reuse it:

```ts
export interface TreeLook {
  canopyDark?: number;   // default LEAF_DARK 0x4a9d3a
  canopyMid?: number;    // default LEAF_MID 0x5fb74a
  fruit?: number;        // fruit color; omit for none
  scale?: number;        // default 1 (saplings ~0.55)
}
export function makeHardwoodTree(
  rng: () => number, x: number, z: number, look: TreeLook = {},
): { group: THREE.Group; collider: { x: number; z: number; r: number } }
```

In the moved body: replace `LEAF_DARK`/`LEAF_MID` uses with `look.canopyDark ?? 0x4a9d3a` / `look.canopyMid ?? 0x5fb74a`; replace the fruit color pick (`0xff8fa3`/`0xff8c42`) with `look.fruit` (skip fruit spheres when undefined); apply `group.scale.setScalar(look.scale ?? 1)` and scale the returned collider radius (`0.62 * (look.scale ?? 1)`). All other functions moved verbatim (palette consts move with them; export the consts the island modules need: `TRUNK`, `TULIP_RED`, `TULIP_YELLOW`, `TULIP_WHITE`).

- [ ] **Step 7: Move critters — `src/three/kit/critters.ts`**

Move `makeCloud` (633–660), `makeWingGroup` + `makeButterfly` (672–722), `makeGull` (725–754) verbatim. Export.

- [ ] **Step 8: Move props — `src/three/kit/props.ts`**

Move `makePier` (793–818), `makeSeaplane` (821–880), `makeFlame` (922–935), `makeCampfire` (938–968), `makeLogBench` (971–984), `makeTikiTorch` (987–999), `makeHammock` (1002–1023), `makeBirdbath` (1026–1051), `makePicketFence` (1054–1073), `makeBeachTowel` (1076–1083) verbatim. Also `placePath` (1257–1292) — parameterize its two hardcoded colors:

```ts
export function placePath(
  group: THREE.Group, from: [number, number], to: [number, number],
  rng: () => number, center = 0xece0b0, rim = 0xcdb884,
): void
```

- [ ] **Step 9: Move buildings — `src/three/kit/buildings.ts`**

Move all of `buildings.ts` EXCEPT `addBuildings` (dissolved into island modules). Theming via module-level state (same pattern as `setUiTheme`):

```ts
export interface BuildingTheme { roof: number; door: number; museumRoof: number; museumWall: number; }

let ROOF = { base: 0xe2574c, light: 0, deep: 0, shade: 0 };
let DOOR = { dark: 0x5a3f22, mid: 0x7a5326, hi: 0x9c6f3a };
let MUSEUM = { roof: 0x4f86c6, roofLight: 0x6fa0d8, roofDeep: 0x2f527f, wall: 0xffeed0 };

export function setBuildingTheme(t: BuildingTheme): void {
  ROOF = { base: t.roof, light: shadeOf(t.roof, 1.12), deep: shadeOf(t.roof, 0.62), shade: shadeOf(t.roof, 0.74) };
  DOOR = { dark: shadeOf(t.door, 0.85), mid: t.door, hi: shadeOf(t.door, 1.28) };
  MUSEUM = {
    roof: t.museumRoof, roofLight: shadeOf(t.museumRoof, 1.32), roofDeep: shadeOf(t.museumRoof, 0.64),
    wall: t.museumWall,
  };
}
```

Mechanical edits in the moved file:
- Delete the `SITE` import (line 4) and the old `ROOF` initializer (15–20); keep `shadeOf` (7–12). Initialize the three `let`s via one internal `setBuildingTheme({ roof: 0xe2574c, door: 0x6b4f2a, museumRoof: 0x4f86c6, museumWall: 0xffeed0 })` call (home defaults = today's look).
- `roofShadeMat` (line 100): change from `const` to a getter-style factory `const roofShadeMat = () => std(ROOF.shade, 0.85)` and update its uses in `makeHouse` to call it (so theming applies at build time).
- In `doorCanvas` (204–274): replace every use of the door browns (`COL.doorDark` / `COL.doorMid` / `COL.doorHi` or literal `0x5a3f22`-family hexes — grep to find them) with `DOOR.dark` / `DOOR.mid` / `DOOR.hi`.
- Museum roof (line ~729): `shingleCanvas(COL.blue, 0x6fa0d8, COL.blueDeep)` → `shingleCanvas(MUSEUM.roof, MUSEUM.roofLight, MUSEUM.roofDeep)`.
- Museum walls inside `makeMuseum` (703–924): replace the cream wall material color (`COL.creamWall 0xffeed0`) with `MUSEUM.wall`. Only touch uses within `makeMuseum` — the house keeps `COL.creamWall`.
- Export `makeHouse`, `makeMuseum`, `makeNoticeBoard`, `makeSign`, `makeLamp`, `makeOwl` (plus existing helpers they need internally).

- [ ] **Step 10: Write `src/three/islands/home.ts`** — today's island, kit-composed

```ts
import * as THREE from 'three';
import type { IslandTheme } from '../theme';
import type { IslandBuild, InteractPoint, Collider, Butterfly } from '../kit/types';
import { mulberry32 } from '../kit/core';
import { buildBase } from '../kit/base';
import { placePath, makePier, makeSeaplane, makeCampfire, makeLogBench, makeTikiTorch,
  makeHammock, makeBirdbath, makePicketFence, makeBeachTowel } from '../kit/props';
import { makeHardwoodTree, makePalm, makeCedar, makeBush, makeFlowerCluster, makeTulipCluster,
  makeMushroom, makeWeedTuft, makeClover, makeGrassTuft, makeShell, makeStarfish,
  makeDriftwood, makeBoulder, makePebble, makeHyacinth, TULIP_RED, TULIP_YELLOW, TULIP_WHITE } from '../kit/flora';
import { makeCloud, makeButterfly, makeGull } from '../kit/critters';
import { setBuildingTheme, makeHouse, makeMuseum, makeNoticeBoard, makeSign, makeLamp } from '../kit/buildings';
import { locations, exhibits } from '../../content';

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
    night:  { horizon: 0x1a2c47, mid: 0x101f38, zenith: 0x0a1526, fog: 0x101f38 },
    dawn:   { horizon: 0xffc98a, mid: 0x9fb8e0, zenith: 0x5f9fd8, fog: 0xffd9a8 },
    day:    { horizon: 0xffe9c9, mid: 0xa8dcf0, zenith: 0x6ec3f0, fog: 0xdfe8e6 },
    sunset: { horizon: 0xffb36b, mid: 0xe8a0b8, zenith: 0x8a70b8, fog: 0xe8a878 },
    dusk:   { horizon: 0x9a6a9a, mid: 0x54487e, zenith: 0x22305c, fog: 0x7a5f7e },
  },
  particles: { palette: [0xff9ec4, 0xffd98a, 0xfff3c0, 0xffb380, 0xc9a3ff, 0xffffff], count: 34 },
  ui: {},
  buildings: { roof: 0xe2574c, door: 0x6b4f2a, museumRoof: 0x4f86c6, museumWall: 0xffeed0 },
  interior: { houseWall: '#e8f2dc', rugRing: 0xe2574c, rugCenter: 0xfff2d0, museumBg: 0xf2ead8 },
};

export function build(): IslandBuild {
  setBuildingTheme(theme.buildings);
  const rng = mulberry32(424242);
  const group = new THREE.Group();
  const colliders: Collider[] = [];
  const base = buildBase(theme);
  group.add(base.group);

  // Plaza + paths (island.ts:1437-1450 verbatim)
  // Buildings — today's exact footprints (old addBuildings, buildings.ts:1115-1154):
  //   house      (-6.5, 0, -4.6) rot atan2(6.5, 5.1)    collider {-6.5,-4.6,3.0}
  //   houseSign  'Home'  (-5.3, 0, -1.6) rot atan2(5.3, 2.1)  collider r0.5
  //   museum     (6.6, 0, -5.2)  rot atan2(-6.6, 5.7)   collider {6.6,-5.2,3.6}
  //   museumSign 'Museum' (5.6, 0, -1.2) rot atan2(-5.6, 1.7) collider r0.5
  //   board      (6.2, 0, 5.2)   rot atan2(-6.2, -5.2)  collider r1.35
  //   lamps      [-2.8,-2.6] [3.1,1.6]                  collider r0.32 each
  // Sign texts come from locations: locations.about.name is 'My House' but the
  //   little curb sign says 'Home' — keep 'Home'; museum sign = locations.projects.name.
  // Flora/props: island.ts:1459-1705 verbatim (trees 1459-1490, bushes 1498-1505,
  //   flowers 1513-1540, mushrooms/weeds/clovers/tufts 1546-1595, beach 1598-1620,
  //   cozy corner 1634-1685, butterflies 1688-1692, clouds 1696-1705, gulls 1709-1714)
  //   — hardwood calls become makeHardwoodTree(rng, x, z, { fruit: 0xff8c42 }) etc.
  // Pier block: island.ts:1727-1749 verbatim (pier, pierDeck, zones, seaplane).
  // InteractPoints: island.ts:1754-1791 verbatim (about/projects/contact/airport).
  // Return { group, walkSurface: base.walkSurface, colliders, points, clouds, foam: base.foam,
  //   flames, waves: base.waves, sea: base.sea, butterflies, gulls, seaplane,
  //   extraWalkSurfaces: [pierDeck], walkZones: [pierZone, pierApproach] }
}
```

The ported body must reproduce island.ts:1437–1793 exactly — only the imports change. (Full repetition omitted here only because it is a byte-for-byte move of code the engineer has open in `src/three/island.ts` before deletion; every line range is listed.)

- [ ] **Step 11: Write `src/three/islands/index.ts`**

```ts
import type { IslandTheme } from '../theme';
import type { IslandBuild } from '../kit/types';
import { SITE } from '../../site';
import * as home from './home';
import * as maplebury from './maplebury';
import * as petalbrook from './petalbrook';
import * as bitgrove from './bitgrove';
import * as noveo from './noveo';

export interface IslandModule { theme: IslandTheme; build: () => IslandBuild }

const BY_SITE: Record<string, IslandModule> = {
  chengim: home,
  chengsh: maplebury,
  misthois: petalbrook,
  kleos: bitgrove,
  noveo,
};

/** The island this build serves. */
export const ACTIVE: IslandModule = BY_SITE[SITE.id] ?? home;
```

(Until Tasks 6–9 land, stub the four non-home modules as `export { theme, build } from './home';` so the map typechecks — each island task replaces its stub.)

- [ ] **Step 12: Slim `src/site.ts`**

`SisterIsland` loses `roof`, `door`, `greeting` (greeting now lives in content), gains `chip` (flight-board palette chip + flyby tint). Rename islands per approved identities:

```ts
export interface SisterIsland {
  id: string;
  name: string;
  host: string;
  url: string;
  theme: string;
  nativeFruit: string;
  status: 'online' | 'delayed';
  /** Palette chip shown on the flight board + flyby tint. */
  chip: number;
}

export const ISLANDS: SisterIsland[] = [
  { id: 'chengim', name: 'Home Island', host: 'cheng.im', url: 'https://cheng.im',
    theme: 'Main island · portfolio', nativeFruit: '🍊', status: 'online', chip: 0x6ec3f0 },
  { id: 'chengsh', name: 'Maplebury', host: 'cheng.sh', url: 'https://cheng.sh',
    theme: 'Autumn · long-form writing', nativeFruit: '🍐', status: 'online', chip: 0xd97b2f },
  { id: 'misthois', name: 'Petalbrook', host: 'misthois.cn', url: 'https://misthois.cn',
    theme: 'Spring · notes & essays', nativeFruit: '🍎', status: 'online', chip: 0xf4a7c3 },
  { id: 'kleos', name: 'Bitgrove', host: 'kleos.cn', url: 'https://kleos.cn',
    theme: 'Zen · learning records', nativeFruit: '🍑', status: 'online', chip: 0x6fae7d },
  { id: 'noveo', name: 'Noveo Island', host: 'noveo.cn', url: 'https://noveo.cn',
    theme: 'Under construction', nativeFruit: '🍒', status: 'delayed', chip: 0x9a8fb8 },
];
```

(`SITE`/`DESTINATIONS` logic unchanged.)

- [ ] **Step 13: Rewire `engine.ts`**

- Line 2 import `buildIsland, makeSeaplane, InteractPoint, IslandBuild` from `'./island'` → `import { ACTIVE } from './islands'; import { makeSeaplane } from './kit/props'; import type { InteractPoint, IslandBuild } from './kit/types';`
- Add `import { setUiTheme } from './uiKit';`
- Line 303 `this.island = buildIsland();` →
  ```ts
  setUiTheme(ACTIVE.theme.ui);
  this.island = ACTIVE.build();
  ```
- Delete `src/three/island.ts` and `src/three/buildings.ts`.

- [ ] **Step 14: Verify zero regression**

Run: `pnpm verify`
Expected: PASS, and `test-shots/route-home.png` looks pixel-identical to before (open it and check).

- [ ] **Step 15: Commit**

```bash
git add -A && git commit -m "refactor: three/kit extraction + per-island scene modules (home identical)"
```

---

### Task 4: Per-island day/night + particles in engine

**Files:**
- Modify: `src/three/engine.ts:41-51` (DAY_STOPS), `:146-151` (petal consts), `:326` (petal mesh), `:400-429` (buildPetals), `:584-618` (updateDayNight)

- [ ] **Step 1: Theme-driven sky stops**

Replace the `DAY_STOPS` const (lines 41–51) with a builder. Keep the 9 time slots and all sun/intensity/exposure/night values EXACTLY as today; only the four color fields per slot come from `ACTIVE.theme.sky`:

```ts
interface DayStop {
  h: number; horizon: number; mid: number; zenith: number; fog: number;
  sun: number; sunI: number; hemiI: number; exposure: number; night: number;
}

function buildDayStops(sky: IslandTheme['sky']): DayStop[] {
  const s = (state: SkyState) => ({ horizon: state.horizon, mid: state.mid, zenith: state.zenith, fog: state.fog });
  return [
    { h: 0.0,  ...s(sky.night),  sun: 0xb8c8f0, sunI: 0.22, hemiI: 0.22, exposure: 0.9,  night: 1.0 },
    { h: 4.5,  ...s(sky.night),  sun: 0xb8c8f0, sunI: 0.22, hemiI: 0.22, exposure: 0.9,  night: 1.0 },
    { h: 6.0,  ...s(sky.dawn),   sun: 0xffb56b, sunI: 1.3,  hemiI: 0.65, exposure: 1.06, night: 0.3 },
    { h: 8.0,  ...s(sky.day),    sun: 0xfff2d9, sunI: 2.0,  hemiI: 0.92, exposure: 1.12, night: 0.0 },
    { h: 16.5, ...s(sky.day),    sun: 0xfff2d9, sunI: 2.0,  hemiI: 0.92, exposure: 1.12, night: 0.0 },
    { h: 18.0, ...s(sky.sunset), sun: 0xff9a4a, sunI: 1.7,  hemiI: 0.6,  exposure: 1.08, night: 0.15 },
    { h: 19.5, ...s(sky.dusk),   sun: 0xd8908a, sunI: 0.8,  hemiI: 0.45, exposure: 1.0,  night: 0.65 },
    { h: 20.5, ...s(sky.night),  sun: 0xb8c8f0, sunI: 0.22, hemiI: 0.22, exposure: 0.9,  night: 1.0 },
    { h: 24.0, ...s(sky.night),  sun: 0xb8c8f0, sunI: 0.22, hemiI: 0.22, exposure: 0.9,  night: 1.0 },
  ];
}
```

(Values transcribed from the current DAY_STOPS — double-check against the old const before deleting it.) In the constructor, add `private dayStops = buildDayStops(ACTIVE.theme.sky);` and in `updateDayNight` replace `DAY_STOPS` references with `this.dayStops`. Add the type imports (`IslandTheme`, `SkyState` from `./theme`).

- [ ] **Step 2: Theme-driven particles**

Delete `PETAL_COUNT`/`PETAL_PALETTE` consts (lines 146, 151). In the constructor before `buildPetals()`: `const pc = ACTIVE.theme.particles;` — use `pc.count` for the `InstancedMesh` size (line 326) and store `this.petalPalette = pc.palette`. In `buildPetals` replace `PETAL_COUNT` with `this.petalData`-loop bound `this.petals.count` and `PETAL_PALETTE[i % PETAL_PALETTE.length]` with `this.petalPalette[i % this.petalPalette.length]`. Declare `private petalPalette: number[];`.

- [ ] **Step 3: Bamboo sway hook (generic)**

In the island-systems tick block (only when `activeKind === 'island'`, ~lines 691–807), add:

```ts
// Bamboo / tall-grass sway (islands that provide sway groups).
const sway = this.island.sway ?? [];
for (const g of sway) {
  g.rotation.z = Math.sin(this.elapsed * 0.9 + (g.userData.phase ?? 0)) * 0.035;
}
```

Use the loop's existing elapsed/time variable (check the tick's local name — the seaplane bob and sea `uTime` use it). If none exists, accumulate `private swayT = 0; this.swayT += dt;`.

- [ ] **Step 4: Verify**

Run: `pnpm verify`
Expected: PASS; home visuals unchanged (home theme = old hardcoded values).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: theme-driven day/night stops, particles, sway hook"
```

---

### Task 5: Interiors — per-island tint + exhibit-count frames + generic art

**Files:**
- Modify: `src/three/interiors.ts:13-24` (contract), `:127-138` (wallpaper), `:659-804` (museum), `:810-997` (house)
- Modify: `src/three/engine.ts` (`applyInterior` ~551–574 passes tint)

- [ ] **Step 1: Extend the contract**

```ts
export interface InteriorTint {
  houseWall: string;   // wallpaper base css color (pinstripes derive from it)
  rugRing: number;
  rugCenter: number;
  museumBg: number;
}

export function buildInterior(kind: 'house' | 'museum', tint: InteriorTint): InteriorBuild
```

`makeWallpaperTexture(base = '#e8f2dc')` — add the param; stripe color stays `#d6e6c8` unless base differs, in which case derive stripes by darkening: draw stripes with `ctx.fillStyle = base` filtered — simplest correct approach: add second param `stripe = '#d6e6c8'` and have callers pass both from a small helper `wallpaperPair(base)` that returns `[base, shade]`; for the tints below, hardcode the pairs:
home `['#e8f2dc','#d6e6c8']`, maplebury `['#f2e4cc','#e4d4b4']`, petalbrook `['#fdeef4','#f2dae6']`, bitgrove `['#e4ece0','#d2decc']`, noveo `['#e0dce8','#ccc6da']`. Store pairs in each island's `theme.interior.houseWall` as `string` base only, and keep the stripe map inside `interiors.ts`:

```ts
const WALL_STRIPES: Record<string, string> = {
  '#e8f2dc': '#d6e6c8', '#f2e4cc': '#e4d4b4', '#fdeef4': '#f2dae6',
  '#e4ece0': '#d2decc', '#e0dce8': '#ccc6da',
};
```

- [ ] **Step 2: Thread the tint**

- `buildMuseum(tint)`: `scene.background = new THREE.Color(tint.museumBg)`.
- `buildHouse(tint)`: wallpaper call → `makeWallpaperTexture(tint.houseWall, WALL_STRIPES[tint.houseWall] ?? '#d6e6c8')`; rug call (line 960) → `makeRugTexture(tint.rugRing, tint.rugCenter)`. Museum rug (line 757) → same tint rug.
- `buildInterior(kind, tint)` dispatches with the tint.

- [ ] **Step 3: Exhibit-count frames + generic art**

In `buildMuseum`, replace the hardcoded 3 frames at x `[-4.6, 0, 4.6]` and the `exhibits[i]` mapping (lines ~700–730) with:

```ts
const shown = exhibits.slice(0, 5);
const xs = shown.length === 1 ? [0]
  : shown.map((_, i) => -4.6 + (9.2 * i) / (shown.length - 1));
shown.forEach((e, i) => {
  const art = e.art === 'seelie' ? seelieArtCanvas()
    : e.art === 'bridge' ? bridgeArtCanvas()
    : e.art === 'solar' ? solarArtCanvas()
    : genericArtCanvas(e);
  // ... existing frame placement using xs[i] ...
  points.push({
    id: `exhibit-${i}`, label: e.title, hint: 'View exhibit', exhibit: e,
    position: new THREE.Vector3(xs[i], 0, -4.15), markerY: 1.5, radius: 1.5,
  });
});
```

Add `genericArtCanvas(e: Exhibit)` next to the other art canvases (lines ~300–376):

```ts
const KIND_COLORS: Record<Exhibit['kind'], string> = {
  project: '#889df0', post: '#d97b2f', note: '#f4a7c3', log: '#6fae7d',
};

/** Fallback museum art: kind-colored field + big initial (Baloo-safe glyphs only). */
function genericArtCanvas(e: Exhibit): THREE.CanvasTexture {
  const c = cv(256, 320);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = KIND_COLORS[e.kind];
  ctx.fillRect(0, 0, 256, 320);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(0, 220, 256, 100);
  ctx.fillStyle = '#fffef7';
  ctx.font = 'bold 150px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(e.title.charAt(0).toUpperCase(), 128, 130);
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText(e.kind.toUpperCase(), 128, 268);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
```

(`cv`/`makeTex` already exist in the file — match their conventions.)

- [ ] **Step 4: Engine passes the tint**

In `applyInterior` (~551–574), the lazy build call becomes `buildInterior(kind, ACTIVE.theme.interior)`.

- [ ] **Step 5: Verify**

Run: `pnpm verify`
Expected: PASS; home interior identical (defaults = old values).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: per-island interior tints + exhibit-count museum frames"
```

---

### Task 6: Maplebury island module (cheng.sh — autumn)

**Files:**
- Create: `src/three/islands/maplebury.ts` (replaces the stub)
- Modify: `src/three/kit/props.ts` (add `makeLantern`)

- [ ] **Step 1: Add `makeLantern` to kit/props.ts**

```ts
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
```

(`std`/`shadowed` come from `kit/core` — same import style as the other prop makers.)

- [ ] **Step 2: Write `src/three/islands/maplebury.ts`** (full module)

```ts
import * as THREE from 'three';
import type { IslandTheme } from '../theme';
import type { IslandBuild, InteractPoint, Collider, Butterfly } from '../kit/types';
import { mulberry32 } from '../kit/core';
import { buildBase } from '../kit/base';
import { placePath, makePier, makeSeaplane, makeLogBench, makeLantern } from '../kit/props';
import { makeHardwoodTree, makeBush, makeFlowerCluster, makeMushroom, makeGrassTuft,
  makeBoulder, makeShell, TULIP_RED, TULIP_YELLOW, makeTulipCluster } from '../kit/flora';
import { makeCloud, makeGull } from '../kit/critters';
import { setBuildingTheme, makeHouse, makeMuseum, makeNoticeBoard, makeSign, makeLamp } from '../kit/buildings';
import { locations } from '../../content';

export const theme: IslandTheme = {
  outline: { f1: 4, p1: 1.3, f2: 7, p2: 0.4 },
  turf: { base: '#d4af66', shades: ['#c9a258', '#b8933f', '#daba72', '#c09a4a'], dark: 0xb08a44 },
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

const MAPLE = { canopyDark: 0xa8402a, canopyMid: 0xd97b2f };
const MAPLE_RED = { canopyDark: 0x8e3a2a, canopyMid: 0xc14e2e };

export function build(): IslandBuild {
  setBuildingTheme(theme.buildings);
  const rng = mulberry32(20260810);
  const group = new THREE.Group();
  const colliders: Collider[] = [];
  const base = buildBase(theme);
  group.add(base.group);

  // Plaza (stone-warm) at (0, -0.5)
  const plazaRim = new THREE.Mesh(new THREE.CircleGeometry(2.3, 48),
    new THREE.MeshStandardMaterial({ color: theme.path.rim, roughness: 0.95 }));
  plazaRim.rotation.x = -Math.PI / 2; plazaRim.position.set(0, 0.035, -0.5); plazaRim.receiveShadow = true;
  const plazaIn = new THREE.Mesh(new THREE.CircleGeometry(2.0, 48),
    new THREE.MeshStandardMaterial({ color: theme.path.center, roughness: 0.95 }));
  plazaIn.rotation.x = -Math.PI / 2; plazaIn.position.set(0, 0.045, -0.5); plazaIn.receiveShadow = true;
  group.add(plazaRim, plazaIn);

  // Paths: plaza -> house door, -> museum door, -> board; winding spur to bench
  placePath(group, [0, -0.5], [-9.2, -4.0], rng, theme.path.center, theme.path.rim);
  placePath(group, [0, -0.5], [0, -6.6], rng, theme.path.center, theme.path.rim);
  placePath(group, [0, -0.5], [-0.5, 2.6], rng, theme.path.center, theme.path.rim);
  placePath(group, [0, -0.5], [5.4, 0.4], rng, theme.path.center, theme.path.rim);

  // Buildings
  const house = makeHouse();
  house.position.set(-12.2, 0, -5.0); house.rotation.y = Math.atan2(12.2, 4.5);
  group.add(house); colliders.push({ x: -12.2, z: -5.0, r: 3.0 });
  const houseSign = makeSign('Home');
  houseSign.position.set(-9.4, 0, -3.9); houseSign.rotation.y = Math.atan2(9.4, 3.4);
  group.add(houseSign); colliders.push({ x: -9.4, z: -3.9, r: 0.5 });

  const museum = makeMuseum();
  museum.position.set(0, 0, -11.3); museum.rotation.y = 0;
  group.add(museum); colliders.push({ x: 0, z: -11.3, r: 3.6 });
  const museumSign = makeSign(locations.projects.name);
  museumSign.position.set(2.4, 0, -7.6); museumSign.rotation.y = Math.atan2(-2.4, 7.1);
  group.add(museumSign); colliders.push({ x: 2.4, z: -7.6, r: 0.5 });

  const board = makeNoticeBoard();
  board.position.set(-0.5, 0, 1.9); board.rotation.y = Math.atan2(0.5, -2.4);
  group.add(board); colliders.push({ x: -0.5, z: 1.9, r: 1.35 });

  for (const [lx, lz] of [[-3.2, -3.0], [2.6, 1.2]] as const) {
    const lamp = makeLamp(); lamp.position.set(lx, 0, lz);
    group.add(lamp); colliders.push({ x: lx, z: lz, r: 0.32 });
  }

  // Maple grove around the museum + scattered pears
  for (const [x, z, look] of [
    [-7.2, -14.4, MAPLE], [4.3, -14.0, MAPLE_RED], [6.5, -10.1, MAPLE],
    [-9.4, -13.7, MAPLE_RED], [0.5, -14.6, MAPLE],
  ] as const) {
    const t = makeHardwoodTree(rng, x, z, look);
    group.add(t.group); colliders.push(t.collider);
  }
  for (const [x, z] of [[11.5, 3.5], [-12.5, 1.0], [8.5, -7.5]] as const) {
    const t = makeHardwoodTree(rng, x, z, { fruit: 0xd8e07a }); // pears
    group.add(t.group); colliders.push(t.collider);
  }

  // Reading corner: bench + lanterns (glow at night)
  const bench = makeLogBench();
  bench.position.set(5.8, 0, 0.7); bench.rotation.y = -1.2;
  group.add(bench); colliders.push({ x: 5.8, z: 0.7, r: 0.7 });
  for (const [x, z] of [[10.1, -2.2], [3.6, 3.6]] as const) {
    const l = makeLantern(); l.position.set(x, 0, z);
    group.add(l); colliders.push({ x, z, r: 0.3 });
  }

  // Undergrowth
  for (const [x, z] of [[-6.0, 2.5], [4.0, -4.6], [-3.5, 6.8]] as const) {
    const b = makeBush(x, z, rng); group.add(b.group); colliders.push(b.collider);
  }
  makeFlowerCluster(group, -3.6, 4.2, [0xd96b3b, 0xe8a04a], rng);
  makeFlowerCluster(group, 7.4, 4.8, [0xc14e2e, 0xe8c05a], rng);
  makeTulipCluster(group, -7.8, -1.5, [TULIP_RED, TULIP_YELLOW], rng);
  const mush = makeMushroom(-4.6, -8.6, true, rng); group.add(mush);
  for (let i = 0; i < 12; i++) {
    const x = (rng() - 0.5) * 26, z = (rng() - 0.5) * 26;
    if (Math.hypot(x, z) > 14.5) continue;
    group.add(makeGrassTuft(x, z, rng));
  }
  const b1 = makeBoulder(-12.0, -7.8, 0.5, rng); group.add(b1.group); colliders.push(b1.collider);
  group.add(makeShell(15.5, 6.0, rng));

  // Sky life (no butterflies on the autumn island — leaves instead)
  const clouds: THREE.Group[] = [];
  for (let i = 0; i < 5; i++) {
    const c = makeCloud(i * 7 + 3);
    c.userData = { radius: 26 + (i % 3) * 7, y: 10 + (i % 3) * 2.2, speed: 0.008 + (i % 3) * 0.004, angle: rng() * Math.PI * 2 };
    clouds.push(c); group.add(c);
  }
  const gulls: THREE.Group[] = [];
  for (const [radius, y, speed, angle] of [[27, 8.5, 0.012, 0.4], [33, 10.5, 0.01, 2.2]] as const) {
    const g = makeGull(radius + y);
    g.userData = { radius, y, speed, angle };
    gulls.push(g); group.add(g);
  }

  // Pier + seaplane (south-east shore)
  const pier = makePier(); pier.position.set(9.4, 0.12, 13.2); group.add(pier);
  const pierDeck = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 5.7), new THREE.MeshBasicMaterial({ visible: false }));
  pierDeck.rotation.x = -Math.PI / 2; pierDeck.position.set(9.4, 0.165, 15.95);
  group.add(pierDeck);
  const pierZone = { minX: 8.55, maxX: 10.25, minZ: 13.1, maxZ: 18.8, y: 0.165 };
  const pierApproach = { minX: 8.55, maxX: 10.25, minZ: 11.2, maxZ: 13.3, y: 0 };
  const seaplane = makeSeaplane(); seaplane.position.set(12.0, -0.82, 18.0); seaplane.rotation.y = -0.5;
  group.add(seaplane);

  const points: InteractPoint[] = [
    { id: 'about', label: locations.about.name, hint: locations.about.hint, enterTo: 'house',
      position: new THREE.Vector3(-8.5, 0, -3.65), markerY: 2.4, radius: 2.2 },
    { id: 'projects', label: locations.projects.name, hint: locations.projects.hint, enterTo: 'museum',
      position: new THREE.Vector3(0, 0, -6.8), markerY: 2.4, radius: 2.2 },
    { id: 'contact', label: locations.contact.name, hint: locations.contact.hint, route: '/contact',
      position: new THREE.Vector3(-0.5, 0, 3.0), markerY: 2.9, radius: 2.1 },
    { id: 'airport', label: 'Seaplane Dock', hint: 'Fly to another island', airport: true,
      position: new THREE.Vector3(9.4, 0, 17.8), markerY: 1.4, radius: 1.9 },
  ];

  return {
    group, walkSurface: base.walkSurface, colliders, points, clouds,
    foam: base.foam, flames: [], waves: base.waves, sea: base.sea,
    butterflies: [] as Butterfly[], gulls, seaplane,
    extraWalkSurfaces: [pierDeck], walkZones: [pierZone, pierApproach],
  };
}
```

(If `makeBush`/`makeBoulder`/`makeShell` return shapes differ from `{group, collider}` / plain mesh, match the actual moved signatures from `kit/flora.ts` — island.ts:339–366, 553–567, 614–621 show what they return today.)

- [ ] **Step 3: Verify the Maplebury build**

Run: `pnpm build:chengsh && pnpm preview --port 4173 --strictPort &` then open `http://localhost:4173` and walk the island visually (or rely on Task 11's matrix). Minimum gate: `pnpm typecheck` PASS + `vite build --mode chengsh` succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: Maplebury — autumn maple island (cheng.sh)"
```

---

### Task 7: Petalbrook island module (misthois.cn — sakura spring)

**Files:**
- Create: `src/three/islands/petalbrook.ts` (replaces the stub)

- [ ] **Step 1: Write the module** — same skeleton as Maplebury (Task 6 Step 2), with:

```ts
export const theme: IslandTheme = {
  outline: { f1: 6, p1: 2.2, f2: 8, p2: 1.1 },
  turf: { base: '#abe288', shades: ['#9ed67c', '#8cc864', '#b8e894', '#96d070'], dark: 0x86c464 },
  sand: { base: '#f7e6ad', wet: 0xe6cf8e },
  path: { center: 0xf0eee6, rim: 0xcfc8b8 },  // light stone
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
```

Layout (plaza `(0, 0)`, stone paths):
- Sakura trees `makeHardwoodTree(rng, x, z, { canopyDark: 0xe892b4, canopyMid: 0xf7bcd4 })` at `(-10.8,-11.7) (-6.5,-12.3) (-2.2,-12.6) (2.2,-12.2) (6.0,-11.8)`.
- Apple trees `{ fruit: 0xe85a5a }` at `(-12.0,6.0) (11.8,-3.0) (-3.0,10.5)`.
- Pond at `(-5.8, 1.8)`: water `CircleGeometry(3.2, 40)` `MeshStandardMaterial({ color: 0x7ec8e8, roughness: 0.35 })` at y 0.03; rim `RingGeometry(3.2, 3.65)` color `0xe8e0cc` y 0.028; 6 floating petals (`CircleGeometry(0.09)` pink/white, y 0.045, scattered inside the pond); collider `{ x: -5.8, z: 1.8, r: 3.5 }`.
- House `(6.5, 0, -2.5)` rot `atan2(-6.5, 2.5)`, collider r3.0; sign `'Home'` at `(4.6, 0, -2.0)` rot `atan2(-4.6, 2.0)` collider r0.5; door point `(2.9, 0, -1.1)`.
- Museum `(7.2, 0, -11.2)` rot `atan2(-7.2, 11.2)`, collider r3.6; sign `locations.projects.name` at `(4.6, 0, -8.4)` rot `atan2(-4.6, 8.4)` collider r0.5; door point `(4.8, 0, -7.4)`.
- Notice board `(0.4, 0, 1.4)` rot `atan2(-0.4, -1.4)`, collider r1.35; point `(0.4, 0, 3.5)` markerY 2.9 r 2.1.
- Lamps `(-2.8, -2.6)` `(3.4, 2.2)` collider r0.32.
- Paths: plaza→house door `(2.9,-1.1)`, plaza→museum door `(4.8,-7.4)`, plaza→board `(0.4,3.2)`, plaza→pond rim `(-3.4,1.2)` — all with `theme.path` colors.
- Flowers: white/pink clusters at `(-8.6,-4.0) (1.5,6.5) (9.0,1.0)`; bushes `(-4.0,-6.5) (10.5,-6.0)`; grass tufts ×12 reject `hypot > 14.5`; butterflies ×3 (reuse home's `makeButterfly` anchors).
- Pier (south-west): pier group `(-9.5, 0.12, 13.0)`; pierDeck plane 1.7×5.7 at `(-9.5, 0.165, 15.75)`; `pierZone { minX: -10.35, maxX: -8.65, minZ: 12.9, maxZ: 18.6, y: 0.165 }`; `pierApproach { minX: -10.35, maxX: -8.65, minZ: 10.9, maxZ: 13.0, y: 0 }`; seaplane `(-6.9, -0.82, 17.8)` rot -0.5; airport point `(-9.5, 0, 17.6)` markerY 1.4 r 1.9.
- Clouds ×5, gulls ×2 — same userData pattern as Maplebury.

- [ ] **Step 2: Verify** — `pnpm typecheck` PASS + `vite build --mode misthois` succeeds; open preview, confirm sakura/pond/pier walk.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: Petalbrook — sakura spring island (misthois.cn)"
```

---

### Task 8: Bitgrove island module (kleos.cn — bamboo zen)

**Files:**
- Create: `src/three/islands/bitgrove.ts` (replaces the stub)
- Modify: `src/three/kit/props.ts` (add `makeBamboo`, `makeStoneLantern`, `makeStoneTablet`)

- [ ] **Step 1: New kit props** (append to `kit/props.ts`)

```ts
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

/** Engraved stone tablet — Latin digits only (Baloo 2 has no CJK glyphs). */
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
```

- [ ] **Step 2: Write the module** — same skeleton as Maplebury, with:

```ts
export const theme: IslandTheme = {
  outline: { f1: 5, p1: 3.0, f2: 9, p2: 4.2 },
  turf: { base: '#7ab887', shades: ['#6fae7d', '#5e9a6a', '#86c494', '#66a472'], dark: 0x5e9a6a },
  sand: { base: '#f0e8c8', wet: 0xd8cca0 },
  path: { center: 0xc8c8be, rim: 0x9a9a90 },  // grey stone
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
```

Layout (plaza `(0, 0)` with the tablet as centerpiece):
- Tablet `makeStoneTablet('01')` at `(-1.3, 0, -0.4)` rot 0.4; collider `{ x: -1.3, z: -0.4, r: 0.9 }`.
- Bamboo wall: two rows, `x ≈ -12.2` and `x ≈ -10.8`, z from `-14` to `2` step `1.3` (offset the second row by 0.65). Each: `const b = makeBamboo(rng); b.position.set(x, 0, z); group.add(b); colliders.push({ x, z, r: 0.3 }); sway.push(b);` Return them as `sway` in the IslandBuild.
- Teal pond `(-3.2, 9.4)`: `CircleGeometry(3.0)` color `0x4f9a9c` roughness 0.3 y 0.03; rim ring `(3.0, 3.5)` color `0xb8b8ae`; stepping stones = 3 flattened `CylinderGeometry(0.42, 0.48, 0.08, 9)` stone `0x9aa0a4` at `(-4.4,8.2) (-3.2,9.4) (-2.0,10.6)` y 0.06; collider `{ x: -3.2, z: 9.4, r: 3.3 }`.
- Stone lanterns `(-6.5, -5.5)` `(3.0, 6.5)` collider r0.35.
- House `(6.5, 0, -11.5)` rot `atan2(-6.5, 11.5)` collider r3.0; sign `'Home'` `(5.0, 0, -8.2)` rot `atan2(-5.0, 8.2)` collider r0.5; door point `(4.6, 0, -8.1)`.
- Museum `(7.9, 0, 4.9)` rot `atan2(-7.9, -4.9)` collider r3.6; sign `locations.projects.name` `(5.6, 0, 3.2)` rot `atan2(-5.6, -3.2)` collider r0.5; door point `(4.1, 0, 2.5)`.
- Board `(-2.5, 0, -8.6)` rot `atan2(2.5, 8.6)` collider r1.35; point `(-2.5, 0, -6.4)` markerY 2.9 r 2.1.
- Lamps `(-4.5, -2.5)` `(3.5, -3.5)` collider r0.32.
- Peach trees `{ fruit: 0xffb08a }` at `(11.5,-5.5) (-5.5,-13.0) (12.0,6.0)`.
- Paths: plaza→house door, plaza→museum door, plaza→board, plaza→pond stones.
- Flowers: white/green clusters `(-8.0,4.5) (6.0,8.5)`; bushes `(1.5,-6.0) (-7.5,-9.0)`; grass tufts ×12.
- Pier (south): pier `(1.1, 0.12, 13.2)`; pierDeck `(1.1, 0.165, 15.95)`; `pierZone { minX: 0.25, maxX: 1.95, minZ: 13.1, maxZ: 18.8, y: 0.165 }`; `pierApproach { minX: 0.25, maxX: 1.95, minZ: 11.1, maxZ: 13.3, y: 0 }`; seaplane `(3.7, -0.82, 18.0)` rot -0.5; airport point `(1.1, 0, 17.8)` markerY 1.4 r 1.9.
- Clouds ×5, gulls ×2, no butterflies.

- [ ] **Step 3: Verify** — `pnpm typecheck` PASS + `vite build --mode kleos` succeeds; preview walk.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: Bitgrove — bamboo zen island (kleos.cn)"
```

---

### Task 9: Noveo island module (noveo.cn — construction site)

**Files:**
- Create: `src/three/islands/noveo.ts` (replaces the stub)
- Modify: `src/three/kit/props.ts` (add `makeCone`, `makeScaffold`)

- [ ] **Step 1: New kit props**

```ts
/** Traffic cone. */
export function makeCone(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 12), std(0xe07830, 0.7));
  body.position.y = 0.25;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.028, 6, 12), std(0xf7f4ec, 0.6));
  band.rotation.x = Math.PI / 2; band.position.y = 0.28;
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.3), std(0xc96428, 0.8));
  base.position.y = 0.025;
  g.add(body, band, base);
  g.traverse((o) => { if (o instanceof THREE.Mesh) shadowed(o); });
  return g;
}

/** Scaffolding frame: 4 poles + 2 crossbars + a plank, sized to hug a building face. */
export function makeScaffold(w = 7.0, h = 3.6, d = 4.4): THREE.Group {
  const g = new THREE.Group();
  const pole = std(0xc9a23c, 0.6, 0.3);
  for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]] as const) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, h, 8), pole);
    p.position.set(x, h / 2, z); g.add(p);
  }
  for (const y of [h * 0.45, h * 0.9]) {
    for (const z of [-d / 2, d / 2]) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, w, 8), pole);
      bar.rotation.z = Math.PI / 2; bar.position.set(0, y, z); g.add(bar);
    }
  }
  const plank = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, 0.5), std(0xb08a5a, 0.85));
  plank.position.set(0, h * 0.9 + 0.05, -d / 2);
  g.add(plank);
  g.traverse((o) => { if (o instanceof THREE.Mesh) shadowed(o); });
  return g;
}
```

- [ ] **Step 2: Write the module** — same skeleton, with:

```ts
export const theme: IslandTheme = {
  outline: { f1: 4, p1: 0.2, f2: 6, p2: 2.8 },
  turf: { base: '#b0a8ca', shades: ['#a89ec2', '#968eb2', '#bcb4d4', '#9e96b8'], dark: 0x968eb2 },
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
```

Layout (plaza `(0, 1.5)`):
- Museum `(0, 0, -11.5)` rot 0 collider r3.6 + scaffold `makeScaffold()` at the same center (colliders: 4 poles r0.3 at `(±3.5, -11.5±2.2)`); sign `locations.projects.name` `(2.6, 0, -8.2)` rot `atan2(-2.6, 8.2)` collider r0.5; door point `(0, 0, -7.0)`.
- House `(-9.7, 0, -2.2)` rot `atan2(9.7, 2.2)` collider r3.0; sign `'Home'` `(-7.4, 0, -1.6)` rot `atan2(7.4, 1.6)` collider r0.5; door point `(-5.9, 0, -1.3)`.
- Board `(0, 0, 3.6)` rot `atan2(0, -3.6)` collider r1.35; point `(0, 0, 5.8)` markerY 2.9 r 2.1. Leaning `'Soon!'` sign `makeSign('Soon!')` at `(2.8, 0, -8.9)` rot -0.4 collider r0.5.
- Dirt patches: `CircleGeometry` flat meshes color `0x8f8266` roughness 1 at `(-4.3, 4.7, r2.6)` `(3.2, -5.8, r2.1)` y 0.03.
- Cones `makeCone()` at `(-1.2,-3.0) (1.2,-4.6) (-1.2,-6.2) (4.5,1.0) (-6.5,2.0)` — no colliders.
- Cherry saplings `makeHardwoodTree(rng, x, z, { canopyDark: 0x7a9a5e, canopyMid: 0x8fae6e, fruit: 0xffb7c9, scale: 0.55 })` at `(10.5,-4.5) (-11.5,3.0) (5.0,9.0)`.
- Lamps `(-3.0,-1.0) (3.0,4.0)` collider r0.32. No flowers — 4 weed tufts instead (`makeWeedTuft`).
- Paths: plaza→museum door, plaza→house door, plaza→board.
- Pier/seaplane/zones: identical numbers to Maplebury (`(9.4, …)`).
- Clouds ×4, gulls ×1, no butterflies, `flames: []`.

- [ ] **Step 3: Verify** — `pnpm typecheck` PASS + `vite build --mode noveo` succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: Noveo — construction-site island (noveo.cn)"
```

---

### Task 10: Flight board chips + flyby tint

**Files:**
- Modify: `src/three/uiPanels.ts:318-407` (`showFlightBoard`)
- Modify: `src/three/engine.ts:361-387` (iris shader), `:496-508` (`flyAway`)

- [ ] **Step 1: Palette chip on the board**

In `showFlightBoard`, next to each row's `fruitDot` (the `fruitDot` map is at line ~349), add a second small square chip using `isl.chip`:

```ts
const chip = new THREE.Mesh(
  new THREE.PlaneGeometry(0.09, 0.09),
  uiMaterial(isl.chip),
);
chip.position.set(chipX, rowY, 0.001); // chipX = fruit dot x + 0.14
rowGroup.add(chip);
```

(Place it immediately right of the fruit dot; reuse the row group's coordinate convention already in the function.)

- [ ] **Step 2: Flyby tint**

Iris shader (lines 361–382): add uniform + use it:

```ts
uniforms: { uRadius: { value: 2.0 }, uAspect: { value: 16 / 9 }, uTint: { value: new THREE.Color(0.015, 0.01, 0.02) } },
// fragmentShader: replace the gl_FragColor line with:
gl_FragColor = vec4(uTint, 1.0);
// and add `uniform vec3 uTint;` at the top of the fragment shader.
```

`flyAway(url)` (496–508): before starting the transition, tint the iris toward the destination:

```ts
const dest = DESTINATIONS.find((d) => d.url === url);
if (dest) this.irisMat.uniforms.uTint.value.setHex(dest.chip).multiplyScalar(0.35);
```

- [ ] **Step 3: Verify**

Run: `pnpm verify`
Expected: PASS — flight-board click + flyby screenshot (`test-shots/flyby.png`) still works.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: flight-board palette chips + destination-tinted flyby"
```

---

### Task 11: Per-site verification matrix

**Files:**
- Modify: `scripts/verify.mjs`
- Modify: `package.json`

- [ ] **Step 1: Parameterize verify.mjs**

At the top (after imports), accept the site arg:

```js
const SITE_ID = process.argv[2] ?? 'chengim';
const DIST = new URL(`../dist/${SITE_ID}/`, import.meta.url).pathname;
const SHOTS = new URL(`../test-shots/${SITE_ID}/`, import.meta.url).pathname;
```

- `fs.mkdirSync(SHOTS, { recursive: true })` near the top; replace every `'test-shots/...'` screenshot path with `path.join(SHOTS, '<name>.png')`.
- Preview spawn (lines ~79–82): serve `DIST` instead of `dist` — `pnpm preview --port 4173 --strictPort` runs vite preview with `--outDir`; use `pnpm exec vite preview dist/${SITE_ID} --port 4173 --strictPort`.
- Replace the hardcoded island-surface teleport coords (house `(-3.63,0,-2.35)`, museum `(3.49,0,-2.53)`, pier `(10.6,0,19.2)`) with live reads — add a helper:

```js
async function pointPos(page, id) {
  return page.evaluate((pid) => {
    const p = window.__engine.island.points.find((q) => q.id === pid);
    return { x: p.position.x, y: p.position.y, z: p.position.z };
  }, id);
}
```

Then `const about = await pointPos(page, 'about')` and teleport with those coords. Same for `'projects'` and `'airport'`. Interior coords (desk `(-4.4,0,-0.6)`, house exit `(0,0,3.6)`, exhibit `(0,0,-4.15)`) stay hardcoded — interiors are shared.
- The destination-click assertion regex `/cheng\.sh|misthois\.cn|kleos\.cn|chrome-error/` stays valid for every site (destinations exclude self).

- [ ] **Step 2: package.json scripts**

```json
"test:e2e": "node scripts/verify.mjs",
"verify:site": "node scripts/verify.mjs",
"verify:islands": "pnpm build:chengim && node scripts/verify.mjs chengim && pnpm build:chengsh && node scripts/verify.mjs chengsh && pnpm build:misthois && node scripts/verify.mjs misthois && pnpm build:kleos && node scripts/verify.mjs kleos"
```

(There is no `.env.noveo` yet — check `.env.*`: if missing, create `.env.noveo` with `VITE_SITE=noveo` and add `"build:noveo": "vite build --mode noveo --outDir dist/noveo --emptyOutDir"` matching the existing `build:<id>` pattern, and include noveo in `verify:islands`.)

- [ ] **Step 3: Run the matrix**

Run: `pnpm verify:islands`
Expected: all four/five sites PASS; screenshots land in `test-shots/<site>/`.

- [ ] **Step 4: Visual pass**

Open `test-shots/<site>/route-home.png` for every island and confirm: distinct turf/sky/UI skin, correct building placement, pier reachable (`pier-end.png`), flight board shows new names (`flight-board.png`).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "test: per-site verify matrix (scripts/verify.mjs <site>)"
```

---

### Task 12: Docs — AGENTS.md architecture update

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Update the architecture section**

Rewrite the `src/` tree and key flows to match reality: `content/` per-island modules, `three/kit/*` shared builders, `three/islands/*` scene modules + `ACTIVE` dispatch, `setUiTheme`/`setBuildingTheme` theming, per-island day/night stops, `pnpm verify:islands` matrix. Update the conventions line "Content changes → `src/content.ts` only" → "Content changes → `src/content/<island>.ts`; new island → content module + `three/islands/<id>.ts` + registry entries in `content/index.ts` + `islands/index.ts` + `.env.<id>` + site.ts".

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md && git commit -m "docs: AGENTS.md — islandverse architecture"
```

---

## Self-review log

- Spec coverage: themes/layouts/skins (Tasks 3–9), content layer (Task 1), interiors tint (Task 5), day/night (Task 4), flight board + flyby (Tasks 3 site.ts + 10), particles (Task 4 + island themes), verify matrix (Task 11), docs (Task 12). Home = refined current look, no visual change (Task 3 regression check).
- Type consistency: `IslandBuild.sway?` (Task 3) ↔ engine sway loop (Task 4) ↔ bitgrove returns `sway` (Task 8). `Exhibit` fields used identically in Tasks 1/5. `BuildingTheme` fields match `theme.buildings` in every island. `InteriorTint` fields match `theme.interior`. `SisterIsland.chip` used in Task 10.
- Known deliberate simplifications: sea shader colors stay shared; house body color not themed (roof/door only); Noveo has no unit in `verify:islands` unless `.env.noveo` exists (Step 2 covers creating it).
