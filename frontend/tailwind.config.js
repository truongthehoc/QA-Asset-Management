/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Mulish"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        canvas: '#F4F6F9',
        surface: '#FFFFFF',
        rail: '#006E96',
        ink: {
          primary: '#0F172A',
          secondary: '#475569',
          muted: '#64748B',
        },
        brand: {
          DEFAULT: '#006E96',
          hover: '#005A7A',
          soft: '#E6F4F9',
        },
        line: '#DFE4EC',
      },
    },
  },
  plugins: [],
};
