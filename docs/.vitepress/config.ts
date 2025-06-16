import { defineConfig, HeadConfig } from 'vitepress';
import { buildDocsSidebar } from './sidebar-generator';

const GA_ID = process.env.VITE_GA_ID;

console.log(`Using Google Analytics ID: ${GA_ID || 'Not set'}`);

const gaHead: HeadConfig[] = GA_ID
  ? [
      [
        'script',
        { async: 'true', src: `https://www.googletagmanager.com/gtag/js?id=${GA_ID}` }
      ],
      [
        'script',
        {},
        `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${GA_ID}');
        `
      ]
    ]
  : [];

export default defineConfig({
  base: '/',
  title: 'PortaPack',
  description: 'Bundle & Minify HTML into a Single Portable File',
  appearance: 'dark',
  lastUpdated: true,

  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['meta', { name: 'og:title', content: 'PortaPack' }],
    ['meta', {
      name: 'og:description',
      content: 'Bundle & Minify HTML into a Single Portable File'
    }],
    ['meta', { name: 'og:image', content: '/portapack.jpg' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ...gaHead
  ],

  themeConfig: {
    logo: '/portapack-transparent.png',

    socialLinks: [
      { icon: 'github', link: 'https://github.com/manicinc/portapack' },
      { icon: 'twitter', link: 'https://x.com/manicagency' },
      { icon: 'discord', link: 'https://discord.gg/DzNgXdYm' },
      {
        icon: {
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>'
        },
        link: 'https://www.linkedin.com/company/manic-agency-llc/'
      }
    ],

    footer: {
      message: 'Released under the MIT License',
      copyright: '© 2025 Manic Agency. All rights reserved.'
    },

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Download', link: '/releases' }, // ADD THIS LINE
      {
        text: 'Docs',
        items: [
          { text: 'CLI Reference', link: '/cli' },
          { text: 'API', link: '/api/README' },
          { text: 'Configuration', link: '/configuration' },
        ]
      },
      { text: 'Contributing', link: '/contributing' },
      { text: 'Architecture', link: '/architecture' },
      { text: 'Roadmap', link: 'roadmap' }
    ],

    sidebar: {
      '/api/': buildDocsSidebar(),
      '/getting-started/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/getting-started/' },
            { text: 'Installation', link: '/getting-started/installation' },
            { text: 'Quick Start', link: '/getting-started/quick-start' }
          ]
        }
      ],
      
      '/cli/': [
        {
          text: 'CLI Guide',
          items: [
            { text: 'Overview', link: '/cli/' },
            { text: 'Commands', link: '/cli/commands' },
            { text: 'Options', link: '/cli/options' }
          ]
        }
      ],
      '/configuration/': [
        {
          text: 'Configuration',
          items: [
            { text: 'Overview', link: '/configuration/' },
            { text: 'Options', link: '/configuration/options' },
            { text: 'Advanced', link: '/configuration/advanced' }
          ]
        }
      ]
    }
  }
});

