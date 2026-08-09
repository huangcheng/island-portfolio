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
  /** House roof / accent color per island. */
  roof: number;
  door: number;
  /** Home-dialog greeting for this island. */
  greeting: string;
}

const GREETING_HOME =
  "Hi there! I'm Cheng — I build things with TypeScript, Rust, C++ and Python. " +
  'I like desktop pets, AI agents, note-taking tools and little widgets that make computers feel alive. ' +
  'Welcome to my island!';

/** Every island in the archipelago. */
export const ISLANDS: SisterIsland[] = [
  {
    id: 'chengim', name: 'Home Island', host: 'cheng.im', url: 'https://cheng.im',
    theme: 'Main island · portfolio', nativeFruit: '🍊', status: 'online',
    roof: 0xe2574c, door: 0x6b4f2a, greeting: GREETING_HOME,
  },
  {
    id: 'chengsh', name: 'Blog Island', host: 'cheng.sh', url: 'https://cheng.sh',
    theme: 'Posts & articles', nativeFruit: '🍐', status: 'online',
    roof: 0x4f86c6, door: 0x3a4a5a,
    greeting:
      'Welcome to Blog Island! This is where my longer writing lives — posts, articles and travelogues. ' +
      'Take your time, browse around, and say hi from the notice board.',
  },
  {
    id: 'misthois', name: 'Notes Island', host: 'misthois.cn', url: 'https://misthois.cn',
    theme: 'Notes & essays', nativeFruit: '🍎', status: 'online',
    roof: 0x53a05a, door: 0x4a3520,
    greeting:
      'Welcome to Notes Island! Short notes, fragments and essays — a public notebook of sorts. ' +
      'Wander the museum for projects, or fly onward to another island.',
  },
  {
    id: 'kleos', name: 'ZeroOne Island', host: 'kleos.cn', url: 'https://kleos.cn',
    theme: '零壹集 · learning records', nativeFruit: '🍑', status: 'online',
    roof: 0xf2a541, door: 0x54331a,
    greeting:
      'Welcome to ZeroOne Island (零壹集)! Learning records and project logs — 积微成著, ' +
      'little by little, everything adds up.',
  },
  // Under police review — shown as DELAYED on the flight board, not clickable.
  {
    id: 'noveo', name: 'Noveo Island', host: 'noveo.cn', url: 'https://noveo.cn',
    theme: 'Under construction', nativeFruit: '🍒', status: 'delayed',
    roof: 0x9a8fb8, door: 0x4a3520, greeting: 'This island is still being built. Check back later!',
  },
];

const siteId = (import.meta.env.VITE_SITE as string | undefined) ?? 'chengim';

/** The island THIS build serves. */
export const SITE: SisterIsland = ISLANDS.find((i) => i.id === siteId) ?? ISLANDS[0];

/** Sister islands shown on the flight board (everyone except us). */
export const DESTINATIONS: SisterIsland[] = ISLANDS.filter((i) => i.id !== SITE.id);
