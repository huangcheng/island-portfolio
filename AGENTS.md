# AGENTS.md

## Project

Animal Crossing style portfolio of HUANG Cheng — an "islandverse": one
codebase, five islands (chengim · chengsh/Maplebury · misthois/Petalbrook ·
kleos/Bitgrove · noveo), one deployed per domain. The island a build serves is
selected at build time via `VITE_SITE` (`.env.<id>` files; `vite build --mode
<id>`). **The whole site — UI included — is rendered in WebGL with ZERO DOM
UI**: dialogs, HUD, clock and buttons are three.js meshes + troika SDF text;
interaction is raycast. TanStack Router still drives which dialog is open
(URL = source of truth). SEO via `<head>` meta/OG tags in `index.html`.

## Stack

- Vite 8 + React 19 + TypeScript (strict) + TanStack Router 1.x (code-based routes in `src/router.tsx`, components render null)
- three.js 0.185 + troika-three-text 0.52 (SDF text)
- pnpm 11 · Node 24
- No CSS framework — `src/styles.css` is page-chrome only (canvas, cursor, veil)
- Fonts: static-weight Baloo 2 **TTFs** in `public/fonts/` (500/700/800),
  instantiated from the variable font via fonttools (troika can't do woff2 or
  variable instances)

## Commands

```bash
pnpm dev              # dev server :5173 (default island: chengim)
pnpm build            # tsc --noEmit && vite build → dist/ (default island)
pnpm build:<id>       # build one island → dist/<id>
                      #   (chengim | chengsh | misthois | kleos | noveo)
pnpm islands          # build all five islands
pnpm typecheck
pnpm test:e2e         # Playwright suite: node scripts/verify.mjs [site]
                      #   — needs dist/<site> built first (pnpm build:<site>)
pnpm verify:islands   # build + e2e for all five islands (the full matrix)
```

## Testing

`node scripts/verify.mjs <site>` serves `dist/<site>/` via vite preview and
checks: all routes zero-console-error, walk/E/enter/exit interiors, exhibit
placard open/close, pier walk + flight board + flyby navigation to a sister
island, day/night lerp. Interact-point screen coords are read live from
`__engine.island.points` (each island lays out buildings/pier differently);
console errors are gated once the flyby click fires external navigation.
Screenshots land in `test-shots/<site>/`. `pnpm verify:islands` runs the
5-site build+verify matrix. Browser: system Chrome → bundled chromium →
ms-playwright fallback (all with timeouts; a 150s watchdog prevents hangs).

## Architecture

```
src/
  content/          # ALL user content, one module per island:
    types.ts        #   IslandContent contract + Exhibit (url/summary/kind,
                    #   optional date/stars/stack/art)
    home.ts         #   chengim · maplebury.ts chengsh · petalbrook.ts misthois
    …               #   · bitgrove.ts kleos · noveo.ts noveo
    index.ts        #   dispatch by SITE.id → exports profile, exhibits,
                    #   exhibitsSubtitle, locations, type Exhibit
  site.ts           # islandverse federation: ISLANDS registry (id/name/host/
                    #   url/theme/nativeFruit/status/chip — chip = flight-board
                    #   swatch + flyby iris tint), SITE (VITE_SITE), DESTINATIONS
  router.tsx        # route tree /, /about, /projects, /contact (null components)
  main.tsx
  styles.css        # page chrome only
  types/troika-three-text.d.ts  # Text-extends-Mesh typing fix (REQUIRED)
  three/
    theme.ts        # IslandTheme (outline/turf/sand/path, sky 5 stops,
                    #   particles, ui, buildings, interior) + SkyState
    engine.ts       # renderer/scenes/loop; setUiTheme(ACTIVE.theme.ui) +
                    #   ACTIVE.build(); scene swap + iris wipe (uTint tinted by
                    #   destination chip); setRoute; onEscape; updateDayNight
                    #   (stops from theme.sky via buildDayStops); particles from
                    #   theme.particles; sway hook; events: ready/interact
    islands/        # per-island scenes, each exports { theme, build() }:
      home.ts … noveo.ts   # one per SITE.id
      index.ts      #   BY_SITE registry → ACTIVE
    kit/            # shared island-building toolbox:
      types.ts      #   Collider / InteractPoint / IslandBuild (…, sway?) / Butterfly
      core.ts       #   std / shadowed / mulberry32 rng / shared geometries
      textures.ts   #   parameterized canvas textures (grass/dirt/sand/…)
      base.ts       #   buildBase(theme, rng): terrain/sea/foam/waves/walkSurface
      flora.ts      #   trees/flowers/…; makeHardwoodTree(rng, x, z, look: TreeLook)
      critters.ts   #   clouds / butterflies / gulls
      props.ts      #   pier/seaplane/campfire/… + makeLantern/makeBamboo/
                    #   makeStoneLantern/makeStoneTablet/makeCone/makeScaffold/
                    #   placePath (color params)
      buildings.ts  #   house/museum/notice board/signs/lamps + setBuildingTheme
    interiors.ts    # house + museum interiors; buildInterior(kind, tint) with
                    #   tint = ACTIVE.theme.interior; museum hangs
                    #   exhibits.slice(0, 5) (genericArtCanvas fallback)
    villager.ts     # panda villager (primitives), walk/idle anim, blinks, tail
    controls.ts     # WASD + click-to-move, follow camera, Environment swap
                    #   (circle bounds island / box bounds + camera clamp interiors)
    interactions.ts # proximity, "!" markers, E-key / marker-click; setScene swap
    uiKit.ts        # rounded-rect panels, troika labels, UiButton, icons,
                    #   UiPalette + setUiTheme, uiMaterial
    uiPanels.ts     # HUD / clock / route dialogs / exhibit mini-panel
  ui/
    App.tsx         # canvas + veil only; watches pathname → engine.setRoute
```

Key flows:
- Island selection: `VITE_SITE` → `SITE.id` → `islands/index.ts` `ACTIVE`
  (`{ theme, build() }`) and `content/index.ts` content — both dispatch on
  `SITE.id`. Engine applies the theme: `setUiTheme(theme.ui)`, day/night stops
  from `theme.sky`, particles from `theme.particles`, interiors tinted by
  `theme.interior`.
- Route change → `App` → `engine.setRoute(path)` → `ui.showRoute(path)`.
- `Engine` emits `interact(route)` (marker click / E key / dialog ✕) → `App` navigates.
- InteractPoint actions: `route` → navigate; `enterTo` → iris wipe into an
  interior scene; `exit` → iris wipe back to the island (return pos saved);
  `exhibit` → museum placard; `airport` → Dodo Airlines departures board →
  flyby transition (iris `uTint` = destination `chip`) + real navigation to a
  sister island (see `site.ts`).
- Scenes: villager + camera (which carries the UI panels + iris quad) are
  reparented into the active scene; island world systems freeze indoors.

## Gotchas (hard-won, keep them working)

1. **troika wants TTF/OTF, not woff2** — its parser rejects woff2 ("woff2 fonts
   not supported"). Keep the static `.ttf` instances; don't re-point to woff2.
2. **`src/types/troika-three-text.d.ts` is required** — troika's bundled d.ts
   forgets `extends Mesh`.
3. **Glyphs missing from Baloo 2** (e.g. ★, most emoji) silently render
   nothing — draw icons as geometry (see `makeStarShape` in uiPanels.ts) or
   image planes (`makeIcon`).
4. **Click priority**: `Controls.pickUi` raycasts 3D UI BEFORE the
   inputEnabled gate (dialog buttons must work while walking is frozen) and
   before interactable/ground picks. Hover swaps the cursor via
   `canvas.style.cursor` (leaf ↔ glove) — CSS can't see 3D hover.
5. **Dispose dialog content on route change** (`clearDialog` — text.dispose +
   geometry/material dispose) or it leaks GPU memory.
6. Camera-anchored UI meshes: `depthTest:false`, `renderOrder` root 900,
   `frustumCulled` irrelevant as they're camera children.
7. Keep `window.__engine` in App.tsx — the Playwright verification scripts
   drive the scene through it (incl. reading `__engine.island.points`).
8. **Door interact points must sit OUTSIDE building colliders** (plus body
   radius 0.42) — a point inside a collider gets the villager pushed out of
   the point's radius before E registers (museum entry failed this way).

## Conventions

- Minimal, dependency-light code; primitives-only 3D (no external model files).
- Content changes → `src/content/<island>.ts` only. New island locations: the
  content module + the island scene in `three/islands/<id>.ts` + `router.tsx`
  + a dialog builder in `uiPanels.ts`.
- New island → content module in `src/content/` + scene in
  `src/three/islands/<id>.ts` + registry entries in `content/index.ts` and
  `islands/index.ts` + `.env.<id>` + an ISLANDS entry in `site.ts` + a
  `build:<id>` script in `package.json`.
- Verify visually before shipping UI changes (`pnpm verify:islands` for the
  full matrix; screenshots per site in `test-shots/<site>/`, plus a
  walk/E/Escape/raycast-click pass).
