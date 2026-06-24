# Stage — monorepo guide for Claude

Stage is an XMTP messenger with multi-account support, Snapshot profiles, group channels, and an onchain wallet (assets, balances, Railgun shielded transfers). The product bet is a privacy super app where **agents are contacts**.

It ships **two clients kept visually + functionally parallel**: a Vue 3 web app (`apps/ui`) and an Expo/React Native mobile app (`apps/app`), built on a shared framework-agnostic TS core (`packages/client`), a shared design kit (`packages/kit`), and a Cloudflare Worker (`apps/proxy`). Tooling: **Bun 1.3.9** (exact) + Turbo, **Node >=22**.

## Repo layout

| Path | Package | What it is |
|---|---|---|
| `packages/client` | `@stage-labs/client` | Framework- AND runtime-agnostic TS core. XMTP content, accounts/zerodev, Railgun wire protocol, wallet, read-only APIs, profile/identity. No Vue/React/RN, no build step. |
| `packages/kit` | `@stage-labs/kit` | Design system: tokens, theme, icons, layout + two parallel renderer families (`react-native/*.tsx`, `vue/*.vue`). No build step. |
| `packages/config` | `@stage-labs/config` | Publishable, repo-agnostic ESLint/TS/knip/madge presets + the `stage` CLI (`bin/stage.js`) that reads `stage.config.js` and drives lint/knip/madge/typecheck for the whole repo. |
| `apps/app` | — | Expo + React Native 0.81 mobile client (new arch). Runs Railgun on-device via embedded Node. |
| `apps/ui` | — | Vue 3 + Vite 6 web client. Public-only wallet. Deploys to stage.box (Netlify). |
| `apps/proxy` | — | Cloudflare Worker: link-preview / image-resize / x402 proxy. Deploys to preview.metro.box. |

Both clients import platform-neutral logic from `@stage-labs/client` (deep subpaths) and UI primitives from `@stage-labs/kit`, consumed via `workspace:*`. `apps/ui/src/views/*` mirrors `apps/app/app/*` ~1:1.

## Commands

Run quality commands **from the repo root**. Lint/knip/madge/typecheck are centralized: each is a thin npm script delegating to the `stage` CLI from `@stage-labs/config`, which reads the single root `stage.config.js`.

| Command | What |
|---|---|
| `bun install` | Install workspace (CI uses `bun install --frozen-lockfile`) |
| `bun run lint` | `stage lint` — builds an ESLint flat config from `stage.config.js` and runs `eslint .` over the whole repo |
| `bun run lint:fix` | `stage lint --fix` |
| `bun run typecheck` | `stage typecheck` — runs `tsc`/`vue-tsc --noEmit -p <ws>/tsconfig.json` per workspace |
| `bun run check` | `bun run lint && turbo run typecheck` |
| `bun run build` | `turbo run build` |
| `bun run test` | `turbo run test` (test dependsOn build) |
| `bun run knip` | `stage knip` — unused files/deps/exports |
| `bun run madge` | `stage madge` — circular-dependency check across the `madge.roots` in `stage.config.js` |
| `bun run report:deps` | madge + knip, non-failing |
| `bun run served:reset` | reset `served-main` to `origin/main` (`--dry-run/--yes/--push`) |
| `bun run served:drift-check` | check `served-main` drift |
| `bun run worktree:prune` | clean stale `.claude/worktrees` |

Per-app:

| Command | What |
|---|---|
| `bun --cwd apps/ui dev` | Vue/Vite dev server (port 5173, HMR) |
| `bun --cwd apps/ui run build` | `vue-tsc --noEmit` then `vite build` -> `dist/` |
| `bun --cwd apps/app start` | Expo bundler (also called "Metro" — naming collision) |
| `bun --cwd apps/app android` / `ios` / `web` | build + run on target |
| `bun --cwd apps/app run typecheck` / `test` | `tsc --noEmit` / `bun test test/` (lint/knip/madge are root-only via `stage`) |
| `bun --cwd apps/proxy dev` | `wrangler dev` |
| `bunx wrangler deploy` (in apps/proxy) | deploy Worker |

Single client test: `bun test test/codecs.test.ts` (from `packages/client`).

## Architecture

### Shared core (`packages/client`)
- **No build step.** `package.json` `main/types/module` point at `./src/index.ts`; every export maps to raw `.ts`. Consumers (Vite/Metro) transpile TS directly. There is no `dist/`.
- **Runtime-agnostic:** no Vue/React/RN imports, and no bare `process`/`window` (code runs in Hermes). Use `readEnv()` from `api/env.ts`.
- **Subpath exports are the public API.** Adding a module means updating BOTH `package.json` exports AND (usually) `src/index.ts`. Exception: `zerodev/*` is intentionally NOT in the barrel — import via `@stage-labs/client/zerodev/*`.
- **Pure functions + plain interfaces**, no default exports, no classes. State modules expose `subscribe/ensure/get` accessors.
- **Boundary validation** in `validate.ts` (`parseOrThrow`/`parseOrNull` wrap zod). Each wire type pairs `x.ts` with `x.schema.ts` (sign, tx, poll).
- Domains: `xmtp` (codecs, humanize, builders, polls, sign/tx requests, `line.ts` metro:// routing), `accounts`+`zerodev` (ERC-4337 smart accounts, key derivation), `railgun` (private-tx wire protocol), `wallet` (viem clients, balances, sends), `api` (ENS/Etherscan/OpenSea/CoinGecko), `profile/identity/stamp/embed`, `x402`.

### XMTP content layer
- Custom content types (poll, signatureRequest, signatureReference under `metro.box`; walletSendCalls/transactionReference under `xmtp.org`) are encoded/decoded as UTF-8 JSON via `codecs.ts`. **No versioned migration** — always decode WITH a zod schema (`decodeJsonContent(bytes, schema)`) or wire drift is silently miscast (the codecs test asserts drift must throw).
- `humanizeGroupUpdated` handles two field-name shapes (SDK payloads vary) — keep both fallbacks.

### Railgun (host-injected dispatch)
- The package only produces typed calls + method-name registries (`ENGINE_OPS`/`SDK_METHODS`/`COMPOSITE_OPS`); the actual SDK runs **out-of-process** behind a host-supplied `RailgunDispatch`. Method-name strings must stay in sync with the host bridge.
- On mobile, that host is an embedded Node.js (`nodejs-mobile-react-native`) under `apps/app/nodejs-assets/nodejs-project/` (main.js, engine.js, sdkDispatch.js).

### Kit theming (3 distinct pieces)
1. **Preference contract** (`src/theme.ts`): `ThemePreference = 'light'|'dark'|'system'`, `THEME_STORAGE_KEY='app.theme'`. Resolving `'system'` to a concrete scheme is the **app's** job (`apps/ui/src/lib/kitTheme.ts`).
2. **Runtime theme context** (two parallel impls kept structurally identical by hand): `src/react-native/theme-context.tsx` and `src/vue/theme-context.ts` (`useKitPalette`/`useKitScheme`).
3. **Custom-theme deriver** (`src/theme-derive.ts`): `derivePalette(seed)`; short-circuits to a hardcoded LEGACY palette when seed equals `DEFAULT_SEED` (`assertDefaultLossless` guards it).
- `dark` is an **explicit prop** on components, separate from context. Vue defaults it: `props.dark ?? scheme === 'dark'`. RN/Vue renderers must keep prop-API parity (RN render-props -> Vue slots; RN callbacks -> Vue emits/v-model). Never reimplement token/layout/icon/style logic in a renderer — import from core (`../tokens`, `../button.styles`, ...).

### apps/ui (Vue web)
- vue-router 4 with `createWebHashHistory` (hash URLs — matters for static/iframe hosting). `/` -> `/channels`. Only 3 tab routes (channels, contacts, wallet) show the TabBar; everything else is full-screen (mirrors mobile).
- **No Vuex/Pinia.** State = module-scoped reactive singletons in `src/lib/*` exposed via composables. `@tanstack/vue-query` is used in only ~3 places — NOT the data layer.
- Thin view + paired `src/lib/useXxx.ts` returning a typed State interface. XMTP runs in-browser via `@xmtp/browser-sdk`.
- Theming wired two ways that must stay in sync: App.vue provides `KitThemeKey` for kit components AND `theme.ts` toggles `.dark` on `<html>` for Tailwind. Tailwind colors come from the shared `metro` palette in `@stage-labs/kit/tokens`.
- Kit components auto-registered globally via Vite tag resolver; Vue+vue-router APIs and `src/lib` auto-imported via unplugin-auto-import.

### apps/app (Expo mobile)
- expo-router file-based routing in `app/`. Root `_layout.tsx` wraps `KitThemeProvider > QueryClientProvider > GestureHandlerRootView > KeyboardProvider`, then a custom swipe stack. Single `(tabs)` group; everything else is pushed.
- **No global state lib.** Hand-rolled subscribe/notify stores (`lib/storeCore.ts`, `lib/persistedStore.ts` backed by AsyncStorage) + react-query. XMTP client/caches are module-level singletons in `lib/xmtp.state.ts`. Secrets/keys/account list use `expo-secure-store`.
- UI built from `@stage-labs/kit/react-native/*` primitives, NOT raw RN components. No styling framework — inline styles via `usePalette`/`useEffectiveColorScheme`/`useRadius` (`lib/theme.ts`).
- App variants via `APP_VARIANT`: prod = Stage (host stage.box) vs dev = box.metro.monitor (host metro.box).

### apps/proxy (Worker)
- Single `src/index.ts` fetch handler. Endpoints: `GET /health`, `GET /preview?url=` (requires header `x-stage-client: 1` else 403), `GET /img?url=&w=`, `POST /x402-settle`. All else 404.
- Every outbound fetch (and each redirect Location) goes through `assertPublicUrl` (`src/ssrf.ts`) for SSRF defense. Uses `@stage-labs/client/x402` for challenge parsing.

## Conventions

- **Commits:** Conventional Commits with REQUIRED scope and PR-number suffix: `type(scope): subject (#NNN)`. Types: feat, fix, chore, docs. Scopes: workspace/area (ui, kit, ci). Subjects lowercase imperative. Web work matching mobile is tagged `(mobile parity)` in the subject.
- **Commit trailer (required):** `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. PR bodies end with the Claude Code footer. Commit/push only when asked; branch first if on `main`.
- **NO COMMENTS IN CODE** — a custom `comments/no-comments` ESLint rule bans all non-directive comments across `.ts/.tsx/.vue` AND `.js/.mjs/.cjs` (config files included), auto-fixable so they get stripped on `lint:fix`. Express intent in names/types. Only functional directives survive (`eslint*`, `@ts-*`, triple-slash, prettier-ignore, globals). Comments are allowed in `test/**`. The only sanctioned inline comment is the `<!-- kit-exception: … -->` HTML comment in Vue templates. Markdown (this file, READMEs) is exempt.
- **No TS escape hatches:** `no-explicit-any`, `no-non-null-assertion`, `ban-ts-comment` are errors. `@ts-expect-error` needs a >=10-char description. `noUncheckedIndexedAccess` is on — array/record access is `T | undefined`, so null-guard, never assert.
- **Single quotes** (`avoidEscape`) across JS/TS/Vue.
- **Size caps:** max 400 lines/file, max 100 lines/function, cyclomatic complexity <= 10. Split early.
- **Kit-only UI (Vue):** templates MUST use `@stage-labs/kit/vue/*` (Box/Row/Col/Scroll/Text/Title/Button/Icon/Input/Card). Raw `<div>/<button>/<input>/<textarea>/<select>/<h1-6>` are ESLint-banned. `<Row>` for flex rows, `<Col>` for columns/stacks, `<Scroll>` for overflow — never `<Box direction=...>`. Do not import removed local layout/HeroIcon components.
- **Sanctioned native exceptions (Vue):** rendered via `<component :is="'input'|'textarea'|'div'">` and MUST carry an `<!-- kit-exception: … -->` comment (file inputs, auto-grow composer, inline-edit, ref-measured scroll viewport).
- **Kit-only UI (RN):** use kit RN primitives + `components/layout` Box/Col/Row with ChatKit layout params (align/justify/gap/padding/background/radius/sizing), not raw style objects.
- **No circular deps** (madge) and **no unused files/deps/exports** (knip). Adding a workspace requires adding an entry under `workspaces` in `stage.config.js` (picking a `type` preset + knip `entry`/`project`) and, for madge coverage, listing its source root under `madge.roots`.
- File naming: Vue views/components PascalCase `.vue`; lib helpers camelCase `.ts`; RN screens lowercase (expo-router). Kit Vue SFCs are PascalCase files but kebab-case subpath exports.

### THE PARITY INVARIANT
Web (`apps/ui`) and mobile (`apps/app`) are kept visually + functionally parallel. When adding a web feature that exists on mobile, mirror the mobile screen's structure/UX and tag the commit `(mobile parity)`. Documented exception: **the web wallet is public-only by design** — do NOT port shielded/Railgun (private) transfer UI to web.

## CI gates (strict order)
`.github/workflows/ci.yml` -> `_ci.yml`, on push to `main` and all PRs, Bun 1.3.9 + frozen lockfile:

**lint -> typecheck -> knip -> madge -> build -> test**

A failure at any step stops the rest. Turbo: `test` dependsOn `build`; `build` dependsOn `^build`.

## Gotchas / footguns

- **Lint/knip/madge/typecheck are centralized in `stage.config.js` + the `stage` CLI** — there is NO root `eslint.config.mjs`, no `knip.config.js`, no `scripts/madge.mjs`, no `tsconfig.eslint.json` (all removed). The `stage` CLI builds the configs in-memory from `stage.config.js`. New workspace -> add a `workspaces['<path>']` entry (`type` preset + knip globs) and a `madge.roots` entry. Flat config is still order-sensitive (later overrides earlier).
- **Per-workspace lint nuances live next to the workspace**, re-exported as functions and injected in `stage.config.js`: `apps/app/eslint.js` (`reactNative`), `apps/ui/eslint.js` (`uiKitOnly(vuePlugin)`, the kit-only Vue rules), `packages/kit/eslint.js` (`kitEslint`). The Vue/RN presets are parametric — they don't bundle their toolchains, so `stage.config.js` passes in `vueParser`/`vuePlugin`.
- **`packages/client` and `packages/kit` ship raw `.ts`/`.vue` source** — a new file is invisible to consumers until a subpath export is added to `package.json` AND it's re-exported from the index barrel.
- **Netlify base = `apps/ui`** (set in Netlify UI, not `netlify.toml`); build/publish resolve relative to it. A `--filter ./apps/ui` attempt failed (resolved to `apps/ui/apps/ui`). Headers set COOP=same-origin + **COEP=credentialless** (not require-corp — deliberate, so cross-origin avatars/IPFS load while keeping SharedArrayBuffer for XMTP). Don't change to require-corp.
- **`patches/nodejs-mobile-react-native@18.20.4.patch`** (repo root, applied via Bun `patchedDependencies`) is required for the mobile build. It forces `DoesAppAlreadyDefineWantedSTL()` true (else a conflicting NDK libc++ crashes XMTP's Rust MLS lib at `XMTP.create`), adds AGP8 namespace/manifest fixes, and BigInt JSON tagging for the Node bridge. Don't drop it.
- **EAS node is pinned to 18.20.4** to match nodejs-mobile — don't bump casually. Native module changes require a fresh dev-client/APK build; a JS reload is not enough.
- The embedded Node host gets its own install + post-processing via `apps/app/scripts/install-nodejs-project.js` (prunes symlink/dot/underscore dirs the Android asset bundler can't handle; rewrites `\p{...}` unicode regexes). `metro.config.js` blockLists `nodejs-assets`.
- `apps/app/_layout.tsx` imports `lib/jsPolyfills` and `lib/cryptoShim` FIRST — order matters. Default font is forced by monkey-patching Text/TextInput defaultProps.
- **Mobile releases are version-driven:** bump `apps/app/package.json` version to trigger `release-stage.yml` (iOS step is continue-on-error). EAS free tier has a monthly build cap.
- **`served-main`** is a long-lived branch the RN bundler serves for hot-reload; it must stay content-identical to `main` (drift allowlist in `served-drift-check.sh` is intentionally EMPTY). Don't commit served-only overrides.
- `@stage-labs/config` is published via `publish-config.yml` always under the `beta` dist-tag; bump its `package.json` version before publishing (npm refuses to republish).
- `apps/ui` has **no test runner / no tests** — verification is type-check + manual run. `theme.ts` setters call the persist helper; don't mutate `display.value` directly.
- Two button taxonomies coexist (legacy `primary/secondary/ghost/danger` vs `color` x `solid/soft/outline/ghost`); `resolveModel` disambiguates only when `color` is unset.

## Key paths

| Path | Why |
|---|---|
| `package.json` | root scripts, workspaces, `bun@1.3.9`, node>=22, patchedDependencies |
| `turbo.json` | build/test pipeline |
| `stage.config.js` | THE central tooling config — per-workspace lint/knip presets + `madge.roots`; consumed by the `stage` CLI |
| `packages/config/bin/stage.js` | the `stage` CLI (lint/knip/madge/typecheck subcommands) |
| `apps/{app,ui}/eslint.js`, `packages/kit/eslint.js` | per-workspace lint rule modules injected into `stage.config.js` |
| `packages/config/{eslint,knip,madge,tsconfig}/*` | the building-block presets |
| `netlify.toml` | web deploy config + COOP/COEP headers |
| `.github/workflows/_ci.yml` | the 6 gates |
| `patches/nodejs-mobile-react-native@18.20.4.patch` | critical mobile STL/AGP/BigInt patch |
| `packages/client/package.json` + `src/index.ts` | authoritative public API surface + barrel |
| `packages/client/src/validate.ts` | parseOrThrow/parseOrNull boundary helpers |
| `packages/client/src/xmtp/{codecs,humanize,builders,line}.ts` | XMTP content seam + metro:// routing |
| `packages/client/src/railgun/*` | private-tx wire protocol + host-dispatch contract |
| `packages/client/src/{accounts,zerodev,wallet,api}/*` | accounts/keys, smart accounts, balances/sends, external clients |
| `packages/kit/package.json` | subpath export map (root, /tokens, /theme*, /icons, /react-native/*, /vue/*) |
| `packages/kit/src/tokens.ts` | colors, semanticColors, FONT_SIZE, scales, fontFamily |
| `packages/kit/src/{theme,theme-derive}.ts` | preference contract + custom palette deriver |
| `packages/kit/src/{react-native/theme-context.tsx,vue/theme-context.ts}` | parallel runtime theme contexts |
| `packages/config/eslint/{base,vue,single}.js` | no-comments plugin, size/complexity caps, NO_ESCAPE_HATCHES, quotes, Vue kit-only rules |
| `packages/config/tsconfig/{base,react-native,vue}.json` | strict TS bases each `tsconfig.json` extends |
| `apps/ui/src/{main.ts,App.vue,router.ts}` | entry, theme provide, hash routes |
| `apps/ui/vite.config.ts` | kit tag resolver, auto-import, `@` alias |
| `apps/ui/src/lib/{theme,kitTheme,xmtp}.ts` | theme singleton, system-scheme resolve, XMTP browser glue |
| `apps/ui/README.md` | kit-only enforcement + exceptions + public-only wallet policy |
| `apps/app/app.config.js` + `eas.json` | Expo config (variants/plugins/permissions) + EAS profiles |
| `apps/app/metro.config.js` | node-core polyfills, shims, monorepo resolution, nodejs-assets blockList |
| `apps/app/app/_layout.tsx` | root providers, gates, polyfill order, font patch |
| `apps/app/lib/` + `apps/app/modules/messaging/` | xmtp/wallet/state modules + XMTP facade |
| `apps/app/nodejs-assets/nodejs-project/` | on-device Node host running Railgun engine |
| `apps/proxy/src/{index,ssrf,x402}.ts` | Worker router + SSRF guard + x402 challenge |
| `apps/proxy/wrangler.toml` | route `preview.metro.box/*` |
| `README.md` | monorepo layout, commands, CI gate order, parity statement |
