import type { Config } from 'tailwindcss';

/** Mirror the React Native app's palette (apps/app/app/index.tsx, components/*.tsx) so the */
/** mobile and web shells look identical in both themes. */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        metro: {
          /** Backgrounds */
          'bg-dark': '#000000',
          'bg-light': '#ffffff',
          'surface-dark': '#161a22',
          'surface-light': '#fafbfd',
          'hover-dark': '#1d2230',
          'hover-light': '#eef1f7',
          /** Foreground / text */
          'fg-dark': '#e8ecf2',
          'fg-light': '#1a1f29',
          'sub-dark': '#8a94a6',
          'sub-light': '#5a6477',
          /** Borders */
          'border-dark': '#262c38',
          'border-light': '#e3e7ef',
          /** Accents */
          accent: '#ffffff',
          'accent-hover': '#cccccc',
          ok: '#83c989',
          warn: '#c0a06e',
          err: '#d96868',
        },
      },
      fontFamily: {
        sans: ['Calibre-Medium', 'system-ui', 'sans-serif'],
        head: ['Calibre-Semibold', 'system-ui', 'sans-serif'],
        mono: ['Menlo', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
