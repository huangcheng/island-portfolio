/**
 * Federation config — the "islandverse". One codebase, one island per VPS.
 * Selected at build time via VITE_SITE (default: chengim).
 */

export interface SisterIsland {
  id: string;
  name: string;
  host: string;
  url: string;
  theme: string;
  nativeFruit: string;
  status: 'online' | 'delayed';
}

/** Every island in the archipelago. */
export const ISLANDS: SisterIsland[] = [
  { id: 'chengim', name: 'Home Island', host: 'cheng.im', url: 'https://cheng.im', theme: 'Main island · portfolio', nativeFruit: '🍊', status: 'online' },
  { id: 'chengsh', name: 'Blog Island', host: 'cheng.sh', url: 'https://cheng.sh', theme: 'Posts & articles', nativeFruit: '🍐', status: 'online' },
  { id: 'misthois', name: 'Notes Island', host: 'misthois.cn', url: 'https://misthois.cn', theme: 'Notes & essays', nativeFruit: '🍎', status: 'online' },
  { id: 'kleos', name: 'ZeroOne Island', host: 'kleos.cn', url: 'https://kleos.cn', theme: '零壹集 · learning records', nativeFruit: '🍑', status: 'online' },
  // Under police review — shown as DELAYED on the flight board, not clickable.
  { id: 'noveo', name: 'Noveo Island', host: 'noveo.cn', url: 'https://noveo.cn', theme: 'Under construction', nativeFruit: '🍒', status: 'delayed' },
];

const siteId = (import.meta.env.VITE_SITE as string | undefined) ?? 'chengim';

/** The island THIS build serves. */
export const SITE: SisterIsland = ISLANDS.find((i) => i.id === siteId) ?? ISLANDS[0];

/** Sister islands shown on the flight board (everyone except us). */
export const DESTINATIONS: SisterIsland[] = ISLANDS.filter((i) => i.id !== SITE.id);
