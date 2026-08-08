/**
 * Portfolio content — edit this file to change what the island says.
 */

export const profile = {
  name: 'HUANG Cheng',
  /** Shown under the name in dialogs. */
  role: 'Software Engineer',
  /** Villager greeting shown in the About dialog. Edit freely! */
  greeting:
    "Hi there! I'm Cheng — I build things with TypeScript, Rust, C++ and Python. " +
    'I like desktop pets, AI agents, note-taking tools and little widgets that make computers feel alive. ' +
    'Welcome to my island!',
  blog: { label: 'cheng.im', url: 'https://cheng.im' },
  github: { label: 'github.com/huangcheng', url: 'https://github.com/huangcheng' },
  /** Placeholder — replace with your real address. */
  email: { label: 'hi@cheng.im', url: 'mailto:hi@cheng.im' },
};

export interface Project {
  repo: string;
  title: string;
  emoji: string;
  tagline: string;
  stack: string[];
  stars: number;
}

export const projects: Project[] = [
  {
    repo: 'https://github.com/huangcheng/Seelie',
    title: 'Seelie',
    emoji: '🐾',
    tagline:
      'Native Qt6/C++ desktop pet that reacts to AI coding tool events (Claude Code, Codex, OpenCode).',
    stack: ['C++', 'Qt6'],
    stars: 1,
  },
  {
    repo: 'https://github.com/huangcheng/obsidian-notes-bridge',
    title: 'Obsidian Notes Bridge',
    emoji: '🌉',
    tagline:
      'Obsidian plugin that exports notes as portable Markdown and bridges your vault with Bear, WPS Cloud Note, Youdao Note, flomo, Yinxiang, WeKnora and IMA.',
    stack: ['TypeScript', 'Obsidian'],
    stars: 1,
  },
  {
    repo: 'https://github.com/huangcheng/solar-system',
    title: 'Solar System',
    emoji: '🌍',
    tagline:
      'Tiny desktop Earth globe widget for Windows — real-time day/night, flat-map mode, and a growing solar-system view.',
    stack: ['C++', 'Qt6'],
    stars: 0,
  },
];

/** Island locations and which route they open. */
export const locations = {
  about: { name: 'My House', route: '/about', hint: 'Enter my house' },
  projects: { name: 'Museum', route: '/projects', hint: 'Explore the museum' },
  contact: { name: 'Notice Board', route: '/contact', hint: 'Read the notice board' },
} as const;
