# @stage-labs/kit

> Shared design-system primitives for the Stage clients: tokens, icon data, and theme contracts.

## Overview

`@stage-labs/kit` is the single source of truth for how Stage looks. It ships the colour and spacing tokens, the Central Icons set, station icon definitions, avatar helpers, the theme-preference contract, and one React Native component family (rendering on web via react-native-web) consumed by the universal app ([`apps/stage`](../../apps/stage)). Screens and chat message content compose the components directly in JSX.

Style logic lives in framework-free core modules (`text.styles.ts`, `button.styles.ts`, `control.styles.ts`, `layout.ts`); components target React Native via peer dependencies and render on every platform, web included.

## Design north star: OpenAI ChatKit

**Kit is the React Native equivalent of [OpenAI ChatKit](https://openai.github.io/chatkit-js/).** ChatKit is the reference for everything: component names and props, theme options, colour/typography/radius/density variables and their allowed values. Where ChatKit has a concept, Kit mirrors it under the same name and the same literal values; ChatKit is DOM/CSS, Kit is React Native, and that platform difference is the *only* thing that should differ.

Practical rules:

- **Don't invent components.** If something is missing, find what ChatKit calls it and match that name and prop shape. Don't add a bespoke primitive.
- **Don't invent token values.** Reuse `FONT_SIZE`, `semanticColors`, `RADIUS_SCALE`, `DENSITY_SCALE`. A raw literal (`fontSize: 15`, `'#ffffff'`) in a component is drift, even when it currently matches the token.
- **Keep the literal unions identical** to ChatKit's, so a ChatKit theme config maps onto Kit 1:1.

Parity of the theme surface against ChatKit's [`ThemeOption`](https://openai.github.io/chatkit-js/api/openai/chatkit/type-aliases/themeoption/). Every key name and literal union matches, so a ChatKit theme config maps onto Kit 1:1.

| ChatKit                                          | Kit                                                  |
| ------------------------------------------------ | ---------------------------------------------------- |
| `colorScheme: 'light' \| 'dark'`                  | `Scheme` (`tokens.ts`)                               |
| `radius: 'pill' \| 'round' \| 'soft' \| 'sharp'`  | `RadiusName` + `RADIUS_SCALE`                        |
| `density: 'compact' \| 'normal' \| 'spacious'`    | `Density` + `DENSITY_SCALE`                          |
| `typography.baseSize: 14\|15\|16\|17\|18`         | `BaseSize` + `BASE_SIZE_DEFAULT`                     |
| `typography.fontFamily` / `fontFamilyMono`        | `fontFamily.sans` / `.mono` (+ `fontName.*` for RN)  |
| `typography.fontSources`                          | N/A, RN loads fonts via `expo-font`                  |
| `color.surface: { background, foreground }`       | `SurfaceColors` (`theme-derive.ts`)                  |
| `color.accent: { primary, level: 0\|1\|2\|3 }`    | `AccentColor`                                        |
| `color.grayscale: { hue, tint: 0-9, shade?: ±4 }` | `GrayscaleOptions`                                   |

**Caveat: shapes match, generators are Kit's own.** OpenAI publishes ChatKit's theme *types* but not the colour maths behind them, so Kit implements the documented semantics itself: `tint` is saturation in 1% steps, `shade` shifts lightness by 3% per step (negative lighter, positive darker), and `level` mutes the accent toward the surface foreground in 18% steps with `3` meaning "primary unchanged". `grayscaleHex`/`accentHex`/`grayscaleFromHex` in `theme-derive.ts` are the entry points, and the defaults are lossless: `grayscaleHex(DEFAULT_SEED.dark.grayscale, 'dark')` is exactly `#282a2d`, guarded by tests.

Component coverage: Kit implements **every ChatKit widget node**, and `Frame` renders ChatKit widget JSON with them: `Badge`, `Box`, `Button`, `Caption`, `Card`, `Col`, `DatePicker`, `Divider`, `Form`, `Icon`, `Image`, `ListView`, `ListViewItem`, `Markdown`, `Row`, `Select`, `Spacer`, `Text`, `Title`, `Transition`. It additionally carries React Native platform primitives with no ChatKit analogue (`Scroll`, `Pressable`, `GesturePressable`, `FlatList`, `theme-context`) and app-driven extras (`AudioPlayer`, `VideoPlayer`, `VoiceRecorder`, `QrCode`, `ColorPicker`, `Table`, `Tabs`, `Dialog`, `Modal`, `DropdownMenu`, `Tooltip`, `Glyph`, ...).

## Install

Inside the monorepo, workspaces use `workspace:*`, so no separate install is needed.

```sh
bun install            # from the repo root
```

```jsonc
// in a consuming workspace's package.json
"dependencies": { "@stage-labs/kit": "workspace:*" }
```

Other apps install it from npm. Releases go out under the `beta` tag, so ask for it:

```sh
bun add @stage-labs/kit@beta
```

The two Central Icons packages and `qrcode` come with the kit. The app provides the peers: `react`, `react-native`, `react-native-svg`, `react-native-markdown-display`, `react-native-gesture-handler`, `react-native-safe-area-context`, `react-native-reanimated` (`~4.3.1` or `4.5.1`), `expo-audio`, `expo-video`, `expo-document-picker` and `expo-image-picker`. `expo-av` is no longer needed.

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

The package picks the style: `round-outlined-radius-1-stroke-2` is `line`, `round-filled-radius-1-stroke-2` is `solid`. Metro does not tree-shake, so a per-icon import is what keeps the other icons out of the bundle. `Icon` from `@stage-labs/kit/react-native/icon` still accepts the older HeroIcon names through `CENTRAL_ICON_ALIASES`, with `variant` `'line'` (default) or `'solid'`, but it bundles every aliased icon. It is the only component that does: `Tabs` options, `DropdownMenuItem` and the `Select` and `DatePicker` triggers take Central icons, like `Glyph`. Installing the packages with a package manager that runs dependency install scripts needs a Central licence key; Bun does not run them.

`AudioPlayer` and `VideoPlayer` play through the `expo-audio` and `expo-video` peers (they replaced `expo-av`). On web those modules expect the Expo runtime global: an Expo app installs it, and a plain react-native-web host must call `installExpoGlobalPolyfill()` from `expo-modules-core/src/polyfill/dangerous-internal` before importing them, as `gallery/expo-runtime.ts` does.

`VideoPlayer` takes `background` (default `#000000`), `aspectRatio` (default 16/9) and `fit` (`'contain'`, the default, or `'cover'`). Fullscreen always shows the whole video. `onVideoSize` gets the video's display size (`{ width, height }`, rotation applied) once it is known, so a caller can match `aspectRatio` to the video. On web it reads the `<video>` element's metadata; on iOS and Android it measures a small first frame, because the native track size ignores rotation. `Image` takes `headers`, sent with the image request, and the same module exports `getImageSize(src)`, which resolves to `{ width, height }`. On Android, `Image` also takes `resizeMethod` and `resizeMultiplier`, passed to React Native's `Image`, to choose the size the image is decoded at. Other platforms ignore them. `Dialog` takes `header` and `footer` nodes around its scroll body, `bottomInset` to lift the panel, `panelWidth`, `panelMaxWidth`, and `panelBorderSides` (`'top'` or `'all'`) for the `panelBorderColor` border. `Badge` has `solid`, `soft` and `outline` variants.

## Frame

`Frame` (`@stage-labs/kit/react-native/frame`) renders OpenAI ChatKit widget JSON with kit components. It takes the same JSON ChatKit streams as a widget item: a `Card`, `ListView` or `Basic` root with the ChatKit nodes inside (`Box`, `Row`, `Col`, `Form`, `Text`, `Title`, `Caption`, `Label`, `Markdown`, `Badge`, `Icon`, `Image`, `Button`, `Spacer`, `Divider`, `Transition`, `Input`, `Textarea`, `Select`, `DatePicker`, `Checkbox`, `RadioGroup`, `Table`, `Table.Row`, `Table.Cell`), with ChatKit's prop names and values. `Chart` shows its data as a table.

```tsx
import { Frame } from '@stage-labs/kit/react-native/frame';

<Frame
  widget={{ type: 'Card', children: [
    { type: 'Title', value: 'Weekly report' },
    { type: 'Button', label: 'Approve', onClickAction: { type: 'report.approve', payload: { week: 39 } } },
  ] }}
  onAction={async (action, { label }) => { await send(action, label); }}
  onOpenUrl={(url) => { open(url); }}
/>
```

- The JSON is checked first by `parseFrame` (`@stage-labs/kit/frame`, no React): at most 64K characters, depth 16, 500 nodes and 200 children per node. A frame over a limit, or not an object, shows a short notice instead.
- Unknown props are dropped. An unknown node type, or a node without a required prop (`Text.value`, `Image.src`, `Select.options`, ...), shows a small "Unsupported" box. Nothing throws, and an error boundary catches render errors.
- `Image.src` must be `https://`. Colours are ChatKit tokens (`secondary`, `surface-secondary`, `success`, ...), hex, `rgb()`/`hsl()` or `{ light, dark }`; anything else is dropped. `Markdown` has HTML and images off, and a link calls `onOpenUrl` only for `https://` URLs.
- Icons (`Icon.name`, `Button.iconStart`, `Button.iconEnd`) take ChatKit's 63 icon names, plus nine Stage names that ChatKit does not have: `arrow-up`, `chevron-down`, `chevron-up`, `copy`, `mic`, `send`, `share`, `thumbs-down` and `thumbs-up`. Any other name makes an `Icon` unsupported, and a `Button` drops it.
- Number spacing (`gap`, `padding`, `margin`, `Divider.spacing`) is in ChatKit spacing units of 4px; `"12px"` strings are pixels. Sizes (`width`, `height`, `size`) are pixels or `"50%"`.
- Actions: `Button.onClickAction`, `ListViewItem.onClickAction`, `Card` `confirm`/`cancel`, `Form.onSubmitAction` and the controls' `onChangeAction` call `onAction({ type, payload }, { label })`. The values of the fields in the same `Form` (or `Card asForm`, or the whole frame) are added to `payload` by `name` (`todo.title` nests), and a key already in the payload wins. A submit is blocked while a `required` field is empty. `handler` and `loadingBehavior` are ignored. While `onAction` runs, every button is disabled. Without `onAction`, or with `disabled`, the frame is read only.
- `dark` picks the scheme (default: the `KitThemeProvider` scheme); a root's `theme` overrides it for its subtree.
- `fill` (`{ padding, insetBottom? }`) shows the frame as a full page: the root grows to fill its container, a `Card` root loses its border and radius, and the root `background` (or the background of its `theme`) paints the whole area. `padding` is used only when the root sets no `padding` of its own, so `padding: 0` means no spacing. `insetBottom` is added at the bottom, for a safe area. A `ListView` root, which has no padding, keeps the fill padding. Without `fill`, the frame takes only the space its content needs.
- `Basic` also takes `background`, like `Card`.
- `frameSummary(root)` gives a title and description from the first `Title` and text nodes, for previews.

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

Form controls (`Input`, `Textarea`, `TextField`, `Select`, `DatePicker`) default to `CONTROL_RADIUS_DEFAULT` (8px) and draw no focus ring: no accent border on focus and `outlineWidth: 0` with `outlineStyle: 'solid'` so the browser's own ring (which ignores width in its `auto` style) stays off on web. `Select` opens a `DropdownMenu` anchored under its trigger. `Modal` wraps `Dialog` with the Stage look (page background, no border unless `borderColor` is passed, 17px radius, optional 24px semibold title, centered with a 480px max width or a bottom sheet). Its header stays above the scrollable content and includes a labeled close button with a hover tooltip. Set `dismissable={false}` to hide the close button and prevent backdrop and Escape dismissal. `Dialog` accepts an optional `header` above its scroll body and uses a separate backdrop target, so dragging from the panel to the backdrop does not dismiss it. `DropdownMenu`/`DropdownMenuItem`/`DropdownMenuSeparator` and `Tooltip` default to the Stage app look (menu surface on the border colour, 6px radius, 4px list padding; tooltip bubble with arrow) and share `OVERLAY_SHADOW` from `overlay.styles.ts` (web tooltips use the matching `drop-shadow` so the arrow is shaded too). `Tooltip` takes an optional `trailing` node, shown after the label, such as a keyboard shortcut. `DropdownMenuSheet` is the same menu surface in a `Dialog` for touch and narrow screens (a borderless bottom sheet, or centered), so its rows are the same `DropdownMenuItem`s. The segmented `Tabs` is a full pill track on the raised surface with a pill thumb on the page surface. Labels use the default text role when selected and the secondary role otherwise, in Calibre Medium at `FONT_SIZE.xl`. Without `dark` it follows the `KitThemeProvider` scheme and palette. Cards and images keep `BLOCK_RADIUS_DEFAULT` (12px). `Markdown` styles come from `markdown.styles.ts` (`@stage-labs/kit/markdown-styles`), which overrides every default of `react-native-markdown-display` so nothing bleeds through; callers can pass body size, line height, paragraph gap and link colour.

Linting is centralised at the repo root (`bun run lint`). The package is published to npm by `publish-kit.yml`; other codebases consume it, so components, tokens and style setup are never removed because the app stopped using them.

## Changelog

### 0.1.0-beta.2

#### New component

- `Frame` renders OpenAI ChatKit widget JSON with kit components, with validation, limits and actions. See Frame above. `@stage-labs/kit/frame` has its pure `parseFrame` and `frameSummary`.

#### Breaking changes

- The `Tabs` option `icon` and the `DropdownMenuItem` `iconName` take a Central icon, like `Glyph`, for example `icon: IconBubble3` instead of `icon: 'chatBubble'`. HeroIcon names still work with `Icon`.
- `@stage-labs/kit/react-native/dropdown-menu` now exports the same `DropdownMenu`, `DropdownMenuItem`, `DropdownMenuSeparator` and `DropdownMenuSheet` as `@stage-labs/kit/react-native/menu`.

#### Smaller bundles

- `Tabs`, `DropdownMenu`, `Select` and `DatePicker` no longer load `CENTRAL_ICON_ALIASES`, which pulls in every aliased icon (about 110 KB gzip on web). Only `Icon` loads it now.

#### New props

- `Image`: `resizeMethod` and `resizeMultiplier` on Android, to choose the size the image is decoded at.
- `VideoPlayer`: `onVideoSize`, called with the video's display size once it is known.

#### Visual changes

- `Spinner` is the Stage app spinner: a ring that fades into its tail and turns once every 0.5s. On web it spins with a CSS animation. Without `color` it takes the heading colour of the theme, black in light and white in dark (it was `#888888`).
- `Button` `loading` shows `Spinner` instead of the platform `ActivityIndicator`.

### 0.1.0-beta.1

The first release since 0.1.0-beta.0.

#### Breaking changes

- `Button` sizes are now `xs`, `sm`, `md`, `lg` and `xl`. The `3xs`, `2xs`, `2xl` and `3xl` sizes were removed. Use `xs` instead of `3xs` and `2xs`, and `xl` instead of `2xl` and `3xl`.
- `Input`, `Textarea`, `Select` and `DatePicker` sizes are now `xs` to `xl` too, with the same replacements.
- `Text` sizes (`TextSizeToken`, `FontSizeName`, `FONT_SIZE` and `fontSize()`) no longer have `3xs` (11px) or `2xs` (12px). The smallest size is `xs` (13px). To keep 11px or 12px text, pass it in `style`, for example `style={{ fontSize: 11 }}`. `FONT_SIZE_SNAP` now maps 10, 11 and 12 to `xs`. `Badge`, `Caption`, `Label`, `Card` and `DatePicker` keep their 11px and 12px text.
- `TextField` lost the `noFocusBorder` prop. No control draws a focus border now.
- `Button` `pill` now only rounds the corners. It no longer makes a square button. Use `uniform` for that.
- The theme seed (`theme-derive`) follows ChatKit. `accent` is `{ primary, level }` and `grayscale` is `{ hue, tint, shade }`, no longer hex strings.
- Peer dependencies: `expo-audio` and `expo-video` replace `expo-av` (`AudioPlayer`, `VideoPlayer`). `react-native-reanimated` 4.5.1 is also accepted.
- New dependencies: two Central Icons packages from npm, installed with the kit.

#### New components and props

- New components: `Modal`, `DropdownMenu` (with `DropdownMenuItem`, `DropdownMenuSeparator` and `DropdownMenuSheet`), `Tooltip`, `Badge` (`solid`, `soft`, `outline`), `Transition` and `Glyph`.
- `Image`: `headers` prop and `getImageSize()`.
- `VideoPlayer`: `background`, `aspectRatio` and `fit`. Fullscreen shows the whole video.
- `Dialog`: `header`, `footer`, `bottomInset`, `panelWidth`, `panelMaxWidth` and `panelBorderSides`.
- `Icon`: `variant` (`'line'` or `'solid'`), and it accepts a Central icon too. HeroIcon names still work. New brand icons: Apple, Android, Windows, Linux and pin.
- `useAudioPlayback` hook with preload. `Scroll` forwards its ref. The `GesturePressable` `onPress` gets the tap point. `VoiceRecorder` has `wrapMic`. `TextField` `autoGrow` works on web.
- New exports: `markdownStyles`, `fontName`, `kitPalette`, `CONTROL_RADIUS_DEFAULT`, `grayscaleHex`, `accentHex` and `FLEX_ALIGN`.

#### Visual changes

- Every `Icon` draws Central Icons instead of Heroicons. `focused` no longer thickens the stroke.
- Segmented `Tabs`: fully rounded track and thumb in kit colours. Without `dark` it follows the theme.
- Form controls: 8px corners (was 12px), no blue focus border and no browser focus ring.
- `Select` opens a dropdown under the field, not a centered sheet.
- `Markdown`: blue links without underline, rounded code blocks, a quote bar and framed tables.
- `Button` `lg` and `xl` labels are 1px and 2px bigger.
- `Scroll` and `FlatList` hide scrollbars on iOS and Android by default.

#### Fixes

- `GesturePressable`: pointer cursor on web, no text selection on tap, and touch scrolling no longer freezes on mobile web.
- Audio players are released on unmount, so a voice note stops when it leaves the screen.
- The `Dialog` backdrop and panel show no focus ring.
- Long `Markdown` links wrap.

### 0.1.0-beta.0

First published version (2026-07-22).

## Links

- Consumed by [`apps/stage`](../../apps/stage)
- Shared logic lives in [`@stage-labs/client`](../client)
