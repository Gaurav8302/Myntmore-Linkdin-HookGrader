import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class', // never auto-apply OS dark mode
  theme: {
    extend: {
      colors: {
        myntmore: {
          ink: '#0a0a0a',
          body: '#3d3d3d',
          muted: '#5f5f5f',
          line: '#ebe4d8',
          soft: '#f4f4f4',
          canvas: '#ffffff',
          yellow: '#ffc247',
          yellowHover: '#f0b020',
          yellowSoft: '#fff6e0',
          success: '#15803d',
          danger: '#b91c1c',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 1px 2px rgba(10,10,10,0.04), 0 8px 24px rgba(10,10,10,0.06)',
      },
    },
  },
  plugins: [],
}
export default config
