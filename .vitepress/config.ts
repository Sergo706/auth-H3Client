import { defineConfig } from 'vitepress'
import typedocSidebar from '../docs/api/typedoc-sidebar.json'

function flattenSidebar(sidebar: any[]) {
  const moduleNameMap: Record<string, string> = {
    'client-h3v1': 'H3 v1',
    'client-h3v2': 'H3 v2',
    'shared': 'Shared Utils',
    'client': 'Client (Nuxt)'
  };
  
  return sidebar.map((module: any) => {
    let moduleName = module.text;
    if (moduleNameMap[moduleName]) {
      moduleName = moduleNameMap[moduleName];
    }

    const methodsAndClasses: any[] = []; 
    const types: any[] = [];


    const scan = (items: any[]) => {
      if (!items) return;
      for (const item of items) {
        if (['Functions', 'Variables', 'Classes'].includes(item.text)) {

          if (item.items) {
             methodsAndClasses.push(...processItems(item.items));
          }

        } else if (['Interfaces', 'Type Aliases'].includes(item.text)) {

           if (item.items) {
             types.push(...processItems(item.items));
           }
        } else {

          if (item.items) {
            scan(item.items);
          }
        }
      }
    };


    const processItems = (items: any[]) => {
      return items.map((item: any) => {
          let link = item.link;
          if (link) {
            const parts = link.split('/');
            const filename = parts[parts.length - 1]; 
            const basename = filename.replace(/\.md$/, '');
            link = `/api/${basename}`;
          }
          return { text: item.text, link };
      });
    };

    if (module.items) {
      scan(module.items);
    }
    
    methodsAndClasses.sort((a, b) => a.text.localeCompare(b.text));
    types.sort((a, b) => a.text.localeCompare(b.text));

    return {
      text: moduleName,
      collapsed: true, 
      items: [
        { text: 'Methods & Classes', collapsed: true, items: methodsAndClasses },
        { text: 'Types', collapsed: true, items: types }
      ]
    };
  });
}

const flatSidebar = flattenSidebar(typedocSidebar);

export default defineConfig({
  title: 'auth-H3Client',
  description: 'H3 middleware and utilities for authentication',
  srcDir: 'docs',  
  outDir: '.vitepress/dist',
  cleanUrls: true,
  lang: 'en-US',
  lastUpdated: true,
  ignoreDeadLinks: [
    /^\.\.?\//, 
  ],
  
  themeConfig: {
    siteTitle: 'auth-H3Client',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Getting Started', link: '/api/index' },
      { text: 'Features', link: '/features' },
      {
        text: 'Guides',
        items: [
          { text: 'Nuxt Module', link: '/module' },
          { text: 'Configuration', link: '/configuration' },
          { text: 'H3 v1 vs v2', link: '/h3-v1-v2' },
          { text: 'Token Rotation', link: '/token-rotation' },
          { text: 'OAuth', link: '/oauth' },
          { text: 'MFA Flows', link: '/mfa-flow/overview' }
        ]
      },
      { text: 'API Reference', link: '/api/client-h3v1.src.main.Function.appendResponseHeader' }
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Introduction', link: '/api/index' },
          { text: 'Features', link: '/features' },
          {
              text: 'Nuxt Modules',
              collapsed: false,
              items: [
                { text: 'Usage', link: '/module' },
                { text: 'Config Templates', link: '/templates' },
              ]
          },
          { text: 'Configuration', link: '/configuration' },
          { text: 'H3 v1 vs v2', link: '/h3-v1-v2' },
          { text: 'Routes & Controllers', link: '/routes-and-controllers' }
        ]
      },
      {
        text: 'Authentication',
        items: [
          { text: 'Token Rotation', link: '/token-rotation' },
          { text: 'CSRF & Visitor', link: '/csrf-and-visitor' },
          { text: 'OAuth', link: '/oauth' },
          { text: 'Server-to-Server', link: '/server-to-server' },
          { text: 'Client-Side', link: '/client' },
          { text: 'Logging & Errors', link: '/logging-and-errors' }
        ]
      },
      {
        text: 'MFA Flows',
        collapsed: false,
        items: [
          { text: 'Overview', link: '/mfa-flow/overview' },
          { text: 'Built-in Flow', link: '/mfa-flow/built-in-flow' },
          { text: 'Custom Flow', link: '/mfa-flow/custom-flow' },
          { text: 'API Reference', link: '/mfa-flow/api-reference' },
          { text: 'Security', link: '/mfa-flow/security-considerations' }
        ]
      },
      {
        text: 'Handler Wrappers',
        collapsed: true,
        items: [
          { text: 'defineAuthenticatedEventHandler', link: '/wrappers/defineAuthenticatedEventHandler' },
          { text: 'defineOptionalAuth', link: '/wrappers/defineOptionalAuth' },
          { text: 'authenticatedPostHandler', link: '/wrappers/authenticatedPostHandler' },
          { text: 'defineVerifiedCsrfHandler', link: '/wrappers/csrfVerifier' },
          { text: 'getAuthStatus', link: '/wrappers/getAuthStatus' },
          { text: 'getCachedUserData', link: '/wrappers/getCachedUserData' },
          { text: 'defineDeduplicatedEventHandler', link: '/wrappers/defineDeduplicatedEventHandler' }
        ]
      },
      {
        text: 'API Reference',
        collapsed: true,
        items: flatSidebar
      }
    ],

    search: { provider: 'local' },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Sergo706/auth-H3Client' }
    ],

    editLink: {
      pattern: 'https://github.com/Sergo706/auth-H3Client/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: '© 2025–present Sergio'
    }
  },
})
