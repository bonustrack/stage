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
          'bg-dark': '#0e0f10',
          'bg-light': '#ffffff',
          /** Inputs/surfaces share the border color per the palette spec. */
          'surface-dark': '#282a2d',
          'surface-light': '#e4e4e5',
          'hover-dark': '#1c1d1f',
          'hover-light': '#f2f2f3',
          /** Body / default text */
          'fg-dark': '#9f9fa3',
          'fg-light': '#57606a',
          'sub-dark': '#7a7a7e',
          'sub-light': '#8a929d',
          /** Strong text: headings, links, primary buttons */
          'head-dark': '#ffffff',
          'head-light': '#000000',
          /** Borders */
          'border-dark': '#282a2d',
          'border-light': '#e4e4e5',
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
