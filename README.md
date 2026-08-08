# 🍃 Island Portfolio — HUANG Cheng

An **Animal Crossing style portfolio** where the **entire site — UI included — is rendered in WebGL**.

Walk a chibi villager around a pastel island, visit buildings, and read your
portfolio in AC-style dialog bubbles that are drawn *into the 3D scene itself*.

![tech](https://img.shields.io/badge/react-19-61dafb) ![tech](https://img.shields.io/badge/tanstack_router-1.x-f472b6) ![tech](https://img.shields.io/badge/three.js-0.185-black)

## How it works

- **Vite 8 + React 19 + TanStack Router** — routes `/`, `/about`, `/projects`, `/contact`.
  Each route maps to an island location (House / Museum / Notice Board).
- **three.js (0.185+)** renders the island, villager, camera, shadows — everything.
- **HTML-in-Canvas (WICG)** — the dialogs and HUD are real HTML elements rendered
  as children of `<canvas layoutsubtree>`, then drawn into WebGL as textures:
  - Native `texElementImage2D` fast-path where available (Chrome with
    `chrome://flags/#canvas-draw-element`, origin trial Chrome M148+),
  - [`three-html-render`](https://github.com/repalash/three-html-render) polyfill
    (SVG `foreignObject` rasterisation) everywhere else — works in all browsers today.
- The DOM elements are repositioned over their 3D planes with a `matrix3d` overlay,
  so **hover, clicks, links and focus are native browser behaviour** — no raycast
  event synthesis.

## Controls

| Input | Action |
| --- | --- |
| `WASD` / arrow keys | Walk |
| Click / tap the ground | Walk there |
| `E` (near a `!` marker) | Talk / open the building's dialog |
| `Esc` / `✕` | Close dialog |

## Development

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # typecheck + production build
pnpm preview
```

## Editing content

Everything user-facing lives in **`src/content.ts`** — your name, greeting,
links (⚠️ the email is a placeholder: `hi@cheng.im`), and the three featured
projects (Seelie, obsidian-notes-bridge, solar-system).

Island terrain & vegetation live in **`src/three/island.ts`**, buildings in
**`src/three/buildings.ts`**, the villager in **`src/three/villager.ts`**.

## Gotchas discovered (don't remove these!)

- `src/three/hicCompat.ts` — patches the polyfill's `texElementImage2D.length`
  so three.js r185 uses the legacy 6-arg call the polyfill implements.
  Without it, UI textures throw `unexpected argument count 3`.
- **No CSS enter-animations on in-canvas UI** — every polyfill re-raster
  restarts CSS animations at frame 0 (`opacity: 0` ⇒ permanently blank texture).
  The dialog pop-in is done in 3D (`UiPanels`).
- In-canvas DOM is reparented by the polyfill, so React's synthetic events never
  reach it. Internal navigation uses a native capture-phase `[data-nav]`
  delegate (`App.tsx`). External `<a target="_blank">` links work natively.
- The polyfill's fullscreen host overlay is set to `pointer-events: none`
  (`App.tsx`) or click-to-walk is swallowed; UI children keep `auto`.
