import { SITE } from '../site';
import type { IslandContent } from './types';
import home from './home';
import maplebury from './maplebury';
import petalbrook from './petalbrook';
import bitgrove from './bitgrove';
import noveo from './noveo';

const ALL: Record<string, IslandContent> = { home, maplebury, petalbrook, bitgrove, noveo };
// Legacy island ids -> content modules (site.ts ids predate the rename).
const BY_SITE: Record<string, IslandContent> = {
  chengim: home,
  chengsh: maplebury,
  misthois: petalbrook,
  kleos: bitgrove,
  noveo,
};

const content = BY_SITE[SITE.id] ?? ALL.home;

export const profile = content.profile;
export const exhibits = content.exhibits;
export const exhibitsSubtitle = content.exhibitsSubtitle;
export const locations = content.locations;
export type { Exhibit } from './types';
