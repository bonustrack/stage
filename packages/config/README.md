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

### Vue project — `vue` (external consumers)

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

## `stage lint`

When the repo has a root `.oxlintrc.json`, `stage lint` runs `oxlint --type-aware` on the whole repo, on the given paths, or on the `--changed` files, and passes the other flags (`--fix`, `-f`, ...) to oxlint. Install `oxlint` and `oxlint-tsgolint` for it, and `eslint` for the `core` plugin. Three JS plugins bring the rules oxlint does not have natively:

- `@stage-labs/config/oxlint/comments`: `comments/no-comments`
- `@stage-labs/config/oxlint/text`: `text/no-em-dash`
- `@stage-labs/config/oxlint/core`: ESLint's own `no-restricted-syntax` and `quotes`, as `core/no-restricted-syntax` and `core/quotes`

```json
{ "jsPlugins": ["@stage-labs/config/oxlint/comments", "@stage-labs/config/oxlint/text", "@stage-labs/config/oxlint/core"] }
```

Without `.oxlintrc.json`, it lints the repo described by `stage.config.js` with ESLint. It runs one ESLint process per TypeScript project (a workspace with a `tsconfig.json`) plus one for the rest, two at a time (`STAGE_LINT_JOBS` changes that), and prints one merged report. Each process holds only the type information of its own project, so the peak memory of one process is the largest project, not the sum. Untracked git-ignored files (build output, generated files) are not linted.

- `stage lint` / `stage lint --fix`: the whole repo.
- `stage lint --changed`: only files changed since the upstream branch (or since HEAD when there is none), plus untracked ones. A type change can create findings in unchanged files, so keep the full lint in CI.
- `stage lint <paths>`: only those paths, in one process.

## `stage typecheck`

Type-checks every workspace of `stage.config.js` that has a `tsconfig.json`, two projects at a time, and prints each project's output when it finishes. It uses `tsgo` (TypeScript 7, from `@typescript/native-preview`) when that is installed, else `tsc`, and `vue-tsc` for Vue workspaces. `stage typecheck --tsc` forces `tsc`. Other flags go to the compiler.

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

- `tsconfig/base.json` — strict base for pure-TS packages, with `types: []` (list the global types a project needs)
- `tsconfig/react-native.json` — layer on top of `expo/tsconfig.base`
- `tsconfig/vue.json` — layer on top of `@vue/tsconfig/tsconfig.dom.json`

`base.json` and `react-native.json` take `lib` from `tsconfig/lib.json`: ES2024, the ESNext parts that TypeScript 5.9 and 7 declare the same way (array, decorators, disposable, error, float16, iterator, promise, shared memory) and the DOM. Plain `ESNext` means more in TypeScript 7 (Temporal, `RegExp.escape`, `Uint8Array` hex and base64, `Map.getOrInsert`, Set methods), so the explicit list keeps `tsc` and `tsgo` on the same APIs.
