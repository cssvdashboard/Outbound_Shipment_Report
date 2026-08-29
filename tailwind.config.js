/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef8ff',
          100: '#d8eeff',
          200: '#b9e0ff',
          300: '#89ccff',
          400: '#52adff',
          500: '#2b8aff',
          600: '#1467f5',
          700: '#0d50e1',
          800: '#1141b6',
          900: '#143b8f',
          950: '#0c2256',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glass-light': '0 8px 32px 0 rgba(31, 38, 135, 0.08)',
        'glow': '0 0 25px -5px rgba(59, 130, 246, 0.5)',
        'glow-emerald': '0 0 25px -5px rgba(16, 185, 129, 0.5)',
        'glow-amber': '0 0 25px -5px rgba(245, 158, 11, 0.5)',
        'glow-rose': '0 0 25px -5px rgba(244, 63, 94, 0.5)',
      }
    },
  },
  plugins: [],
}
