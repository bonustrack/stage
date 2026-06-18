import tseslint from 'typescript-eslint';
import vueParser from 'vue-eslint-parser';
import vuePlugin from 'eslint-plugin-vue';
import { vue } from '@stage-labs/config/eslint/vue';

// Rules live in @stage-labs/config/eslint/vue — the shared Vue preset
// (tseslint recommended + max-lines + the Vue flat/recommended overrides),
// unchanged. The parser/plugin are this app's own deps, passed in.
export default tseslint.config(...vue({ vueParser, vuePlugin }));
