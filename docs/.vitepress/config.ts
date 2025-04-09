import { defineConfig } from 'vitepress'
import { buildDocsSidebar } from './sidebar-generator'

export default defineConfig({
  base: '/portapack/',
  title: 'PortaPack',
  description: 'Bundle & Minify HTML into a Single Portable File',
  appearance: 'dark',
  lastUpdated: true,
  
  head: [
    ['link', { rel: 'icon', href: '/favicon.png' }],
    ['meta', { name: 'og:title', content: 'PortaPack' }],
    ['meta', { name: 'og:description', content: 'Bundle & Minify HTML into a Single Portable File' }],
    ['meta', { name: 'og:image', content: '/og-image.png' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }]
  ],

  themeConfig: {
    logo: '/logo.png',
    
    socialLinks: [
      { icon: 'github', link: 'https://github.com/manicinc/portapack' },
      { icon: 'twitter', link: 'https://twitter.com/manicinc' },
      { icon: 'discord', link: 'https://discord.gg/manicinc' },
      { 
        icon: {
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>'
        }, 
        link: 'https://www.linkedin.com/company/manicinc' 
      }
    ],

    footer: {
      message: 'Released under the MIT License',
      copyright: '© 2025 Manic Agency. All rights reserved.'
    },

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Getting Started', link: '/getting-started' },
      { 
        text: 'Docs', 
        items: [
          { text: 'CLI Reference', link: '/cli' },
          { text: 'API', link: '/api/' },
          { text: 'Configuration', link: '/configuration' },
          { text: 'Advanced Usage', link: '/advanced' }
        ]
      },
      { text: 'Demo', link: '/demo' },
      { text: 'Contributing', link: '/contributing' }
    ],

    sidebar: {
      // Existing sidebars remain the same
      '/getting-started': [ /* ... */ ],
      '/cli': [ /* ... */ ],
      '/configuration': [ /* ... */ ],
      
      // Dynamically load API sidebar
      '/api/': buildDocsSidebar()
    }
  }
})