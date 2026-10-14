import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        myntmore: {
          primary: '#1a1a2e',
          secondary: '#16213e',
          accent: '#0f3460',
          gold: '#e9c46a',
          light: '#f1f1f1',
        },
      },
    },
  },
  plugins: [],
}
export default config