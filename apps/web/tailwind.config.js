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
          bg: '#0d1513',
          surface: '#112820',
          'surface-low': '#161d1b',
          'surface-high': '#242c29',
          emerald: '#0d3b2e',
          'emerald-light': '#1a5c45',
          gold: '#d4a853',
          'gold-bright': '#f2c36b',
          'gold-dim': '#a67c2e',
          text: '#dce4e0',
          muted: '#8aab9a',
          'on-variant': '#d2c5b2',
          outline: '#4e4637',
        },
      },
      fontFamily: {
        display: ['Cinzel', 'serif'],
        body: ['Source Sans 3', 'sans-serif'],
      },
      boxShadow: {
        'emerald-glow': '0 0 20px rgba(13, 59, 46, 0.6)',
        'gold-bloom': '0 0 15px rgba(238, 192, 104, 0.4)',
      },
    },
  },
  plugins: [],
};
