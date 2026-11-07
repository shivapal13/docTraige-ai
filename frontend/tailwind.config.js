/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#070a12',
          900: '#0c111d',
          850: '#101625',
          800: '#161f33',
          700: '#222f4c',
          600: '#334155',
        },
        clinical: {
          stat: '#ef4444',
          'stat-bg': 'rgba(239, 68, 68, 0.12)',
          'stat-border': 'rgba(239, 68, 68, 0.35)',
          urgent: '#f59e0b',
          'urgent-bg': 'rgba(245, 158, 11, 0.12)',
          'urgent-border': 'rgba(245, 158, 11, 0.35)',
          routine: '#10b981',
          'routine-bg': 'rgba(16, 185, 129, 0.10)',
          'routine-border': 'rgba(16, 185, 129, 0.25)',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'SF Mono', 'Menlo', 'monospace'],
        sans: ['Plus Jakarta Sans', 'Inter', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
