/**
 * Federation config — the "islandverse". One codebase, one island per VPS.
 * Selected at build time via VITE_SITE (default: chengim), e.g.:
 *   vite build --mode chengsh        (loads .env.chengsh → VITE_SITE=chengsh)
 */

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

/** Every island in the archipelago. */
export const ISLANDS: SisterIsland[] = [
  { id: 'chengim', name: 'Home Island', host: 'cheng.im', url: 'https://cheng.im',
    theme: 'Main island · portfolio', nativeFruit: '🍊', status: 'online', chip: 0x6ec3f0 },
  { id: 'chengsh', name: 'Maplebury', host: 'cheng.sh', url: 'https://cheng.sh',
    theme: 'Autumn · long-form writing', nativeFruit: '🍐', status: 'online', chip: 0xd97b2f },
  { id: 'misthois', name: 'Petalbrook', host: 'misthois.cn', url: 'https://misthois.cn',
    theme: 'Spring · notes & essays', nativeFruit: '🍎', status: 'online', chip: 0xf4a7c3 },
  { id: 'kleos', name: 'Bitgrove', host: 'kleos.cn', url: 'https://kleos.cn',
    theme: 'Zen · learning records', nativeFruit: '🍑', status: 'online', chip: 0x6fae7d },
  // Under police review — shown as DELAYED on the flight board, not clickable.
  { id: 'noveo', name: 'Noveo Island', host: 'noveo.cn', url: 'https://noveo.cn',
    theme: 'Under construction', nativeFruit: '🍒', status: 'delayed', chip: 0x9a8fb8 },
];

const siteId = (import.meta.env.VITE_SITE as string | undefined) ?? 'chengim';

/** The island THIS build serves. */
export const SITE: SisterIsland = ISLANDS.find((i) => i.id === siteId) ?? ISLANDS[0];

/** Sister islands shown on the flight board (everyone except us). */
export const DESTINATIONS: SisterIsland[] = ISLANDS.filter((i) => i.id !== SITE.id);
