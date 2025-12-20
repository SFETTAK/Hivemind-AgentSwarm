/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'hive-dark': '#0a0e14',
        'hive-card': '#131920',
        'hive-hover': '#1a2332',
        'hive-cyan': '#00d4ff',
        'hive-green': '#00ff88',
        'hive-yellow': '#ffcc00',
        'hive-red': '#ff4757',
        'hive-purple': '#a855f7',
        'hive-border': '#27272a',
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'monospace'],
        'display': ['Orbitron', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

