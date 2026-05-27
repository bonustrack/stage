import type { Config } from 'tailwindcss';
import { colors as metro, fontFamily } from '@stage-labs/metro-kit/tokens';

/** The `metro.*` palette + font stacks come from @stage-labs/metro-kit so the */
/** React Native app (apps/app) and this web shell share one source of truth. */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: { metro },
      fontFamily: {
        sans: [...fontFamily.sans],
        head: [...fontFamily.head],
        mono: [...fontFamily.mono],
      },
    },
  },
  plugins: [],
};

export default config;
