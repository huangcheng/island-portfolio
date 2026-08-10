import type { IslandContent } from './types';

// Noveo is under construction — everything is a placeholder.
const content: IslandContent = {
  profile: {
    name: 'HUANG Cheng',
    role: 'Software Engineer',
    greeting: 'This island is still being built. Check back later!',
    blog: { label: 'noveo.cn', url: 'https://noveo.cn' },
    github: { label: 'github.com/huangcheng', url: 'https://github.com/huangcheng' },
    email: { label: 'cheng@wuhan.dev', url: 'mailto:cheng@wuhan.dev' },
  },
  exhibits: [
    {
      title: 'Coming Soon',
      summary: 'This exhibit is still under construction.',
      url: 'https://noveo.cn',
      kind: 'note',
    },
    {
      title: 'Coming Soon',
      summary: 'This exhibit is still under construction.',
      url: 'https://noveo.cn',
      kind: 'note',
    },
    {
      title: 'Coming Soon',
      summary: 'This exhibit is still under construction.',
      url: 'https://noveo.cn',
      kind: 'note',
    },
  ],
  exhibitsSubtitle: 'under construction',
  locations: {
    about: { name: 'My House', route: '/about', hint: 'Enter my house' },
    projects: { name: 'Museum', route: '/projects', hint: 'Explore the museum' },
    contact: { name: 'Notice Board', route: '/contact', hint: 'Read the notice board' },
  },
};

export default content;
