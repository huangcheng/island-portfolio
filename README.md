# 🍃 Island Portfolio — HUANG Cheng

An **Animal Crossing style portfolio** where the **entire site — UI included — is rendered in WebGL with zero DOM UI**.

Walk a panda villager around a pastel island, visit buildings, and read the
portfolio in AC-style dialog bubbles built from three.js meshes + SDF text.

![tech](https://img.shields.io/badge/react-19-61dafb) ![tech](https://img.shields.io/badge/tanstack_router-1.x-f472b6) ![tech](https://img.shields.io/badge/three.js-0.185-black) ![tech](https://img.shields.io/badge/troika--text-0.52-blue)

## How it works

- **Vite 8 + React 19 + TanStack Router** — routes `/`, `/about`, `/projects`,
  `/contact` map to island locations (House / Museum / Notice Board). The URL
  drives which dialog is open; route components render no DOM.
- **three.js** renders everything: island, panda villager, sky-dome shader,
  water shader, and the whole UI.
- **Zero-DOM UI**: dialogs / HUD / clock / buttons are rounded-rect meshes +
  [troika-three-text](https://github.com/protectwise/troika) SDF text on
  camera-anchored groups. Buttons are hit-tested by raycasting; hover springs
  and the leaf→glove cursor swap are driven from JS.
- **SEO** via `<head>` meta / Open Graph / Twitter cards (`index.html` + `public/og.png`).

## Controls

| Input | Action |
| --- | --- |
| `WASD` / arrow keys | Walk |
| Click / tap the ground | Walk there |
| `E` (near a `!` marker) | Talk / open the building's dialog |
| Click 3D buttons | Open links / close |
| `Esc` / `✕` | Close dialog |

## Development

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # typecheck + production build
pnpm preview
```

## Editing content

Everything user-facing lives in **`src/content.ts`** — name, greeting, links
(⚠️ the email is a placeholder: `hi@cheng.im`), and the featured projects.

Island layout: **`src/three/island.ts`** + **`src/three/buildings.ts`**.
UI panels/dialogs: **`src/three/uiPanels.ts`** (+ `uiKit.ts`).

## Gotchas

See **AGENTS.md** — notably: troika needs TTF (not woff2), missing glyphs must
be drawn as geometry, and click priority flows UI → interactables → ground.
