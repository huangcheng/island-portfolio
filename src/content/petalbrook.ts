import type { IslandContent } from './types';

// PLACEHOLDER exhibits — replace with real notes from misthois.cn.
const content: IslandContent = {
  profile: {
    name: 'HUANG Cheng',
    role: 'Software Engineer',
    greeting:
      'Welcome to Petalbrook! Short notes, fragments and essays — a public notebook of sorts. ' +
      'Wander the gallery, or fly onward to another island.',
    blog: { label: 'misthois.cn', url: 'https://misthois.cn' },
    github: { label: 'github.com/huangcheng', url: 'https://github.com/huangcheng' },
    email: { label: 'cheng@wuhan.dev', url: 'mailto:cheng@wuhan.dev' },
  },
  exhibits: [
    {
      title: 'Placeholder Note One',
      summary: 'TODO: replace with a real note from misthois.cn.',
      url: 'https://misthois.cn',
      kind: 'note',
      date: '2026-01-01',
    },
    {
      title: 'Placeholder Note Two',
      summary: 'TODO: replace with a real note from misthois.cn.',
      url: 'https://misthois.cn',
      kind: 'note',
      date: '2026-01-01',
    },
    {
      title: 'Placeholder Note Three',
      summary: 'TODO: replace with a real note from misthois.cn.',
      url: 'https://misthois.cn',
      kind: 'note',
      date: '2026-01-01',
    },
  ],
  exhibitsSubtitle: 'notes & fragments',
  locations: {
    about: { name: 'My House', route: '/about', hint: 'Enter my house' },
    projects: { name: 'The Gallery', route: '/projects', hint: 'Browse the gallery' },
    contact: { name: 'Notice Board', route: '/contact', hint: 'Read the notice board' },
  },
};

export default content;
