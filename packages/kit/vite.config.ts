import { defineConfig, transformWithEsbuild, type Plugin } from 'vite';
import { KIT_CATALOG } from './src/a2ui/kit-catalog';

const KIT_CATALOG_FILE = 'a2ui/v1_0/catalog.json';

function publishKitCatalog(): Plugin {
  const source = `${JSON.stringify(KIT_CATALOG, null, 2)}\n`;
  return {
    name: 'kit-a2ui-catalog',
    configureServer(server) {
      server.middlewares.use(`/${KIT_CATALOG_FILE}`, (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(source);
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: KIT_CATALOG_FILE, source });
    },
  };
}

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
  plugins: [jsxInPlainJs(), publishKitCatalog()],
  build: { outDir: '../build', emptyOutDir: true },
  define: { __DEV__: 'true', global: 'globalThis', 'process.env.NODE_ENV': '"development"', 'process.env.EXPO_OS': '"web"' },
  resolve: { alias: { 'react-native': 'react-native-web' }, extensions: WEB_FIRST },
  server: { fs: { allow: ['../../..'] }, port: 6006 },
  optimizeDeps: { esbuildOptions: { loader: { '.js': 'jsx' }, resolveExtensions: WEB_FIRST } },
});
