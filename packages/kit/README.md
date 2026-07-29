# @stage-labs/kit

> Shared design-system primitives for the Stage clients: tokens, icon data, and theme contracts.

## Overview

`@stage-labs/kit` is the single source of truth for how Stage looks. It ships the colour and spacing tokens, HeroIcon path data, station icon definitions, avatar helpers, the theme-preference contract, and one React Native component family (rendering on web via react-native-web) consumed by the universal app ([`apps/stage`](../../apps/stage)). Screens and chat message content compose the components directly in JSX.

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

Component coverage: Kit implements **every ChatKit widget node** — `Badge`, `Box`, `Button`, `Caption`, `Card`, `Col`, `DatePicker`, `Divider`, `Form`, `Icon`, `Image`, `ListView`, `ListViewItem`, `Markdown`, `Row`, `Select`, `Spacer`, `Text`, `Title`, `Transition`. It additionally carries React Native platform primitives with no ChatKit analogue (`Scroll`, `Pressable`, `GesturePressable`, `FlatList`, `theme-context`) and app-driven extras (`AudioPlayer`, `VideoPlayer`, `VoiceRecorder`, `QrCode`, `ColorPicker`, `Table`, `Tabs`, `Dialog`, ...).

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

## Project structure

```
src/
  tokens.ts          # colour + spacing tokens, colour helpers (Scheme, resolveColor, ...)
  theme.ts           # theme-preference contract + resolution
  theme-derive.ts    # custom-palette deriver
  icons.ts           # HeroIcon names + resolveIconName
  heroicons.data.ts  # HeroIcon path data
  avatar.ts          # avatar helpers
  layout.ts          # Box layout core (spacing, borders, surfaces)
  badge.ts           # badge style core
  text.styles.ts / button.styles.ts / control.styles.ts  # shared style cores
  react-native/      # THE component family (Button, Text, Dialog, ...), renders on web via RNW
  index.ts           # root barrel
```

## Scripts

| Script              | Description                  |
| ------------------- | --------------------------- |
| `bun run typecheck` | Type-check without emitting. |
| `bun run lint`      | Lint `src/`.                |

## Links

- Consumed by [`apps/stage`](../../apps/stage)
- Shared logic lives in [`@stage-labs/client`](../client)
