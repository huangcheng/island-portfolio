# AGENTS.md

## Project

Animal Crossing style portfolio of HUANG Cheng. **The whole site — UI included —
is rendered in WebGL with ZERO DOM UI**: dialogs, HUD, clock and buttons are
three.js meshes + troika SDF text; interaction is raycast. TanStack Router still
drives which dialog is open (URL = source of truth). SEO via `<head>` meta/OG
tags in `index.html`.

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
pnpm dev        # dev server :5173
pnpm build      # tsc --noEmit && vite build
pnpm typecheck
```

## Architecture

```
src/
  content.ts        # ALL user content: profile, links, projects, locations
  router.tsx        # route tree /, /about, /projects, /contact (null components)
  main.tsx
  styles.css        # page chrome only
  types/troika-three-text.d.ts  # Text-extends-Mesh typing fix (REQUIRED)
  three/
    engine.ts       # renderer/scene/loop; events: ready/interact; setRoute(path)
    island.ts       # terrain, sea shader, vegetation, paths, props, colliders
    buildings.ts    # house / museum / notice board / signs / lamps
    villager.ts     # panda villager (primitives), walk/idle anim, blinks, tail
    controls.ts     # WASD + click-to-move, follow camera, collision/bounds
    interactions.ts # proximity, "!" markers, E-key / marker-click interact
    uiKit.ts        # rounded-rect panels, troika labels, UiButton, AC palette
    uiPanels.ts     # HUD / clock / dialog builders, raycast hits, typewriter
  ui/
    App.tsx         # canvas + veil only; watches pathname → engine.setRoute
```

Key flow: route change → `App` → `engine.setRoute(path)` → `ui.showRoute(path)`
builds the dialog mesh tree. `Engine` emits `interact(route)` (marker click /
E key / dialog ✕) → `App` navigates.

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
   drive the scene through it.

## Conventions

- Minimal, dependency-light code; primitives-only 3D (no external model files).
- Content changes → `src/content.ts` only. New island locations: `content.ts`
  + `island.ts` + `router.tsx` + a dialog builder in `uiPanels.ts`.
- Verify visually before shipping UI changes (Playwright screenshots of every
  route, plus a walk/E/Escape/raycast-click pass).
