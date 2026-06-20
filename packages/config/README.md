# @stage-labs/config

Shared ESLint and TypeScript config presets — generic and repo-agnostic, so any repo can consume the same lint rules and `tsconfig` bases.

It ships the **generic building blocks only**. Repo-specific topology (monorepo scoping, knip workspaces, per-app/per-package rules) stays in the consuming repo.

## Install

```sh
bun add -D @stage-labs/config eslint typescript-eslint
# only for the Vue preset:
bun add -D eslint-plugin-vue vue-eslint-parser
```

## ESLint

### Standalone TS package — `single`

The one-line preset for a single (non-monorepo) TypeScript project:

```js
// eslint.config.js
import { single } from "@stage-labs/config/eslint/single";

export default single({ tsconfigRootDir: import.meta.dirname });
```

Options: `{ tsconfigRootDir = process.cwd(), project, files = ["src/**/*.{ts,tsx}"], ignores = [] }`.

### Vue project — `vue`

```js
import { vue } from "@stage-labs/config/eslint/vue";
```

A parametric Vue preset; inject `{ vueParser, vuePlugin, rootDir, project }`.

### Building blocks — `base`

For repos that compose their own config (e.g. a monorepo). Exposes the pieces `single` is built from: `recommended`, `strictTsBlock`, `ignores`, `typeCheckedLanguageOptions`, `commentPlugins`, `COMMENT_RULES`, `NO_ESCAPE_HATCHES`, `FUNCTION_SIZE_RULES`, `MAX_LINES`.

```js
import { recommended, strictTsBlock, ignores } from "@stage-labs/config/eslint/base";

export default [
  ignores(),
  ...recommended,
  strictTsBlock({ tsconfigRootDir: import.meta.dirname }),
];
```

### What the presets enforce

- Type-aware **strict** + stylistic (`typescript-eslint` strict-type-checked + stylistic-type-checked)
- No escape hatches: no `any`, no `@ts-ignore`/`@ts-nocheck`, no non-null assertions
- Single quotes (`avoidEscape` — strings containing `'` may stay double)
- No comments: all `//` and `/* */` comments are banned (only functional `eslint`/`@ts-*`/triple-slash directive comments are allowed) — express intent in code (names, types)
- Size caps: ≤ 400 lines/file, ≤ 100 lines/function, cyclomatic complexity ≤ 10

## madge

Shared options for the circular-dependency check:

```js
import { madgeConfig } from "@stage-labs/config/madge";
```

## TypeScript

Extend the matching `tsconfig` base:

```jsonc
{ "extends": "@stage-labs/config/tsconfig/base.json" }
```

- `tsconfig/base.json` — strict base for pure-TS packages
- `tsconfig/react-native.json` — layer on top of `expo/tsconfig.base`
- `tsconfig/vue.json` — layer on top of `@vue/tsconfig/tsconfig.dom.json`
