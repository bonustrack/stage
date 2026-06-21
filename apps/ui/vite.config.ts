import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import type { ComponentResolver } from 'unplugin-vue-components';
import { fileURLToPath, URL } from 'node:url';

// Globally resolve bare kit component tags (<Box>, <Text>, <Button>, ...) to
// their @stage-labs/kit/vue/* subpath modules so apps/ui templates consume the
// shared kit renderers without per-file imports.
const KIT_VUE_COMPONENTS: Record<string, string> = {
  Box: 'box', Row: 'row', Col: 'col', Scroll: 'scroll', Spacer: 'spacer',
  Text: 'text', Title: 'title', Caption: 'caption', Label: 'label',
  Button: 'button', Pressable: 'pressable', Icon: 'icon', BrandIcon: 'brand-icon',
  Input: 'input', Textarea: 'textarea', Select: 'select', Checkbox: 'checkbox',
  RadioGroup: 'radio-group', Form: 'form', Card: 'card', Divider: 'divider',
  Image: 'image', AvatarView: 'avatar-view', Markdown: 'markdown',
  ListView: 'list-view', ListViewItem: 'list-view-item', FlatList: 'flat-list',
  Table: 'table', TableRow: 'table-row', TableCell: 'table-cell', DatePicker: 'date-picker',
};

function kitVueResolver(): ComponentResolver {
  return {
    type: 'component',
    resolve(name: string) {
      const sub = KIT_VUE_COMPONENTS[name];
      if (sub) return { name: 'default', from: `@stage-labs/kit/vue/${sub}` };
      return undefined;
    },
  };
}

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      imports: ['vue', 'vue-router'],
      dirs: ['src/lib'],
      dts: 'src/auto-imports.d.ts',
      vueTemplate: true,
    }),
    Components({
      dirs: ['src/components'],
      extensions: ['vue'],
      dts: 'src/components.d.ts',
      resolvers: [kitVueResolver()],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { port: 5173, strictPort: false },
});
