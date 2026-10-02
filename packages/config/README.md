# @stage-labs/config

Shared lint, TypeScript, knip and madge presets and the `stage` CLI. Generic and repo-agnostic, so any repo can use the same rules and `tsconfig` bases.

It ships the **generic building blocks only**. Repo-specific topology (monorepo scoping, knip workspaces, per-app/per-package rules) stays in the consuming repo, in its `stage.config.js` and `.oxlintrc.json`.

## Install

```sh
bun add -D @stage-labs/config oxlint oxlint-tsgolint eslint typescript
```

`eslint` is needed only for the `core` oxlint plugin. Version 0.1.0-beta.3 removed the ESLint presets (`eslint/base`, `eslint/single`, `eslint/vue`), the ESLint mode of `stage lint` and the Vue presets: stay on 0.1.0-beta.2 to keep them.

## `stage lint`

`stage lint` runs `oxlint --type-aware` with the root `.oxlintrc.json` on the whole repo, on the given paths, or on the `--changed` files, and passes the other flags (`--fix`, `-f`, ...) to oxlint. It stops with an error when there is no `.oxlintrc.json`. Three JS plugins bring the rules oxlint does not have natively:

- `@stage-labs/config/oxlint/comments`: `comments/no-comments`
- `@stage-labs/config/oxlint/text`: `text/no-em-dash`
- `@stage-labs/config/oxlint/core`: ESLint's own `no-restricted-syntax` and `quotes`, as `core/no-restricted-syntax` and `core/quotes`

```json
{ "jsPlugins": ["@stage-labs/config/oxlint/comments", "@stage-labs/config/oxlint/text", "@stage-labs/config/oxlint/core"] }
```

- `stage lint` / `stage lint --fix`: the whole repo.
- `stage lint --changed`: only files changed since the upstream branch (or since HEAD when there is none), plus untracked ones. A type change can create findings in unchanged files, so keep the full lint in CI.
- `stage lint <paths>`: only those paths.

## `stage typecheck`

Type-checks every workspace of `stage.config.js` that has a `tsconfig.json`, two projects at a time, and prints each project's output when it finishes. It uses `tsgo` (TypeScript 7, from `@typescript/native-preview`) when that is installed, else `tsc`. `stage typecheck --tsc` forces `tsc`. Other flags go to the compiler.

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

- `tsconfig/base.json`: strict base for pure-TS packages, with `types: []` (list the global types a project needs)
- `tsconfig/react-native.json`: layer on top of `expo/tsconfig.base`

`base.json` and `react-native.json` take `lib` from `tsconfig/lib.json`: ES2024, the ESNext parts that TypeScript 5.9 and 7 declare the same way (array, decorators, disposable, error, float16, iterator, promise, shared memory) and the DOM. Plain `ESNext` means more in TypeScript 7 (Temporal, `RegExp.escape`, `Uint8Array` hex and base64, `Map.getOrInsert`, Set methods), so the explicit list keeps `tsc` and `tsgo` on the same APIs. These lib names need TypeScript 5.9 or later.
