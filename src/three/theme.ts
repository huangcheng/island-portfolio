import type { UiPalette } from './uiKit';
import type { BuildingTheme } from './kit/buildings';

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
  /** Day/night sky stops — staged config; consumed once the engine day/night
   *  wiring reads ACTIVE.theme (Task 4). */
  sky: { night: SkyState; dawn: SkyState; day: SkyState; sunset: SkyState; dusk: SkyState };
  /** Ambient drifting particles (petals/leaves/dust) — staged config; consumed
   *  once the engine particle system reads ACTIVE.theme (Task 4). */
  particles: { palette: number[]; count: number };
  /** UI wood skin. */
  ui: Partial<UiPalette>;
  /** Building colors. */
  buildings: BuildingTheme;
  /** Interior tints — staged config; consumed once interiors read ACTIVE.theme
   *  (Task 5). */
  interior: { houseWall: string; rugRing: number; rugCenter: number; museumBg: number };
}
