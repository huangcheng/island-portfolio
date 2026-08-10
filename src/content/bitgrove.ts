import type { IslandContent } from './types';

// PLACEHOLDER exhibits — replace with real learning records from kleos.cn.
const content: IslandContent = {
  profile: {
    name: 'HUANG Cheng',
    role: 'Software Engineer',
    greeting:
      'Welcome to Bitgrove (ZeroOne Island)! Learning records and project logs — ' +
      'little by little, everything adds up.',
    blog: { label: 'kleos.cn', url: 'https://kleos.cn' },
    github: { label: 'github.com/huangcheng', url: 'https://github.com/huangcheng' },
    email: { label: 'cheng@wuhan.dev', url: 'mailto:cheng@wuhan.dev' },
  },
  exhibits: [
    {
      title: 'Placeholder Log One',
      summary: 'TODO: replace with a real learning record from kleos.cn.',
      url: 'https://kleos.cn',
      kind: 'log',
      date: '2026-01-01',
    },
    {
      title: 'Placeholder Log Two',
      summary: 'TODO: replace with a real learning record from kleos.cn.',
      url: 'https://kleos.cn',
      kind: 'log',
      date: '2026-01-01',
    },
    {
      title: 'Placeholder Log Three',
      summary: 'TODO: replace with a real learning record from kleos.cn.',
      url: 'https://kleos.cn',
      kind: 'log',
      date: '2026-01-01',
    },
  ],
  exhibitsSubtitle: 'learning records',
  locations: {
    about: { name: 'My House', route: '/about', hint: 'Enter my house' },
    projects: { name: 'The Archive', route: '/projects', hint: 'Browse the archive' },
    contact: { name: 'Notice Board', route: '/contact', hint: 'Read the notice board' },
  },
};

export default content;
