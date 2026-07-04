# Stage — monorepo guide for Claude

Stage is an XMTP messenger with multi-account support, Snapshot profiles, group channels, and an onchain wallet (assets, balances, Railgun shielded transfers). The product bet is a privacy super app where **agents are contacts**.

It ships **one universal Expo app** (`apps/stage`) serving **android, ios, and web** from the same React Native codebase (web via react-native-web), built on a framework-agnostic TS core (`packages/client`), a design kit with a JSON widget renderer (`packages/kit`), and a Cloudflare Worker (`apps/proxy`). Tooling: **Bun 1.3.9** (exact) + Turbo, **Node >=22**.

## Repo layout

| Path | Package | What it is |
|---|---|---|
| `apps/stage` | `stage` | THE app: Expo + React Native 0.81 (new arch), expo-router, all three platforms. Contains `views/` (screen models + chat-widget builders, imported as `@views`), `platform/` (the only per-platform code, via Metro `.native.ts`/`.web.ts` resolution), `lib/` (state + SDK orchestration), `components/`, `app/` (routes), `test/` (incl. builder snapshots). Runs Railgun on-device via embedded Node (mobile only). |
| `packages/client` | `@stage-labs/client` | Framework- AND runtime-agnostic TS core. XMTP content/codecs/cores, accounts/zerodev, Railgun wire protocol, wallet, read-only APIs, profile/identity. No React/RN imports, no build step. |
| `packages/kit` | `@stage-labs/kit` | Design system: tokens, theme, icons, layout, ONE React Native component family (renders on web via RNW), and the JSON `KitRenderer`/`ViewHost` (45 node types). No build step. |
| `packages/config` | `@stage-labs/config` | Publishable ESLint/TS/knip/madge presets + the `stage` CLI (`bin/stage.js`) driven by root `stage.config.js`. |
| `apps/proxy` | — | Cloudflare Worker: link-preview / image-resize / x402 proxy. Deploys to preview.metro.box. |

There is no separate web app: the Vue client (`apps/ui`) and the kit Vue renderer family were removed when `apps/stage` became universal. **The parity invariant is retired** — a screen exists once.

## Commands

Run quality commands **from the repo root**; lint/knip/madge/typecheck are centralized in `stage.config.js` + the `stage` CLI.

| Command | What |
|---|---|
| `bun install` | Install workspace (CI uses `--frozen-lockfile`) |
| `bun run lint` / `lint:fix` | `stage lint` over the whole repo |
| `bun run typecheck` | `tsc --noEmit` per workspace |
| `bun run check` | lint + turbo typecheck |
| `bun run build` / `test` | turbo pipelines (test dependsOn build) |
| `bun run knip` / `madge` | unused code / circular deps |
| `bun run served:reset` / `served:drift-check` | served-main maintenance |

Per-app:

| Command | What |
|---|---|
| `bun --cwd apps/stage start` | Expo bundler (Metro) |
| `bun --cwd apps/stage android` / `ios` / `web` | build + run per platform |
| `bun --cwd apps/stage run build:web` | `expo export --platform web` -> `dist/` (Netlify publishes this). NEVER export into the repo tree during local checks — ESLint OOMs on bundles; use a temp dir |
| `bun --cwd apps/stage run typecheck` / `test` | `tsc --noEmit` / `bun test test/` |
| `bun --cwd apps/proxy dev` | `wrangler dev` |

## Architecture

### Universal app (`apps/stage`)
- **One codebase, three platforms.** Web is react-native-web (`app.config.js` web `output: 'single'` — static SSG would execute native imports at build time). Platform divergence lives ONLY in Metro platform extensions: `x.ts` (native/default, typechecked) + `x.web.ts` (web override, identical export surface). A small `Platform.OS === 'web'` check is fine for feature gates (e.g. the Railgun tab is hidden — **the web wallet is public-only by design**).
- **Platform seams:** `platform/storage(.web).ts` (SecureStorage/AppStorage contracts in `platform/types.ts`), and the `lib/xmtp.*.web.ts` family implementing the native modules' surfaces against `@xmtp/browser-sdk` (client/codecs/dbkey/state/types/conv/identity/groups/envelope/attachments/resync/stream/recover). Web variants cross-import each other with explicit `./xmtp.X.web` specifiers. Native-only packages are stubbed for web in `metro.config.js` (`metro.shims/web/native-stub.js`).
- **Env vars must be read as literal `process.env.EXPO_PUBLIC_X` member expressions** (see `lib/zerodev/env.ts` RAW_ENV pattern) — dynamic `process.env[name]` defeats the Expo inliner on web.
- **Views layer** (`views/`, imported as `@views` via tsconfig paths): pure presenters/models (`channelRowModel`, screen derivations), `format.ts` display helpers, `capabilities.ts` (navigate/back/copy/toast/confirm/openUrl/share contract), and JSON widget-tree builders ONLY for chat/agent message content (pollCard, mediaCard, previewLinkCard, voice/video, messageBubble, highlightText). Framework-free — no React imports. Chat-widget builders are snapshot-tested (`test/*.snapshot.spec.ts`): builder output changes surface as snapshot diffs.
- **UI composition — static screens are direct kit JSX:** state hook -> model from `@views` -> kit components (shared chrome in `components/chrome/` — ScreenHeader/StackHeader/OverlayHeader/EmptyState — plus domain families like `components/settings/rows.tsx`, `components/wallet/widgets.tsx`). Platform effects go through `lib/capabilities.ts`. **`<ViewHost node actions/>` is reserved for runtime-dynamic chat/agent message content** (and the kit gallery demos); do not put new static screens on the JSON path. When replacing a widget with JSX, transliterate the renderer's mapping (`kit-render-node.tsx` + `resolve.ts`) — node props (`color: 'text'`) differ from component props (`role`/`palette`).
- expo-router file routes in `app/`; `_layout.tsx` imports `lib/jsPolyfills` + `lib/cryptoShim` FIRST (order matters). Hand-rolled stores (`lib/storeCore.ts`, `lib/persistedStore.ts` over `platform/storage`) + react-query. App variants via `APP_VARIANT` (prod = Stage/stage.box, dev = metro.box).

### Shared core (`packages/client`)
- No build step; subpath exports + `src/index.ts` barrel are the public API (`zerodev/*` deliberately not in the barrel). Pure functions + plain interfaces, no classes/default exports. Boundary validation via `validate.ts` (zod). Always decode XMTP content WITH a zod schema (`decodeJsonContent(bytes, schema)`).
- Domains: `xmtp` (codecs, humanize, builders, line routing, and the orchestration cores: `channelsFilter`, `channelsCache` incl. `applyInbound`, `summarizeRow`, `clientErrors`, `envelope`, `groups`, `requests-queue`), `accounts`+`zerodev`, `railgun` (host-injected dispatch — method-name strings must stay in sync with the host bridge), `wallet` (incl. `txSimulate`, `txDecode`, `prices`), `api` (incl. `github`), `profile/identity/stamp/embed`, `x402`.

### Kit (`packages/kit`)
- ONE component family (`src/react-native/*`, renders on web via RNW) + shared style cores (`text.styles.ts`, `button.styles.ts`, `control.styles.ts`, `layout.ts` surfaces, `icons.ts`).
- **JSON widget renderer:** `KitRenderer`/`ViewHost` render 45 node types. The registry (`src/kit/node-registry.ts`) is compiler-enforced — adding a node to the `WidgetNode` union without a registry entry is a type error, and `test/node-coverage.spec.ts` asserts the renderer references every type. Unknown types render defensively. Dialect documented in `docs/kit-widget-schema.md`.
- Theming: preference contract (`theme.ts`), runtime context (`react-native/theme-context.tsx`), custom-palette deriver (`theme-derive.ts`, LEGACY short-circuit guarded by tests).
- On mobile the Railgun host is embedded Node (`apps/stage/nodejs-assets/nodejs-project/`).

## Conventions

- **Commits:** Conventional Commits `type(scope): subject (#NNN)`, lowercase imperative. Trailer required: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Commit/push only when asked; branch first if on `main`.
- **NO COMMENTS IN CODE** — `comments/no-comments` bans non-directive comments across `.ts/.tsx/.js` including config files AND test files (the built config spreads COMMENT_RULES into the test block). Express intent in names/types. Markdown is exempt.
- **No TS escape hatches:** no-explicit-any, no-non-null-assertion, ban-ts-comment are errors; `noUncheckedIndexedAccess` is on — null-guard, never assert.
- **Single quotes**; max 400 lines/file, 100 lines/function, cyclomatic complexity <= 10.
- **Kit-only UI:** build screens from kit primitives in JSX fed by `@views` models, not raw RN style objects; ViewHost/JSON only for chat/agent widgets; `usePalette`/`useEffectiveColorScheme` for the few native-styled shells.
- **No circular deps** (madge) and **no unused files/deps/exports** (knip). New workspace => `stage.config.js` entry + `madge.roots`.
- Snapshot-bearing test files are `*.spec.ts` (bun writes `*.test.ts.snap` files that the `**/*.test.*` lint glob would pick up and always fail).

## CI gates (strict order)
`.github/workflows/ci.yml` -> `_ci.yml`: **lint -> typecheck -> knip -> madge -> build -> test** (Bun 1.3.9, frozen lockfile).

## Gotchas / footguns

- **Netlify base must point at `apps/stage`** (set in Netlify UI); `netlify.toml` builds `bun run build:web` and publishes `dist`. Headers: COOP same-origin + **COEP credentialless** (deliberate — keeps SharedArrayBuffer for XMTP wasm while cross-origin avatars/IPFS load). Don't change to require-corp.
- **`patches/nodejs-mobile-react-native@18.20.4.patch`** is required for the mobile build (STL/AGP8/BigInt fixes). EAS node pinned 18.20.4. Native module changes need a fresh dev-client build; a JS reload is not enough.
- Embedded Node host install via `apps/stage/scripts/install-nodejs-project.js`; `metro.config.js` blockLists `nodejs-assets`.
- **Mobile releases are version-driven** (`apps/stage/package.json` version bump triggers `release-stage.yml`; iOS continue-on-error). EAS free tier has a monthly build cap. Every push to every branch publishes a JS-OTA dev-client preview (`pr-preview.yml`; the "Preview" commit status carries the deep link).
- **`served-main`** must stay content-identical to `main` (drift allowlist deliberately empty).
- `@stage-labs/config` publishes via `publish-config.yml` under the `beta` dist-tag; bump its version first. Its Vue lint preset remains for external consumers behind optional peers (`eslint-plugin-vue`/`vue-eslint-parser` are knip-ignored).
- The 3 passkey tests hit live Base RPC and can time out in sandboxes; they pass in CI.
- Button taxonomy: JSX uses `color` x `solid/soft/outline/ghost` only (legacy `primary/secondary/danger` variants are type errors on the component). The legacy union survives solely at the JSON widget boundary — `resolveModel` in `button.styles.ts` still maps it so agent-sent widgets keep rendering; don't narrow its signature.
- `theme.ts` setters call the persist helper; don't mutate display state directly.

## Key paths

| Path | Why |
|---|---|
| `stage.config.js` + `packages/config/bin/stage.js` | THE central tooling config + CLI |
| `apps/stage/app.config.js` + `eas.json` | Expo config (variants, web output single, plugins/permissions) + EAS profiles |
| `apps/stage/metro.config.js` | node-core polyfills, web native-stubs, monorepo resolution, nodejs-assets blockList |
| `apps/stage/platform/*` | the platform seams (storage contracts + impls) |
| `apps/stage/lib/xmtp.*.web.ts` | the web XMTP adapter family |
| `apps/stage/views/*` | models/presenters, capabilities, chat-widget builders (`@views`) |
| `apps/stage/components/chrome/*` | shared JSX screen chrome (headers, empty state) |
| `apps/stage/test/*.snapshot.spec.ts` | chat-widget builder snapshot suite |
| `apps/stage/app/_layout.tsx` | root providers, polyfill order, font patch |
| `packages/kit/src/kit/node-registry.ts` | canonical node-type registry (compiler-enforced) |
| `packages/kit/src/react-native/{kit-renderer,view-host}.tsx` | the JSON renderer + host |
| `packages/kit/src/tokens.ts` + `{theme,theme-derive}.ts` | tokens + theming |
| `packages/client/package.json` + `src/index.ts` | public API surface + barrel |
| `packages/client/src/xmtp/*` | codecs + orchestration cores |
| `packages/client/src/validate.ts` | parseOrThrow/parseOrNull boundary helpers |
| `netlify.toml` | universal web deploy + COOP/COEP headers |
| `.github/workflows/_ci.yml` | the 6 gates |
| `docs/kit-widget-schema.md` | the widget JSON dialect |
| `README.md` | monorepo layout, commands, CI gate order |
