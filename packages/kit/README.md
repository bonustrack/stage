# @stage-labs/kit

> Shared design-system primitives for the Stage clients: tokens, icon data, and theme contracts.

## Overview

`@stage-labs/kit` is the single source of truth for how Stage looks. It ships the colour and spacing tokens, the Central Icons set, station icon definitions, avatar helpers, the theme-preference contract, and one React Native component family (rendering on web via react-native-web) consumed by the universal app ([`apps/stage`](../../apps/stage)). Screens and chat message content compose the components directly in JSX.

Style logic lives in framework-free core modules (`text.styles.ts`, `button.styles.ts`, `control.styles.ts`, `layout.ts`); components target React Native via peer dependencies and render on every platform, web included.

## Design north star: OpenAI ChatKit

**Kit is the React Native equivalent of [OpenAI ChatKit](https://openai.github.io/chatkit-js/).** ChatKit is the reference for everything — component names and props, theme options, colour/typography/radius/density variables and their allowed values. Where ChatKit has a concept, Kit mirrors it under the same name and the same literal values; ChatKit is DOM/CSS, Kit is React Native, and that platform difference is the *only* thing that should differ.

Practical rules:

- **Don't invent components.** If something is missing, find what ChatKit calls it and match that name and prop shape. Don't add a bespoke primitive.
- **Don't invent token values.** Reuse `FONT_SIZE`, `semanticColors`, `RADIUS_SCALE`, `DENSITY_SCALE`. A raw literal (`fontSize: 15`, `'#ffffff'`) in a component is drift, even when it currently matches the token.
- **Keep the literal unions identical** to ChatKit's, so a ChatKit theme config maps onto Kit 1:1.

Parity of the theme surface against ChatKit's [`ThemeOption`](https://openai.github.io/chatkit-js/api/openai/chatkit/type-aliases/themeoption/) — every key name and literal union matches, so a ChatKit theme config maps onto Kit 1:1:

| ChatKit                                          | Kit                                                  |
| ------------------------------------------------ | ---------------------------------------------------- |
| `colorScheme: 'light' \| 'dark'`                  | `Scheme` (`tokens.ts`)                               |
| `radius: 'pill' \| 'round' \| 'soft' \| 'sharp'`  | `RadiusName` + `RADIUS_SCALE`                        |
| `density: 'compact' \| 'normal' \| 'spacious'`    | `Density` + `DENSITY_SCALE`                          |
| `typography.baseSize: 14\|15\|16\|17\|18`         | `BaseSize` + `BASE_SIZE_DEFAULT`                     |
| `typography.fontFamily` / `fontFamilyMono`        | `fontFamily.sans` / `.mono` (+ `fontName.*` for RN)  |
| `typography.fontSources`                          | N/A — RN loads fonts via `expo-font`                 |
| `color.surface: { background, foreground }`       | `SurfaceColors` (`theme-derive.ts`)                  |
| `color.accent: { primary, level: 0\|1\|2\|3 }`    | `AccentColor`                                        |
| `color.grayscale: { hue, tint: 0-9, shade?: ±4 }` | `GrayscaleOptions`                                   |

**Caveat — shapes match, generators are Kit's own.** OpenAI publishes ChatKit's theme *types* but not the colour maths behind them, so Kit implements the documented semantics itself: `tint` is saturation in 1% steps, `shade` shifts lightness by 3% per step (negative lighter, positive darker), and `level` mutes the accent toward the surface foreground in 18% steps with `3` meaning "primary unchanged". `grayscaleHex`/`accentHex`/`grayscaleFromHex` in `theme-derive.ts` are the entry points, and the defaults are lossless — `grayscaleHex(DEFAULT_SEED.dark.grayscale, 'dark')` is exactly `#282a2d`, guarded by tests.

Component coverage: Kit implements **every ChatKit widget node** — `Badge`, `Box`, `Button`, `Caption`, `Card`, `Col`, `DatePicker`, `Divider`, `Form`, `Icon`, `Image`, `ListView`, `ListViewItem`, `Markdown`, `Row`, `Select`, `Spacer`, `Text`, `Title`, `Transition`. It additionally carries React Native platform primitives with no ChatKit analogue (`Scroll`, `Pressable`, `GesturePressable`, `FlatList`, `theme-context`) and app-driven extras (`AudioPlayer`, `VideoPlayer`, `VoiceRecorder`, `QrCode`, `ColorPicker`, `Table`, `Tabs`, `Dialog`, `Modal`, `DropdownMenu`, `Tooltip`, ...).

## Install

The package is consumed inside the monorepo via `workspace:*`; no separate install is needed.

```sh
bun install            # from the repo root
```

```jsonc
// in a consuming workspace's package.json
"dependencies": { "@stage-labs/kit": "workspace:*" }
```

## Usage

```ts
import { colors, resolveColorToken } from '@stage-labs/kit/tokens';
import { resolveIconName } from '@stage-labs/kit/icons';
import { resolveBadgeStyle } from '@stage-labs/kit/badge';
```

```tsx
// React Native components (peer deps: react, react-native, react-native-svg, ...)
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
```

Icons are [Central Icons](https://centralicons.com) (round, radius 1, stroke 2) from the licensed `@central-icons-react-native/*` packages, which the kit depends on rather than vendoring. Import each icon on its own, under its Central name, and draw it with `Glyph`:

```tsx
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { IconThumbtack } from '@central-icons-react-native/round-filled-radius-1-stroke-2/IconThumbtack';

<Glyph icon={IconThumbtack} size={16} color={link} />
```

The package picks the style: `round-outlined-radius-1-stroke-2` is `line`, `round-filled-radius-1-stroke-2` is `solid`. Metro does not tree-shake, so a per-icon import is what keeps the other icons out of the bundle. `Icon` from `@stage-labs/kit/react-native/icon` still accepts the older HeroIcon names through `CENTRAL_ICON_ALIASES`, with `variant` `'line'` (default) or `'solid'`, but it bundles every aliased icon. Installing the packages with a package manager that runs dependency install scripts needs a Central licence key; Bun does not run them.

`AudioPlayer` and `VideoPlayer` play through the `expo-audio` and `expo-video` peers (they replaced `expo-av`). On web those modules expect the Expo runtime global: an Expo app installs it, and a plain react-native-web host must call `installExpoGlobalPolyfill()` from `expo-modules-core/src/polyfill/dangerous-internal` before importing them, as `gallery/expo-runtime.ts` does.

## Project structure

```
src/
  tokens.ts          # colour + spacing tokens, colour helpers (Scheme, resolveColor, ...)
  theme.ts           # theme-preference contract + resolution
  theme-derive.ts    # custom-palette deriver
  icons.ts           # icon names + resolveIconName; the HeroIcon path data (heroicons.data.ts, heroicons.solid.data.ts) is still exported but no longer drawn
  glyph.ts           # CentralIcon type and IconStyle ('line' | 'solid')
  central-icons.ts   # HeroIcon name -> Central Icons aliases, used by `Icon`
  heroicons.data.ts  # HeroIcon path data
  avatar.ts          # avatar helpers
  layout.ts          # Box layout core (spacing, borders, surfaces)
  badge.ts           # badge style core
  markdown.styles.ts # Markdown style sheet (Discord/Telegram-like), shared with the app's chat bubbles
  text.styles.ts / button.styles.ts / control.styles.ts  # shared style cores
  react-native/      # THE component family (Button, Text, Dialog, ...), renders on web via RNW
  index.ts           # root barrel
stories/             # one story file per component (controls for every prop + variant matrices)
gallery/             # the storybook shell: Vite entry, sidebar, controls panel, hash routing (kit components only)
vite.config.ts       # react-native-web aliasing for the gallery
```

## Storybook

The component gallery is a small hand-rolled page in `gallery/`, served by Vite and drawn entirely with kit components, so it looks like the kit and renders text exactly as the app does (same fonts, same antialiasing). No Storybook or Ladle dependency.

```sh
bun run --cwd packages/kit storybook        # dev server on http://localhost:6006
bun run --cwd packages/kit storybook:build  # static site in packages/kit/build (gitignored, ~2 MB)
```

Stories use the Storybook component-story format: a default export with a `title`, named exports that render the component, and `args` / `argTypes` on each export. Every kit component has a `Controls` story exposing all of its props as controls (unions as selects, booleans as switches, numbers, text and colours), and the ones with variant axes (Button, Badge, Text, Title, Icon, Image, Input, Box, Avatar) also have a matrix story showing every option at once. The `Theme` story drives the `ThemeOption` surface (accent, grayscale, surface, radius, density, base size) through `derivePalette`. Control values live in the URL hash, so a configured story is a shareable link; the sun/moon toggle in the sidebar switches the scheme, sets the document `color-scheme` so native scrollbars follow, and flows into `KitThemeProvider`. Only kit components appear in stories; app UI from `apps/stage` never does.

## Scripts

| Script              | Description                  |
| ------------------- | --------------------------- |
| `bun run typecheck` | Type-check without emitting. |
| `bun run test`      | Run the unit + snapshot tests (`test/*.spec.ts`). |
| `bun run storybook` | Gallery dev server with a story per component. |
| `bun run storybook:build` | Static gallery build into `build/`. |

Form controls (`Input`, `Textarea`, `TextField`, `Select`, `DatePicker`) default to `CONTROL_RADIUS_DEFAULT` (8px) and draw no focus ring: no accent border on focus and `outlineWidth: 0` with `outlineStyle: 'solid'` so the browser's own ring (which ignores width in its `auto` style) stays off on web. `Select` opens a `DropdownMenu` anchored under its trigger. `Modal` wraps `Dialog` with the Stage look (page background, 1px border, 17px radius, optional title, centered with a 480px max width or a bottom sheet). `DropdownMenu`/`DropdownMenuItem`/`DropdownMenuSeparator` and `Tooltip` default to the Stage app look (menu surface on the border colour, 6px radius, 4px list padding; tooltip bubble with arrow) and share `OVERLAY_SHADOW` from `overlay.styles.ts` (web tooltips use the matching `drop-shadow` so the arrow is shaded too). Cards and images keep `BLOCK_RADIUS_DEFAULT` (12px). `Markdown` styles come from `markdown.styles.ts` (`@stage-labs/kit/markdown-styles`), which overrides every default of `react-native-markdown-display` so nothing bleeds through; callers can pass body size, line height, paragraph gap and link colour.

Linting is centralised at the repo root (`bun run lint`). The package is published to npm by `publish-kit.yml`; other codebases consume it, so components, tokens and style setup are never removed because the app stopped using them.

## Links

- Consumed by [`apps/stage`](../../apps/stage)
- Shared logic lives in [`@stage-labs/client`](../client)
