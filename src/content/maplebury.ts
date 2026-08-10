import type { IslandContent } from './types';

// PLACEHOLDER exhibits — replace with real posts from cheng.sh.
const content: IslandContent = {
  profile: {
    name: 'HUANG Cheng',
    role: 'Software Engineer',
    greeting:
      'Welcome to Maplebury! This is where my longer writing lives — posts, articles and travelogues. ' +
      'Take your time, browse around, and say hi from the notice board.',
    blog: { label: 'cheng.sh', url: 'https://cheng.sh' },
    github: { label: 'github.com/huangcheng', url: 'https://github.com/huangcheng' },
    email: { label: 'cheng@wuhan.dev', url: 'mailto:cheng@wuhan.dev' },
  },
  exhibits: [
    {
      title: 'Placeholder Post One',
      summary: 'TODO: replace with a real post from cheng.sh — title, two-sentence summary, and link.',
      url: 'https://cheng.sh',
      kind: 'post',
      date: '2026-01-01',
    },
    {
      title: 'Placeholder Post Two',
      summary: 'TODO: replace with a real post from cheng.sh — title, two-sentence summary, and link.',
      url: 'https://cheng.sh',
      kind: 'post',
      date: '2026-01-01',
    },
    {
      title: 'Placeholder Post Three',
      summary: 'TODO: replace with a real post from cheng.sh — title, two-sentence summary, and link.',
      url: 'https://cheng.sh',
      kind: 'post',
      date: '2026-01-01',
    },
  ],
  exhibitsSubtitle: 'long-form writing',
  locations: {
    about: { name: 'My House', route: '/about', hint: 'Enter my house' },
    projects: { name: 'The Reading Room', route: '/projects', hint: 'Browse the reading room' },
    contact: { name: 'Notice Board', route: '/contact', hint: 'Read the notice board' },
  },
};

export default content;
