/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/panel/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        precious: {
          bg: '#0a1612',
          surface: '#112820',
          emerald: '#0d3b2e',
          'emerald-light': '#1a5c45',
          gold: '#d4a853',
          'gold-dim': '#a67c2e',
          text: '#e8f0ec',
          muted: '#8aab9a',
        },
      },
      fontFamily: {
        display: ['Cinzel', 'serif'],
        body: ['Source Sans 3', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
