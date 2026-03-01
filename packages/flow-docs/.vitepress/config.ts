import { defineConfig } from 'vitepress'

export default defineConfig({
  title: '@quantum-studios/flow',
  description: 'Headless node editor for React — Canvas-based, TypeScript-first',
  themeConfig: {
    nav: [
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Guide', link: '/guide/concepts' },
      { text: 'API', link: '/api/hooks' },
      { text: 'Examples', link: '/examples/minimal' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Core Concepts', link: '/guide/concepts' },
            { text: 'FlowCanvas', link: '/guide/flow-canvas' },
            { text: 'React Hooks', link: '/guide/react-hooks' },
            { text: 'Clipboard', link: '/guide/clipboard' },
            { text: 'Context Provider', link: '/guide/context-provider' },
            { text: 'Advanced', link: '/guide/advanced' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Hooks', link: '/api/hooks' },
            { text: 'Types', link: '/api/types' },
            { text: 'Components', link: '/api/components' },
            { text: 'Model', link: '/api/model' },
          ],
        },
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Minimal', link: '/examples/minimal' },
            { text: 'Full Editor', link: '/examples/full-editor' },
            { text: 'Playground', link: '/examples/playground' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Sterll/Quantum-Flow-Lib' },
    ],
    search: {
      provider: 'local',
    },
  },
})
