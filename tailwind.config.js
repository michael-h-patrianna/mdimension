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
        'app-bg': '#0F0F1A',
        'panel': {
          bg: '#1A1A2E',
          border: '#2A2A4E',
        },
        'accent': {
          cyan: '#00D4FF',
          magenta: '#FF00FF',
        },
        'text': {
          primary: '#FFFFFF',
          secondary: '#A0A0B0',
        },
        'success': '#00FF88',
        'warning': '#FFD700',
        dark: {
          bg: '#0a0a0a',
          surface: '#1a1a1a',
          border: '#2a2a2a',
          text: {
            primary: '#ffffff',
            secondary: '#a0a0a0',
            tertiary: '#707070',
          },
        },
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
      },
    },
  },
  plugins: [],
}

