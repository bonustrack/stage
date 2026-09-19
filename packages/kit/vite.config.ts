import { defineConfig, transformWithEsbuild, type Plugin } from 'vite';

const WEB_FIRST = ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'];
const JSX_IN_PLAIN_JS = /node_modules\/(react-native-markdown-display|expo-[a-z-]+)\/.*\.js$/;

function jsxInPlainJs(): Plugin {
  return {
    name: 'kit-jsx-in-plain-js',
    enforce: 'pre',
    async transform(code, id) {
      if (!JSX_IN_PLAIN_JS.test(id)) return null;
      const { code: transformed } = await transformWithEsbuild(code, id, { loader: 'jsx', jsx: 'automatic' });
      return transformed;
    },
  };
}

export default defineConfig({
  root: 'gallery',
  plugins: [jsxInPlainJs()],
  build: { outDir: '../build', emptyOutDir: true },
  define: { __DEV__: 'true', global: 'globalThis', 'process.env.NODE_ENV': '"development"' },
  resolve: {
    alias: { 'react-native': 'react-native-web' },
    extensions: WEB_FIRST,
  },
  server: { fs: { allow: ['../../..'] }, port: 6006 },
  optimizeDeps: {
    esbuildOptions: { loader: { '.js': 'jsx' }, resolveExtensions: WEB_FIRST },
  },
});
