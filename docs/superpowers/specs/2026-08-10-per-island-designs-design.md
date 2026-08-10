# Per-Island Designs — Islandverse Federation

Date: 2026-08-10
Status: approved design, pending implementation plan

## Goal

Every island in the federation (one codebase, one island per domain, selected at
build time via `VITE_SITE`) gets its own full design — palette, terrain layout,
building placement, flora, signature props, UI wood skin, day/night mood, and
content — like real Animal Crossing islands: same game, distinct places.

## Islands & identities (approved)

| Island | Domain | Identity | Fruit | Status |
|---|---|---|---|---|
| Home Island | cheng.im | Classic summer — today's look, refined | 🍊 | online |
| Maplebury | cheng.sh | Autumn maple — golden turf, red/orange grove, lanterns | 🍐 | online |
| Petalbrook | misthois.cn | Sakura spring — petal pond, stone paths, white museum | 🍎 | online |
| Bitgrove | kleos.cn | Bamboo zen — jade turf, 01 stone tablet, stepping-stone pond | 🍑 | online |
| Noveo Island | noveo.cn | Construction site — dirt patches, scaffold, cones | 🍒 | delayed |

## Architecture (approved: fully separate scene modules)

**Shared kit** — extracted from today's `island.ts` / `buildings.ts` into
`src/three/kit/`, parameterized by a theme object: terrain mesh builder, sea
shader, sand/paths, trees, flowers, clouds, pier, seaplane, gulls, butterflies,
and the building set (house / museum / notice board with per-island roof and
accent colors).

**Untouched shared systems** — `engine.ts`, `controls.ts`, `interactions.ts`,
`villager.ts`, `interiors.ts` (structure shared; tinted per island, see below).

**UI theming** — `uiKit.ts`'s palette `C` becomes settable via
`setUiTheme(palette)`; each island skins panels/HUD/dialogs without UI code
changes. Camera-anchored UI rules (depthTest, renderOrder 900) stay as-is.

**Per-island scene modules** — `src/three/islands/{home,maplebury,petalbrook,bitgrove,noveo}.ts`.
Each exports `buildIslandWorld(kit) → IslandBuild` (the existing `IslandBuild`
interface unchanged: group, walkSurface, colliders, points, clouds, foam,
flames, waves, sea, butterflies, gulls, seaplane, extraWalkSurfaces, walkZones).
Each module freely composes kit pieces: own terrain shape, building placement,
signature flora/props, palette. `engine.ts` picks the module via a static
import map keyed on `SITE.id`.

**Content layer** — `src/content/{home,maplebury,petalbrook,bitgrove,noveo}.ts`
plus `src/content/index.ts` which re-exports the module matching `SITE.id`.
Contract per island:

```ts
profile    // name, role, greeting, links
exhibits   // { title, summary, url, date?, kind: 'project'|'post'|'note'|'log' }[]
locations  // house/museum/board names + hints (rethemeable per island)
```

`exhibits` generalizes today's `projects`; the museum placard UI stays generic
and data-driven. Home keeps the 3 current GitHub projects. Maplebury exhibits
blog posts, Petalbrook notes/fragments, Bitgrove bilingual learning records,
Noveo "under construction" placeholders. Non-home entries are realistic
placeholders, clearly marked, one file per island for the user to fill later.

**site.ts** shrinks to federation metadata (id, name, host, url, nativeFruit,
status) — theme and content move to the island modules.

## Per-island visual designs (approved)

### Home Island (cheng.im)
- Layout unchanged: cross paths, central plaza, house north, museum east,
  notice board west, pier + seaplane south.
- Sky: day #7ec4ec / dusk #f2a35e / night #1d2b53; turf #79c24f.
- UI wood: warm oak + cream (current).
- Polish only: denser flora, cleaner path edges.

### Maplebury (cheng.sh)
- Museum nested in a red/orange maple grove (north); house west; lantern-lit
  reading benches east (lanterns glow at night); winding diagonal path.
- Sky: day #e8b96a / dusk #d96b3b / night #23204a; turf #c9a258 (golden).
- Flora: pear trees, maple grove, falling-leaf particles.
- UI wood: dark walnut #5a3d22 + amber trim.
- Museum rethemed "The Reading Room".

### Petalbrook (misthois.cn)
- Sakura row along the north stone path; petal pond west (petals float on
  water); house east; white-painted museum; light stone paths; pier south-west.
- Sky: day #a8d8f0 / dusk #e8b7d4 / night #2a2547; turf #9ed67c.
- Flora: apple trees, sakura, drifting petal particles.
- UI wood: white painted wood #fdfaf2 + pink trim.

### Bitgrove (kleos.cn)
- Bamboo grove wall west; grey stone paths; stone tablet engraved 01 as plaza
  centerpiece; teal pond with stepping stones; stone lanterns glow at night;
  house north-east; museum east.
- Sky: day #a8ccd4 / dusk #e0a45e / night #141c2c; turf #6fae7d (jade).
- Flora: peach trees, bamboo (gentle sway).
- UI wood: dark lacquer #2e2420 + vermilion seal accent.
- Museum rethemed "藏经阁 / Archive".

### Noveo Island (noveo.cn)
- Muted lavender turf, bare dirt patches, scaffold poles on the museum, cones
  along the path, cherry saplings only, notice board reads "opening soon".
- Sky: day #9aa3b5 / dusk #c99a6b / night #252636; turf #a89ec2.
- UI wood: raw plywood #cbb98f + hazard yellow accents.
- Stays DELAYED on flight boards; still gets a working build.

## Shared-system details (approved)

- **Interiors** — shared `buildInterior` structure; per-island UI wood tone +
  one accent tint (wall/rug). No new interior geometry.
- **Day/night** — existing real-time lerp logic unchanged; palette stops
  (sky/light/sea tint) come from the island theme.
- **Flight board** — destination rows show island name, native fruit, and a
  palette chip; flyby transition tints toward the destination's sky.
- **Particles** — per-island ambient touches: maple leaves (Maplebury), sakura
  petals (Petalbrook), bamboo sway (Bitgrove), dust motes (Noveo), butterflies
  (Home).

## Verification (approved)

- `scripts/verify.mjs` gains a site matrix: build each of the 5 modes
  (`--mode chengsh` etc.) and run the existing suite (zero console errors,
  walk/E/enter/exit interiors, exhibit placard, pier + flight board, day/night
  lerp) against each; screenshots to `test-shots/<island>/`.
- `pnpm build` and `pnpm typecheck` green throughout.
- Visual pass of every route per island before shipping (AGENTS.md convention).

## Gotchas to preserve (from AGENTS.md)

- troika needs TTF (not woff2); keep `src/types/troika-three-text.d.ts`.
- Draw icons as geometry/image planes — Baloo 2 lacks ★/emoji glyphs.
- Click priority: `Controls.pickUi` raycasts 3D UI first.
- Dispose dialog content on route change (`clearDialog`).
- Keep `window.__engine` in App.tsx for the Playwright suite.
- Door interact points must sit OUTSIDE building colliders (+ body radius 0.42).
