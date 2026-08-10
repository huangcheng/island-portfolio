/** Per-island content contract — one module per island implements this. */

export interface Exhibit {
  title: string;
  /** One or two sentences shown on the museum placard. */
  summary: string;
  /** Where the "Open"/"GitHub" button goes. */
  url: string;
  kind: 'project' | 'post' | 'note' | 'log';
  /** Optional extras, shown only when present. */
  date?: string;
  stars?: number;
  stack?: string[];
  /** Custom museum art key (home island's hand-drawn pieces). */
  art?: 'seelie' | 'bridge' | 'solar';
}

export interface IslandContent {
  profile: {
    name: string;
    role: string;
    /** Villager greeting in the About dialog. */
    greeting: string;
    blog: { label: string; url: string };
    github: { label: string; url: string };
    email: { label: string; url: string };
  };
  /** Museum exhibits — interior shows at most 5 frames. */
  exhibits: Exhibit[];
  /** Subtitle line under the museum dialog title. */
  exhibitsSubtitle: string;
  /** Island locations and which route they open. */
  locations: {
    about: { name: string; route: '/about'; hint: string };
    projects: { name: string; route: '/projects'; hint: string };
    contact: { name: string; route: '/contact'; hint: string };
  };
}
