# AGENTS.md

## Project

Animal Crossing style portfolio of HUANG Cheng. **The whole site is rendered in
WebGL**, including the UI (via HTML-in-Canvas). SPA with 4 routes mapped to
island locations.

## Stack

- Vite 8 + React 19 + TypeScript (strict) + TanStack Router 1.x (code-based routes in `src/router.tsx`)
- three.js 0.185 (native `THREE.HTMLTexture` support) + `three-html-render` 0.1.2 (HTML-in-Canvas polyfill)
- pnpm 11 · Node 24
- No CSS framework — hand-written `src/styles.css`. Font: bundled variable
  Baloo 2 (`public/fonts/baloo2.woff2`), also inlined as data-URI for the
  SVG rasteriser (`src/ui/font.ts`).

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
  router.tsx        # code-based route tree: / /about /projects /contact
  main.tsx
  styles.css        # page + in-canvas AC UI styles
  three/
    engine.ts       # renderer/scene/camera/loop; events: ready/prompt/interact
    island.ts       # terrain, sea, vegetation, paths, colliders, interact points
    buildings.ts    # house / museum / notice board / signs / lamps (addBuildings)
    villager.ts     # chibi character (primitives), walk/idle animation, blinks
    controls.ts     # WASD + click-to-move, follow camera, collision/bounds
    interactions.ts # proximity, "!" markers, E-key / marker-click interact
    uiPanels.ts     # HTML-in-Canvas panels (dialog + HUD + clock) on camera
    hicCompat.ts    # texElementImage2D.length patch (see Gotchas — REQUIRED)
  ui/
    App.tsx         # hosts <canvas layoutsubtree>; React renders HUD/dialog INTO it
    dialogs.tsx     # About / Projects / Contact dialog components
    font.ts         # font → data-URI @font-face for the rasteriser
```

Key flow: routes render dialog HTML as **children of `<canvas layoutsubtree>`**;
`three-html-render` captures them to textures on camera-anchored planes and
repositions the DOM over the planes (native pointer interaction).
`Engine` emits `interact(route)` → `App` calls `router.navigate`.

## Gotchas (hard-won, keep them working)

1. **`hicCompat.ts` is mandatory** — three r185 picks its `texElementImage2D`
   call style from the function's declared `.length`; the polyfill's rest-args
   implementation declares 3, so three calls the unsupported spec form and throws.
   The patch declares length 6.
2. **No CSS animations/transitions on enter for in-canvas UI** — polyfill
   re-rasters restart animations at frame 0 → blank textures. Animate in 3D
   (see `UiPanels.popT`). Keyframes that are pure decoration of static content
   (e.g. caret blink) are OK only while content mutates anyway.
3. **React onClick does not work inside the canvas** — the polyfill reparents
   canvas children outside `#root`, breaking React event delegation. Use
   `[data-nav]` + the native delegate in `App.tsx`. Plain `<a target="_blank">`
   works natively.
4. **Polyfill host overlay** must be `pointer-events: none` (done in `App.tsx`)
   or the canvas never receives click-to-walk.
5. Element sizes map 1:1 onto mesh bounding-box faces — keep `.dialog` /
   `.hud` fixed-width elements; `UiPanels.layout()` handles world scaling.
6. Don't remove `layoutsubtree` from the canvas in `App.tsx`.
7. **Never let a native `THREE.HTMLTexture` become a panel's material.map under
   the polyfill** — three.js's upload path re-appends the element into the
   `<canvas>`, out of the polyfill's observed host, and its MutationObserver
   then never sees mutations (textures freeze at their first frame).
   `UiPanels` therefore pre-seeds three-html-render's `_textures` registry with
   its own `CanvasTexture` per panel and feeds it via
   `canvas.captureElementImage(el)` on innerHTML change + a slow heartbeat.
   Only the native (flagged-Chrome) path uses THREE.HTMLTexture.

## Conventions

- Minimal, dependency-light code; primitives-only 3D (no external models/textures).
- Content changes → `src/content.ts` only. New island locations: add to
  `content.ts` + `island.ts` (+ route in `router.tsx`).
- Verify visually before shipping UI changes (Playwright screenshots of every
  route, plus a walk/E/Escape interaction pass).
