import type { IslandTheme } from '../theme';
import type { IslandBuild } from '../kit/types';
import { SITE } from '../../site';
import * as home from './home';
import * as maplebury from './maplebury';
import * as petalbrook from './petalbrook';
import * as bitgrove from './bitgrove';
import * as noveo from './noveo';

export interface IslandModule {
  theme: IslandTheme;
  build: () => IslandBuild;
}

const BY_SITE: Record<string, IslandModule> = {
  chengim: home,
  chengsh: maplebury,
  misthois: petalbrook,
  kleos: bitgrove,
  noveo,
};

/** The island this build serves. */
export const ACTIVE: IslandModule = BY_SITE[SITE.id] ?? home;
