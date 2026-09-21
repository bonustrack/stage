# Stage — monorepo guide for Claude

Stage is a private, encrypted XMTP messenger with multi-account support, group channels, free onchain names and avatars (`*.stage.base.eth` on Base, read like Basenames), and a ZeroDev smart-account wallet on Base (assets, balances, transfers, passkeys, social recovery). The product bet is a privacy super app where **agents are contacts**.

It ships **one universal Expo app** (`apps/stage`) serving **android, ios, web and desktop** from the same React Native codebase (web via react-native-web), built on a framework-agnostic TS core (`packages/client`), a design-system kit (`packages/kit`), a Cloudflare Worker (`apps/proxy`) and the XMTP push server (`apps/push`). Tooling: **Bun 1.4.0** (exact, the only package manager — no npm/npx, no package-lock.json) + Turbo, **Node >=22**.

## Repo layout

| Path | Package | What it is |
|---|---|---|
| `apps/stage` | `stage` | THE app: Expo + React Native 0.81 (new arch), expo-router, all three platforms. Classic RN structure: `app/` (file routes ONLY — every file under it is a route, so helpers live in `components/`), `components/` (kit-JSX screens + colocated `*.model.ts` pure models, one folder per screen family: `bubble/`, `composer/`, `home/`, `conversation/`, `group/`, `wallet/`, `onboarding/`, `settings/`), `lib/` (state + SDK orchestration; the XMTP seams live here as `xmtp.*.ts` / `.web.ts` / `.core.ts`), `modules/` (`messaging/` facade barrel + the `stage-pill` Android module), `platform/` (storage seams via Metro `.ts`/`.web.ts` resolution), `test/` (pure-model tests). |
| `packages/client` | `@stage-labs/client` | Framework- AND runtime-agnostic TS core. XMTP content/codecs/cores, accounts/zerodev, wallet, read-only APIs, identity (Basenames + stage names), avatar URLs. No React/RN imports, no build step. |
| `packages/kit` | `@stage-labs/kit` | Design system: tokens, theme, icons, layout, and ONE React Native component family (renders on web via RNW). Plain component library — no renderer, no build step. Published to npm (`publish-kit.yml`) and consumed by other codebases: never delete components, tokens or style setup because the app stopped using them. The component gallery is the Vite storybook in `packages/kit/gallery/` (deployed at kit.stage.box); the old in-app Kit page under Settings → Experimental was removed in Sept 2026. |
| `packages/config` | `@stage-labs/config` | Publishable ESLint/TS/knip/madge presets + the `stage` CLI (`bin/stage.js`) driven by root `stage.config.js`. |
| `apps/proxy` | — | Cloudflare Worker on proxy.stage.box: link previews, `/img` resize, x402 challenge + settle, the `/names/*` stage-names service (operator key + KV, server-side label validation), `/xmtp-history/*` and `/xmtp-push/*` relays, plus the bundler.stage.box per-branch manifest proxy. Deployed by `deploy-proxy.yml`. |
| `apps/push` | — | XMTP's reference notification server built from a pinned upstream commit, deployed to Fly as `stage-push` (`deploy-push-server.yml`). Not a Bun workspace — Dockerfile + fly.toml only; see its README. |
| `apps/stage/desktop` | `stage-desktop` | The Electron shell for macOS, Linux and Windows — a nested workspace inside the app (like `modules/stage-pill` is the Android shell), kept as its own package only because electron-builder reads the package.json it packs. Bundles the `expo export --platform web` output (`scripts/export-ui.mjs` -> `web/`, prod variant, rpId stage.box) and serves it from the privileged `stage-app://stage.box` scheme with the same COOP/COEP headers as Netlify, so it works with stage.box down. Adds the native window, menus, `stage://` deep links and macOS camera/mic prompts. `STAGE_DESKTOP_URL=http://localhost:8080` points it at a Metro dev server instead. Self-updates via electron-updater from the GitHub Release `v<version>`; `release-desktop.yml` builds the installers on the same `app.config.js` version bump as the mobile release (see `docs/desktop-release.md`). |

There is no separate web app: the Vue client (`apps/ui`) and the kit Vue renderer family were removed when `apps/stage` became universal. **The parity invariant is retired** — a screen exists once. The JSON widget dialect (`KitRenderer`/`ViewHost`, `WidgetNode`, node registry) is also retired — all UI, including chat message content, is direct kit JSX. Railgun / shielded transfers and the embedded Node host were removed in Sept 2026 — the wallet is public-only; do not reintroduce them.

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
| `bun run --cwd packages/kit storybook` / `storybook:build` | Kit component gallery (hand-rolled Vite page in `packages/kit/gallery/`, stories in `packages/kit/stories/`, one per component with every prop as a control) / static build into `packages/kit/build` |
| `bun run --cwd apps/stage/desktop start` / `dist` | Export the web UI into `apps/stage/desktop/web` and run Electron / build installers into `apps/stage/desktop/release` (run Electron from a plain terminal: editors set `ELECTRON_RUN_AS_NODE`) |

## Architecture

### Universal app (`apps/stage`)
- **One codebase, three platforms.** Web is react-native-web (`app.config.js` web `output: 'single'` — static SSG would execute native imports at build time). Platform divergence lives ONLY in Metro platform extensions: `x.ts` (native/default, typechecked) + `x.web.ts` (web override, identical export surface). A small `Platform.OS === 'web'` check is fine for feature gates.
- **Platform seams:** `platform/storage(.web).ts` (SecureStorage/AppStorage contracts in `platform/types.ts`), and the `lib/xmtp.*.web.ts` family implementing the native modules' surfaces against `@xmtp/browser-sdk` (client/codecs/dbkey/state/types/conv/identity/groups/envelope/attachments/resync/stream/recover). Web variants cross-import each other with explicit `./xmtp.X.web` specifiers. Anything SDK-neutral lives once in a `*.core.ts` next to the pair (`xmtp.send.core`, `xmtp.groups.core`, `xmtp.identity.core`, `xmtp.state.core`, `xmtp.resync.core`, `xmtp.signing.core`, `cache.shared`) and both seams call it; never re-implement shared logic in both files, use `xmtpClient()` for the cached-or-create client, and type seam code against the SDK (`instanceof Group`/`Dm`, `consentState()`, …) rather than `as unknown as` shapes — a cast hid a web-only bug where `conversations.stream` took a callback the browser SDK never called. Components import messaging ONLY through the `modules/messaging` facade barrel (lint-enforced); there is no second barrel in `lib/`. Native-only packages are stubbed for web in `metro.config.js` (`metro.shims/web/native-stub.js`).
- **Web scroll architecture — the document scrolls, nothing else does.** `public/index.html` gives body `min-height: 100vh; overflow-y: scroll` (native window scrollbar, always visible); every screen renders in normal flow. Two seams make that possible with the SAME screens as native: `lib/navigation/rootStack(.web).tsx` + `tabs(.web).tsx` (react-navigation stack/tabs natively; on web a flow navigator: the stack keeps every route mounted but hides inactive ones with `display: none` so nested navigator state survives a push/pop — unmounting the tabs reset them to Chats on back — while the tab navigator renders only the focused tab; no absolute-fill cards) and the scroll hosts in `components/layout/` — `ScreenScroll` (ScrollView natively, a plain View on web) and `VirtualList` (FlatList natively; on web TanStack Virtual with `scroll="window"` by default or `scroll="self"` inside the fixed channels pane, `anchor="end"` for the chat feed). Chrome floats over the flow via `webChrome.ts`: headers are `STICKY_TOP`/`STICKY_UNDER_CHROME`, the rail, sidebar, tab bar, band, conversation header and composer are `pinned*` (`position: fixed` on web, `absolute` natively), overlays use `viewportFill()`. The root `WebContentFrame` pads the document by `--stage-pane-left` (`paneWidth.ts`) when the split sidebar is showing; `useDocumentScrollRestore` restores `window.scrollY` per route. Never add `overflow: scroll` containers or `100vh`/`100vw` sizing to a screen; put content in flow and let the page grow.
- **Env vars must be read as literal `process.env.EXPO_PUBLIC_X` member expressions** (see `lib/zerodev/env.ts` RAW_ENV pattern) — dynamic `process.env[name]` defeats the Expo inliner on web.
- **Models are colocated with components:** presentation logic lives in pure `*.model.ts` files next to the component that consumes them (`components/ChannelRow.model.ts`, `components/settings/WalletSettings.model.ts`, ...). Framework-free — no React imports — and unit-tested in `test/` (`*.spec.ts`). Display helpers in `lib/format.ts`; platform effects (navigate/back/copy/toast/confirm/openUrl/share) go through `lib/capabilities.ts`.
- **UI composition — everything is direct kit JSX:** state hook -> colocated model -> kit components (shared chrome in `components/chrome/` — ScreenHeader/StackHeader/OverlayHeader/EmptyState — plus shared widgets in `components/widgets.tsx` and domain families like `components/settings/rows.tsx`). Chat message content (poll cards, media cards, link previews, voice/video, message bubbles) is JSX too, in `components/bubble/` and `components/composer/`.
- expo-router file routes in `app/`; `_layout.tsx` imports `lib/jsPolyfills` + `lib/cryptoShim` FIRST (order matters). Hand-rolled stores (`lib/storeCore.ts`, `lib/persistedStore.ts` over `platform/storage`) + react-query. App variants via `APP_VARIANT` (prod = Stage/stage.box, dev = dev.stage.box). "Metro" only ever means Expo's bundler here. The product, its domains, endpoints and every new identifier are Stage/stage.box; the handful of frozen legacy identifiers that keep an older string are listed in `docs/legacy-identifiers.md` and must not be renamed or extended.

### Shared core (`packages/client`)
- No build step; subpath exports + `src/index.ts` barrel are the public API (`zerodev/*` deliberately not in the barrel). Pure functions + plain interfaces, no classes/default exports. Boundary validation via `validate.ts` (zod). Always decode XMTP content WITH a zod schema (`decodeJsonContent(bytes, schema)`).
- Domains: `xmtp` (codecs, humanize, builders, line routing, consent, and the orchestration cores: `channelsFilter`, `channelsCache` incl. `applyInbound`, `summarizeRow`, `clientErrors`, `envelope`, `groups`), `accounts`+`zerodev` (validator plans, passkey linking, recovery), `wallet` (incl. `txSimulate`, `txDecode`, `prices`), `api` (incl. `github` releases for the landing downloads), `identity` (Basenames + `stageNames` read/write, `onchainProfile`, `peerProfiles`), `profile/avatar` (stamp + IPFS avatar URLs), `stamp/embed/routing/image/text`, `x402`.
- Names and avatars come from Base only (Basenames or `*.stage.base.eth` issued by the proxy; issued names may lack a forward `addr` record, so resolution accepts registry ownership and falls back to `/names/resolve`). Mainnet ENS is not consulted. Usernames are `a-z0-9` with single inner hyphens, 6+ chars, validated in the client AND in the Worker.

### Kit (`packages/kit`)
- **Kit is the React Native equivalent of [OpenAI ChatKit](https://openai.github.io/chatkit-js/)** — ChatKit is the north star for components, props, theme options, and every colour/typography/radius/density variable. Mirror ChatKit's names and literal unions exactly; the DOM-vs-RN platform difference is the only thing that should diverge. Never invent a component or a token value: if something is missing, match what ChatKit calls it, and never write a raw literal where a token exists (`FONT_SIZE.*`, `fontName.*`, `semanticColors`, `RADIUS_SCALE`). The full `ThemeOption` surface is 1:1 (`colorScheme`/`radius`/`density`/`typography.baseSize`/`color.surface`/`color.accent {primary,level}`/`color.grayscale {hue,tint,shade}`) and every ChatKit widget node exists. OpenAI does not publish ChatKit's colour maths, so `theme-derive.ts` implements the documented semantics itself — defaults are lossless and guarded by tests. See `packages/kit/README.md` for the parity table.
- Plain design-system component library: ONE component family (`src/react-native/*`, renders on web via RNW) + shared style cores (`text.styles.ts`, `button.styles.ts`, `control.styles.ts`, `layout.ts` surfaces, `badge.ts`, `icons.ts`, `tokens.ts` incl. the `Scheme`/`Color` helpers). Consumed via subpath exports (`@stage-labs/kit/tokens`, `@stage-labs/kit/react-native/button`, ...).
- Theming: preference contract (`theme.ts`), runtime context (`react-native/theme-context.tsx`), custom-palette deriver (`theme-derive.ts`, LEGACY short-circuit guarded by tests).
- **Storybook = `packages/kit/gallery/`** (own Vite shell built from kit components, react-native-web alias in `vite.config.ts`; stories in `stories/*.stories.tsx` in Storybook CSF shape with `args`/`argTypes`): every component gets a `Controls` story listing all props with literal unions as selects, plus matrix stories for variant axes. Stories import kit sources only, never `apps/stage`. New component => new story file; knip treats `stories/*.stories.tsx` as entries. No Storybook/Ladle dependency; keep it that way.

## Conventions

- **Commits:** Conventional Commits `type(scope): subject (#NNN)`, lowercase imperative. Trailer required: `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`. Commit/push only when asked; branch first if on `main`.
- **NO COMMENTS IN CODE** — `comments/no-comments` bans non-directive comments across `.ts/.tsx/.js` including config files AND test files (the built config spreads COMMENT_RULES into the test block). Express intent in names/types. Markdown is exempt.
- **NO EM DASH (`—`) anywhere in source or copy** — `text/no-em-dash` (same COMMENT_RULES block) fails lint on any string literal, template or JSX text containing it. Write two sentences, or use a comma or colon; empty-value placeholders use a plain `-`.
- **No TS escape hatches:** no-explicit-any, no-non-null-assertion, ban-ts-comment are errors; `noUncheckedIndexedAccess` is on — null-guard, never assert.
- **Single quotes**; max 400 lines/file, 100 lines/function, cyclomatic complexity <= 10.
- **Forms:** every text input except the message composer goes through `components/FormField` (filled with the border colour, no border, radius 4, label inside above the value). Never style a kit `Input` inline in a screen.
- **Security invariants:** the keyring (`lib/zerodev/keyring.ts`) is the only importer of private-key/mnemonic primitives (`stage/no-keyring-bypass`), every `secureStorage` get/set in the keyring and `xmtp.dbkey.ts` passes a `DeviceBoundAccessOptions` const, and `lib/cryptoShim.ts` never touches `Math.random` — all lint rules in `apps/stage/eslint.js`. Never print operator or private keys; secrets reach CI only as GitHub secrets and the Worker only via `wrangler secret`.
- **Kit-only UI:** build screens from kit primitives in JSX fed by colocated `*.model.ts` models, not raw RN style objects; `usePalette`/`useEffectiveColorScheme` for the few native-styled shells.
- **No circular deps** (madge) and **no unused files/deps/exports** (knip). New workspace => `stage.config.js` entry + `madge.roots`.
- Invariants about source shape (which module may import a secret primitive, that every secure write is device-bound, no `Math.random` in the crypto shim) are ESLint rules in `apps/stage/eslint.js`, never tests that `readFileSync` a source file and `toContain` a line — those break on every refactor and catch nothing.
- Snapshot-bearing test files are `*.spec.ts` (bun writes `*.test.ts.snap` files that the `**/*.test.*` lint glob would pick up and always fail). The remaining snapshot suites live in `packages/kit/test/` (button/layout/theme-derive); `apps/stage/test/` is pure-model tests only.

## CI gates (strict order)
`.github/workflows/ci.yml` -> `_ci.yml`: **lint -> typecheck -> knip -> madge -> build -> test** (Bun 1.4.0, frozen lockfile).

## Gotchas / footguns

- **Netlify config is `apps/stage/netlify.toml`, NEVER at the repo root.** The Stage site's base directory is `apps/stage` (set in the Netlify UI), so Netlify reads that file; a root toml applies to every site built from this repo and hijacked the kit gallery site. The toml sets the command (`bun install && bun run build:web`), publish (`dist`), `BUN_VERSION`, `NODE_VERSION`, the secrets-scan exemption for the public Firebase client key, the COOP/COEP headers and the SPA redirect. Kit gallery site: base `packages/kit`, configured in the UI only (command `bun install && bun run storybook:build`, publish `packages/kit/build`, env `BUN_VERSION`; Node from `packages/kit/.nvmrc`). Headers: COOP same-origin + **COEP credentialless** (deliberate — keeps SharedArrayBuffer for XMTP wasm while cross-origin avatars/IPFS load). Don't change to require-corp.
- Native module changes (e.g. `modules/stage-pill`) need a fresh dev-client build; a JS reload is not enough.
- **Mobile releases are version-driven** (the `version` in `apps/stage/app.config.js` triggers `release-mobile.yml`: EAS Build + EAS Submit for Play and TestFlight, see `docs/mobile-release.md`). Account identifiers are injected at build time, never committed to `eas.json`. EAS free tier has a monthly build cap. Every push to every branch publishes a JS-OTA dev-client preview (`pr-preview.yml`; the "Preview" commit status carries the deep link).
- **`served-main`** must stay content-identical to `main` (drift allowlist deliberately empty).
- `@stage-labs/config` publishes via `publish-config.yml` under the `beta` dist-tag; bump its version first. Its Vue lint preset remains for external consumers behind optional peers (`eslint-plugin-vue`/`vue-eslint-parser` are knip-ignored).
- The passkey tests that build a validator (`passkeyCallbackContract`, `passkeyKernelDerivation`) hit live Base RPC and can time out in sandboxes; they pass in CI.
- Button taxonomy: `color` x `solid/soft/outline/ghost` only. The legacy `primary/secondary/danger` variant union is gone entirely (it died with the JSON widget boundary) — don't reintroduce it.
- `theme.ts` setters call the persist helper; don't mutate display state directly.

## Key paths

| Path | Why |
|---|---|
| `stage.config.js` + `packages/config/bin/stage.js` | THE central tooling config + CLI |
| `apps/stage/app.config.js` + `eas.json` | Expo config (variants, web output single, plugins/permissions) + EAS profiles |
| `apps/stage/metro.config.js` | node-core polyfills, web native-stubs, monorepo resolution, desktop-shell blockList |
| `apps/stage/platform/*` | the storage seams (contracts + impls) |
| `apps/stage/lib/xmtp.*.ts` / `.web.ts` / `.core.ts` | the XMTP seam family; `modules/messaging/index.ts` is the facade components import |
| `apps/stage/lib/zerodev/*` | keyring (multi-phrase), account create/restore, kernel client, passkey enable/link/disable, recovery |
| `apps/stage/components/*` | kit-JSX screens/UI + colocated `*.model.ts` pure models, one folder per family (`bubble/`, `composer/`, `home/`, `conversation/`, `group/`, `wallet/`, `onboarding/`, `settings/`) |
| `apps/stage/components/FormField.tsx` | THE text input wrapper |
| `apps/stage/eslint.js` | app lint preset incl. the keyring / device-bound storage / CSPRNG rules and the facade import restriction |
| `apps/stage/components/chrome/*` | shared JSX screen chrome (headers, empty state) |
| `apps/stage/lib/capabilities.ts` | platform-effects contract (navigate/copy/toast/share/...) |
| `apps/stage/app/_layout.tsx` | root providers, polyfill order, font patch |
| `packages/kit/src/react-native/*` | THE kit component family |
| `packages/kit/src/tokens.ts` + `{theme,theme-derive}.ts` | tokens + colour helpers + theming |
| `packages/client/package.json` + `src/index.ts` | public API surface + barrel |
| `packages/client/src/xmtp/*` | codecs + orchestration cores |
| `packages/client/src/validate.ts` | parseOrThrow/parseOrNull boundary helpers |
| `apps/stage/netlify.toml` | universal web deploy + COOP/COEP headers (in the site base dir, never at the root) |
| `.github/workflows/_ci.yml` | the 6 gates |
| `docs/legacy-identifiers.md` | the frozen pre-rename identifiers that must keep their old string |
| `README.md` | monorepo layout, commands, env vars, releases, CI gate order |
