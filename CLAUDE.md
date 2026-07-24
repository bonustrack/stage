# Stage — monorepo guide for Claude

Stage is an XMTP messenger with multi-account support, Snapshot profiles, group channels, and an onchain wallet (assets, balances, Railgun shielded transfers). The product bet is a privacy super app where **agents are contacts**.

It ships **one universal Expo app** (`apps/stage`) serving **android, ios, and web** from the same React Native codebase (web via react-native-web), built on a framework-agnostic TS core (`packages/client`), a design-system kit (`packages/kit`), and a Cloudflare Worker (`apps/proxy`). Tooling: **Bun 1.3.9** (exact) + Turbo, **Node >=22**.

## Repo layout

| Path | Package | What it is |
|---|---|---|
| `apps/stage` | `stage` | THE app: Expo + React Native 0.81 (new arch), expo-router, all three platforms. Classic RN structure: `app/` (file routes), `components/` (kit-JSX screens + colocated `*.model.ts` pure models), `lib/` (state + SDK orchestration), `platform/` (the only per-platform code, via Metro `.native.ts`/`.web.ts` resolution), `test/` (pure-model tests). Runs Railgun on-device via embedded Node (mobile only). |
| `packages/client` | `@stage-labs/client` | Framework- AND runtime-agnostic TS core. XMTP content/codecs/cores, accounts/zerodev, Railgun wire protocol, wallet, read-only APIs, profile/identity. No React/RN imports, no build step. |
| `packages/kit` | `@stage-labs/kit` | Design system: tokens, theme, icons, layout, and ONE React Native component family (renders on web via RNW). Plain component library — no renderer, no build step. |
| `packages/config` | `@stage-labs/config` | Publishable ESLint/TS/knip/madge presets + the `stage` CLI (`bin/stage.js`) driven by root `stage.config.js`. |
| `apps/proxy` | — | Cloudflare Worker: link-preview / image-resize / x402 proxy + the bundler.stage.box per-branch manifest proxy. Routes on proxy.stage.box and bundler.stage.box (metro.box is retired — never reference it). |

There is no separate web app: the Vue client (`apps/ui`) and the kit Vue renderer family were removed when `apps/stage` became universal. **The parity invariant is retired** — a screen exists once. The JSON widget dialect (`KitRenderer`/`ViewHost`, `WidgetNode`, node registry) is also retired — all UI, including chat message content, is direct kit JSX.

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
- **Web scroll architecture:** page scrollables full-bleed to the window and span its full height so the native scrollbar reads as a window scrollbar (`WEB_EDGE_SCROLL`/`WEB_STACK_SCROLL` + centered `WEB_EDGE_CONTENT` in `components/layout`, all `{}` off web); chrome floats above, clamped to `100vw - var(--stage-sbw)` so it never covers the scrollbar gutter, and the effective theme drives CSS `color-scheme` so native scrollbars match light/dark.
- **Env vars must be read as literal `process.env.EXPO_PUBLIC_X` member expressions** (see `lib/zerodev/env.ts` RAW_ENV pattern) — dynamic `process.env[name]` defeats the Expo inliner on web.
- **Models are colocated with components:** presentation logic lives in pure `*.model.ts` files next to the component that consumes them (`components/ChannelRow.model.ts`, `components/settings/WalletSettings.model.ts`, ...). Framework-free — no React imports — and unit-tested in `test/` (`*.spec.ts`). Display helpers in `lib/format.ts`; platform effects (navigate/back/copy/toast/confirm/openUrl/share) go through `lib/capabilities.ts`.
- **UI composition — everything is direct kit JSX:** state hook -> colocated model -> kit components (shared chrome in `components/chrome/` — ScreenHeader/StackHeader/OverlayHeader/EmptyState — plus domain families like `components/settings/rows.tsx`, `components/wallet/widgets.tsx`). Chat message content (poll cards, media cards, link previews, voice/video, message bubbles) is JSX too, in `components/MessengerBubble.*` and friends.
- expo-router file routes in `app/`; `_layout.tsx` imports `lib/jsPolyfills` + `lib/cryptoShim` FIRST (order matters). Hand-rolled stores (`lib/storeCore.ts`, `lib/persistedStore.ts` over `platform/storage`) + react-query. App variants via `APP_VARIANT` (prod = Stage/stage.box, dev = dev.stage.box). The metro.box domain is retired — never use it for endpoints or config; the string survives only as frozen XMTP content-type authority IDs.

### Shared core (`packages/client`)
- No build step; subpath exports + `src/index.ts` barrel are the public API (`zerodev/*` deliberately not in the barrel). Pure functions + plain interfaces, no classes/default exports. Boundary validation via `validate.ts` (zod). Always decode XMTP content WITH a zod schema (`decodeJsonContent(bytes, schema)`).
- Domains: `xmtp` (codecs, humanize, builders, line routing, and the orchestration cores: `channelsFilter`, `channelsCache` incl. `applyInbound`, `summarizeRow`, `clientErrors`, `envelope`, `groups`), `accounts`+`zerodev`, `railgun` (host-injected dispatch — method-name strings must stay in sync with the host bridge), `wallet` (incl. `txSimulate`, `txDecode`, `prices`), `api` (incl. `github`), `profile/identity/stamp/embed`, `x402`.

### Kit (`packages/kit`)
- Plain design-system component library: ONE component family (`src/react-native/*`, renders on web via RNW) + shared style cores (`text.styles.ts`, `button.styles.ts`, `control.styles.ts`, `layout.ts` surfaces, `badge.ts`, `icons.ts`, `tokens.ts` incl. the `Scheme`/`Color` helpers). Consumed via subpath exports (`@stage-labs/kit/tokens`, `@stage-labs/kit/react-native/button`, ...).
- Theming: preference contract (`theme.ts`), runtime context (`react-native/theme-context.tsx`), custom-palette deriver (`theme-derive.ts`, LEGACY short-circuit guarded by tests).
- On mobile the Railgun host is embedded Node (`apps/stage/nodejs-assets/nodejs-project/`).

## Conventions

- **Commits:** Conventional Commits `type(scope): subject (#NNN)`, lowercase imperative. Trailer required: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Commit/push only when asked; branch first if on `main`.
- **NO COMMENTS IN CODE** — `comments/no-comments` bans non-directive comments across `.ts/.tsx/.js` including config files AND test files (the built config spreads COMMENT_RULES into the test block). Express intent in names/types. Markdown is exempt.
- **No TS escape hatches:** no-explicit-any, no-non-null-assertion, ban-ts-comment are errors; `noUncheckedIndexedAccess` is on — null-guard, never assert.
- **Single quotes**; max 400 lines/file, 100 lines/function, cyclomatic complexity <= 10.
- **Kit-only UI:** build screens from kit primitives in JSX fed by colocated `*.model.ts` models, not raw RN style objects; `usePalette`/`useEffectiveColorScheme` for the few native-styled shells.
- **No circular deps** (madge) and **no unused files/deps/exports** (knip). New workspace => `stage.config.js` entry + `madge.roots`.
- Snapshot-bearing test files are `*.spec.ts` (bun writes `*.test.ts.snap` files that the `**/*.test.*` lint glob would pick up and always fail). The remaining snapshot suites live in `packages/kit/test/` (button/layout/theme-derive); `apps/stage/test/` is pure-model tests only.

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
- Button taxonomy: `color` x `solid/soft/outline/ghost` only. The legacy `primary/secondary/danger` variant union is gone entirely (it died with the JSON widget boundary) — don't reintroduce it.
- `theme.ts` setters call the persist helper; don't mutate display state directly.

## Key paths

| Path | Why |
|---|---|
| `stage.config.js` + `packages/config/bin/stage.js` | THE central tooling config + CLI |
| `apps/stage/app.config.js` + `eas.json` | Expo config (variants, web output single, plugins/permissions) + EAS profiles |
| `apps/stage/metro.config.js` | node-core polyfills, web native-stubs, monorepo resolution, nodejs-assets blockList |
| `apps/stage/platform/*` | the platform seams (storage contracts + impls) |
| `apps/stage/lib/xmtp.*.web.ts` | the web XMTP adapter family |
| `apps/stage/components/*` | kit-JSX screens/UI + colocated `*.model.ts` pure models |
| `apps/stage/components/chrome/*` | shared JSX screen chrome (headers, empty state) |
| `apps/stage/lib/capabilities.ts` | platform-effects contract (navigate/copy/toast/share/...) |
| `apps/stage/app/_layout.tsx` | root providers, polyfill order, font patch |
| `packages/kit/src/react-native/*` | THE kit component family |
| `packages/kit/src/tokens.ts` + `{theme,theme-derive}.ts` | tokens + colour helpers + theming |
| `packages/client/package.json` + `src/index.ts` | public API surface + barrel |
| `packages/client/src/xmtp/*` | codecs + orchestration cores |
| `packages/client/src/validate.ts` | parseOrThrow/parseOrNull boundary helpers |
| `netlify.toml` | universal web deploy + COOP/COEP headers |
| `.github/workflows/_ci.yml` | the 6 gates |
| `README.md` | monorepo layout, commands, CI gate order |
