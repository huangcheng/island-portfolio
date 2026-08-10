import type { IslandContent } from './types';

const content: IslandContent = {
  profile: {
    name: 'HUANG Cheng',
    role: 'Software Engineer',
    greeting:
      "Hi there! I'm Cheng — I build things with TypeScript, Rust, C++ and Python. " +
      'I like desktop pets, AI agents, note-taking tools and little widgets that make computers feel alive. ' +
      'Welcome to my island!',
    blog: { label: 'cheng.im', url: 'https://cheng.im' },
    github: { label: 'github.com/huangcheng', url: 'https://github.com/huangcheng' },
    email: { label: 'cheng@wuhan.dev', url: 'mailto:cheng@wuhan.dev' },
  },
  exhibits: [
    {
      title: 'Seelie',
      summary:
        'Native Qt6/C++ desktop pet that reacts to AI coding tool events (Claude Code, Codex, OpenCode).',
      url: 'https://github.com/huangcheng/Seelie',
      kind: 'project',
      stars: 1,
      stack: ['C++', 'Qt6'],
      art: 'seelie',
    },
    {
      title: 'Obsidian Notes Bridge',
      summary:
        'Obsidian plugin that exports notes as portable Markdown and bridges your vault with Bear, WPS Cloud Note, Youdao Note, flomo, Yinxiang, WeKnora and IMA.',
      url: 'https://github.com/huangcheng/obsidian-notes-bridge',
      kind: 'project',
      stars: 1,
      stack: ['TypeScript', 'Obsidian'],
      art: 'bridge',
    },
    {
      title: 'Solar System',
      summary:
        'Tiny desktop Earth globe widget for Windows — real-time day/night, flat-map mode, and a growing solar-system view.',
      url: 'https://github.com/huangcheng/solar-system',
      kind: 'project',
      stars: 0,
      stack: ['C++', 'Qt6'],
      art: 'solar',
    },
  ],
  exhibitsSubtitle: 'github.com/huangcheng',
  locations: {
    about: { name: 'My House', route: '/about', hint: 'Enter my house' },
    projects: { name: 'Museum', route: '/projects', hint: 'Explore the museum' },
    contact: { name: 'Notice Board', route: '/contact', hint: 'Read the notice board' },
  },
};

export default content;
