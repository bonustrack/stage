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
| `typography.fontSources`                          | N/A, Kit loads its own Calibre (see Fonts below)     |
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

The two Central Icons packages and `qrcode` come with the kit. The app provides the peers: `react`, `react-native`, `react-native-svg`, `react-native-markdown-display`, `react-native-gesture-handler`, `react-native-safe-area-context`, `react-native-reanimated` (`~4.3.1` or `4.5.1`), `expo-audio`, `expo-video`, `expo-document-picker`, `expo-image-picker` and `expo-font`. `expo-av` is no longer needed.

### Fonts

Kit ships Calibre Medium and Calibre Semibold (`src/fonts/`) and loads them by itself, so a new project renders kit text in Calibre with no setup. Loading starts as soon as `KitThemeProvider` or any kit component that draws text is imported. On web, Kit adds `@font-face` rules for `Calibre-Medium` and `Calibre-Semibold` (Vite and Expo both turn the font files into URLs). On iOS and Android it registers them with `expo-font`. Native text drawn before the fonts finish loading keeps the system font until it re-renders, so an app that wants Calibre on its very first frame waits with `useFonts(KIT_FONTS)` from `expo-font`, where `KIT_FONTS` (family name to font file) comes from `@stage-labs/kit/react-native/fonts`. Stage does this.

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

`VideoPlayer` takes `background` (default `#000000`), `aspectRatio` (default 16/9) and `fit` (`'contain'`, the default, or `'cover'`). Fullscreen always shows the whole video. `onVideoSize` gets the video's display size (`{ width, height }`, rotation applied) once it is known, so a caller can match `aspectRatio` to the video. On web it reads the `<video>` element's metadata; on iOS and Android it measures a small first frame, because the native track size ignores rotation. `Image` takes `headers`, sent with the image request, and the same module exports `getImageSize(src)`, which resolves to `{ width, height }`. On Android, `Image` also takes `resizeMethod` and `resizeMultiplier`, passed to React Native's `Image`, to choose the size the image is decoded at. Other platforms ignore them. `Dialog` takes `header` and `footer` nodes around its scroll body, `bottomInset` to lift the panel, `panelWidth`, `panelMaxWidth`, and `panelBorderSides` (`'top'` or `'all'`) for the `panelBorderColor` border. `Badge` has `solid`, `soft` and `outline` variants and is fully rounded by default (`pill={false}` gives the 8px `sm` radius). Besides the ChatKit props it takes `background`, any colour for `color` (the text colour when `background` is set), `textSize`, `weight` (default `semibold`), `truncate`, `style` and `textStyle`, and `children` in place of its label text for composed content such as icons; keep `label` as the plain text.

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
- `Image.src` must be `https://`. Colours are ChatKit tokens (`secondary`, `surface-secondary`, `success`, ...), hex, `rgb()`/`hsl()` or `{ light, dark }`; anything else is dropped. `Markdown` has HTML and images off, and a link calls `onOpenUrl` only for `https://` URLs. On web, with `onOpenUrl`, such a link is a real link (`href`, new tab): middle-click, Ctrl or Cmd click and the browser link menu work, and a plain click still calls `onOpenUrl`.
- Icons (`Icon.name`, `Button.iconStart`, `Button.iconEnd`) take ChatKit's 63 icon names, plus nine Stage names that ChatKit does not have: `arrow-up`, `chevron-down`, `chevron-up`, `copy`, `mic`, `send`, `share`, `thumbs-down` and `thumbs-up`. Any other name makes an `Icon` unsupported, and a `Button` drops it.
- Text sizes are the kit's own, with no frame text scale: `size` on `Text`, `Title`, `Caption` and `Label` takes any `FONT_SIZE` name (`3xs` 13px, `2xs` 14px, `xs` 16px, `sm` 17px, `md` 18px, `lg` 19px, `xl` 20px, `2xl` 24px, `3xl` 26px), and defaults to `md` (18px). Removed or unknown names are ignored. `Markdown` text is `md` too. Editable `Text` uses the field's control size. `Icon` keeps its separate size scale unchanged: `4xs` 13px, `3xs` 14px, `2xs` 15px, `xs` through `2xl` as above, `3xl` 32px and `4xl` 40px. `Badge`, `Button` and the fields keep their control sizes.
- Number spacing (`gap`, `padding`, `margin`, `Divider.spacing`) is in ChatKit spacing units of 4px; `"12px"` strings are pixels. Sizes (`width`, `height`, `size`) are pixels or `"50%"`.
- Actions: `Button.onClickAction`, `ListViewItem.onClickAction`, `Card` `confirm`/`cancel`, `Form.onSubmitAction` and the controls' `onChangeAction` call `onAction({ type, payload }, { label })`. The values of the fields in the same `Form` (or `Card asForm`, or the whole frame) are added to `payload` by `name` (`todo.title` nests), and a key already in the payload wins. A submit is blocked while a `required` field is empty. `handler` and `loadingBehavior` are ignored. While `onAction` runs, every button is disabled. Without `onAction`, or with `disabled`, the frame is read only.
- `dark` picks the scheme (default: the `KitThemeProvider` scheme); a root's `theme` overrides it for its subtree.
- `fill` (`{ padding, insetBottom? }`) shows the frame as a full page: the root grows to fill its container, a `Card` root loses its border and radius, and the root `background` (or the background of its `theme`) paints the whole area. `padding` is used only when the root sets no `padding` of its own, so `padding: 0` means no spacing. `insetBottom` is added at the bottom, for a safe area. A `ListView` root, which has no padding, keeps the fill padding. Without `fill`, the frame takes only the space its content needs.
- Layout follows CSS flex shrinking, which React Native does not do by default: `Box`, `Row`, `Col` and `Form` shrink to the width they get (`flexShrink: 1`, `minWidth: 0`), and so does text that can wrap, so a long title in a `Row` wraps on a phone instead of running off the edge. `Badge`, `Button`, `Icon`, `Image` and short single words (12 characters at most) keep their width. `frameFlex(node)` in `@stage-labs/kit/frame` gives this style.
- Sizing follows ChatKit's `BlockProps`: `width`, `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight` take px or a `%` string, and `minSize`/`maxSize` set both axes. A `Spacer` `minSize` applies along its parent's direction only. `Input` and `Textarea` fill the space they get, like ChatKit's `width: 100%` fields: the rest of a `Row`, the width of a `Col`. `Select` and `DatePicker` do the same only with `block`. A `soft` field (the default) inside a `Box`, `Row`, `Col` or `Form` with a `background` has no background of its own, so it blends in, as in a chat composer; use `outline` to keep a visible field. The pure helpers live in `src/frame.flow.ts`.
- `Basic` also takes `background`, like `Card`.
- `frameSummary(root)` gives a title and description from the first `Title` and text nodes, for previews.
- Screens: `widget` may also be `{ screens: { <id>: <widget> or { title, widget } }, start? }`, several screens in one frame (`start` defaults to the first id that is not a number, since JSON lists number keys first). In a frame with screens, an action of type `frame.open` with `payload.screen` opens that screen and `frame.back` goes back, with no `onAction` call, even when the frame is read only (a plain widget sends them like any action). Every other action gets `screen` (the current screen id) in its payload, unless the payload has one. The 64K characters cover all the screens together, at most 50 screens, and depth and node limits apply per screen. An unknown screen shows a short notice. `parseFrameDoc` (`@stage-labs/kit/frame`) parses both shapes, and `frameNavOf`, `navigateFrame` and `withScreen` are the pure navigation steps.
- `Frame` keeps its own back stack. A host that shows its own back button passes `navigation` from `useFrameNavigation(start)` (`{ screen, depth, navigate }`) and calls `navigate({ kind: 'back' })` from it.

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
  link.ts            # web link helpers: NEW_TAB (target _blank, rel noopener noreferrer) and isPlainClick, shared with the app's links
  fonts/             # Calibre Medium and Semibold (KIT_FONTS in react-native/fonts.ts, loaded by react-native/fonts.load.ts on web and fonts.load.native.ts on iOS and Android)
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

Stories use the Storybook component-story format: a default export with a `title`, named exports that render the component, and `args` / `argTypes` on each export. Every kit component has a `Controls` story exposing all of its props as controls (unions as selects, booleans as switches, numbers, text and colours), and the ones with variant axes (Button, Badge, Text, Title, Icon, Image, Input, Box, Avatar) also have a matrix story showing every option at once. The `Theme` story drives the `ThemeOption` surface (accent, grayscale, surface, radius, density, base size) through `derivePalette`. Control values live in the URL hash, so a configured story is a shareable link; the sun/moon toggle in the sidebar switches the scheme, sets the document `color-scheme` so native scrollbars follow, and flows into `KitThemeProvider`. Below 768 px wide the sidebar turns into a menu that opens from a top bar, which also holds the toggle, and below 1024 px the controls sit under the preview. Only kit components appear in stories; app UI from `apps/stage` never does.

## Scripts

| Script              | Description                  |
| ------------------- | --------------------------- |
| `bun run typecheck` | Type-check without emitting. |
| `bun run test`      | Run the unit + snapshot tests (`test/*.spec.ts`). |
| `bun run storybook` | Gallery dev server with a story per component. |
| `bun run storybook:build` | Static gallery build into `build/`. |

Form controls (`Input`, `Textarea`, `TextField`, `Select`, `DatePicker`) default to `CONTROL_RADIUS_DEFAULT` (8px) and draw no focus ring: no accent border on focus and `outlineWidth: 0` with `outlineStyle: 'solid'` so the browser's own ring (which ignores width in its `auto` style) stays off on web. `Select` opens a `DropdownMenu` anchored under its trigger. `Modal` wraps `Dialog` with the Stage look (page background, no border unless `borderColor` is passed, 17px radius, optional 24px semibold title, centered with a 480px max width or a bottom sheet). Its header stays above the scrollable content and includes a labeled close button with a hover tooltip. Set `dismissable={false}` to hide the close button and prevent backdrop and Escape dismissal. `Dialog` accepts an optional `header` above its scroll body and uses a separate backdrop target, so dragging from the panel to the backdrop does not dismiss it. `DropdownMenu`/`DropdownMenuItem`/`DropdownMenuSeparator` and `Tooltip` default to the Stage app look (menu surface on the border colour, 6px radius, 4px list padding; tooltip bubble with arrow) and share `OVERLAY_SHADOW` from `overlay.styles.ts` (web tooltips use the matching `drop-shadow` so the arrow is shaded too). `DropdownMenuItem` accepts optional `children` in place of its label text for composed values or badges; keep `label` as the full accessible name, and use `useDropdownMenuText` from `react-native/menu` for the shared dropdown and sheet typography. `Tooltip` takes an optional `trailing` node, shown after the label, such as a keyboard shortcut. `DropdownMenuSheet` is the same menu surface in a `Dialog` for touch and narrow screens (a borderless bottom sheet, or centered), so its rows are the same `DropdownMenuItem`s. The segmented `Tabs` is a full pill track on the raised surface with a pill thumb on the page surface. Labels use the default text role when selected and the secondary role otherwise, in Calibre Medium at `FONT_SIZE.sm`. Without `dark` it follows the `KitThemeProvider` scheme and palette. Cards and images keep `BLOCK_RADIUS_DEFAULT` (12px). `Markdown` styles come from `markdown.styles.ts` (`@stage-labs/kit/markdown-styles`), which overrides every default of `react-native-markdown-display` so nothing bleeds through; callers can pass body size, line height, paragraph gap and link colour.

Linting is centralised at the repo root (`bun run lint`). The package is published to npm by `publish-kit.yml`; other codebases consume it, so components, tokens and style setup are never removed because the app stopped using them.

## Changelog

### 0.1.0-beta.3

- Kit now ships Calibre Medium and Calibre Semibold and loads them by itself: `@font-face` rules on web, `expo-font` on iOS and Android. A new project no longer falls back to the system font. New export `@stage-labs/kit/react-native/fonts` with `KIT_FONTS` (family name to font file, for `useFonts`). `expo-font` is a new peer dependency.
- `Badge` is fully rounded by default. Pass `pill={false}` for the former 8px (`sm`) radius. Frame badges without `pill` are fully rounded too.
- New `Badge` props: `background`, any colour for `color` (as `resolveBadgeStyle` already accepted), `textSize`, `weight`, `truncate`, `style`, `textStyle` and `children` (in place of the label text). Stage draws its labels with `Badge` and keeps their look.
- `Text size="3xl"` is now 26px instead of 32px, matching the landing paragraph. Mail H1 and Frame `Text`/`Title`/`Caption`/`Label` explicitly sized `3xl` also render at 26px, including existing payloads; no legacy mapping is added. The 26px snap entry uses `3xl`. Icons retain their separate 32px `3xl` size.
- `Title hero="3xl"` now matches onboarding: 38px/46px in Calibre Medium instead of 44px/46.2px Semibold. Onboarding uses this named component, while the landing paragraph keeps its 31.2px line height on `Text size="3xl"`. `Title hero="4xl"` (76px/83.6px Medium), wallet typography (60px/63px Semibold), ordinary Title sizes and computed Markdown styles are unchanged.
- `Title hero="4xl"` now matches the landing headline: 76px with 83.6px line height in Calibre Medium, rather than the former 60px/63px Calibre Semibold. Hero 3xl and ordinary Title sizes are unchanged. The landing uses this variant without a custom size; the wallet keeps its former 60px/63px Semibold appearance through `BALANCE_TITLE_STYLE`, exported by the existing Title module.
- Custom 11px and 12px text now uses `3xs` (13px), including all badge text, small Card status text, calendar weekday labels, `Caption size="sm"`, `Label size="xs"` and gallery labels. `SMALL_FONT_SIZE` is removed and `BadgeFontToken` now uses `3xs` only. Component size names, padding, icons and control dimensions are unchanged. Other fixed app text sizes use the exact matching Text token where available; unmatched and computed sizes stay unchanged.
- Stage, kit controls, Markdown defaults and the gallery use `xs` (16px) instead of the former `2xs` (15px) text.
- Breaking text token rename: former `4xs` (13px) is now `3xs`; former `3xs` (14px) is now `2xs`. `4xs` and the unused Text `4xl` (40px) option are removed from `FontSizeName`, `TextSizeToken`, `FONT_SIZE`, `fontSize()` and text selectors. `xs` through `3xl` and default `md` remain unchanged. Rename existing text consumers simultaneously to keep their pixel sizes. `caption` and the badge font token use `3xs`, still 13px. Badge/control size names, icon dimensions, spacing and radii are unchanged. The separate `Title` hero scale is not the removed Text option.
- `FONT_SIZE_SNAP` now uses `3xs` for 10 through 13, `2xs` for 14, and `xs` for 15 and 16. The 15px font token no longer exists; larger snap entries are unchanged.
- Frame text and gallery URL arguments use the new names literally. The previous `2xs` to `xs` normalization is removed, so newly selected `2xs` is 14px, not 16px. Gallery Text controls and the matrix include all nine current sizes. A removed size in a gallery URL uses the default text size.
- Existing `stage.box/frame:1.0` payloads and gallery URLs also use the new text scale, so their historical rendering can change. An unchanged old `3xs` now means 13px rather than 14px, and an old Frame/gallery `2xs` now means 14px rather than the previous 16px normalization. Removed Frame text sizes `4xs` and `4xl` are ignored and fall back to `md` (18px). No typography version, legacy-size mapping or persisted-payload migration is added. Historical changelog entries below describe their release's names.
- `DropdownMenuItem` takes optional `children` in place of its label text, and `react-native/menu` exports `useDropdownMenuText`, the shared dropdown and sheet menu text style.
- `Dialog` and `DropdownMenuSheet` take `avoidKeyboard`, which keeps the panel above the keyboard on iOS.
- `react-native/input` exports `SEARCH_INPUT_PROPS`: web props for search fields that keep password managers out and stop Escape from clearing the field.
- `Button` labels use Calibre Medium instead of Semibold, and `xs` and `sm` buttons use `2xs` (14px) and `xs` (16px) text. `Caption` `sm` and `md` use the `Text` sizes of the same name (17px and 18px).
- Frame buttons with a long label wrap it and grow instead of cutting it off.

### 0.1.0-beta.2

#### New component

- `Frame` renders OpenAI ChatKit widget JSON with kit components, with validation, limits and actions. See Frame above. `@stage-labs/kit/frame` has its pure `parseFrame` and `frameSummary`.

#### Breaking changes

- The `Tabs` option `icon` and the `DropdownMenuItem` `iconName` take a Central icon, like `Glyph`, for example `icon: IconBubble3` instead of `icon: 'chatBubble'`. HeroIcon names still work with `Icon`.
- `@stage-labs/kit/react-native/dropdown-menu` now exports the same `DropdownMenu`, `DropdownMenuItem`, `DropdownMenuSeparator` and `DropdownMenuSheet` as `@stage-labs/kit/react-native/menu`.
- `Text` sizes (`TextSizeToken`, `FontSizeName`, `FONT_SIZE` and `fontSize()`) moved three steps down. Each pixel size now has the name three steps below: `4xs` is 13px (was `xs`), `3xs` 14px (was `sm`), `2xs` 15px (was `md`), `xs` 16px (was `lg`), `sm` 17px (was `xl`), `md` 18px (was `2xl`), `lg` 19px (was `3xl`), `xl` 20px (was `4xl`), `2xl` 24px (was `5xl`), `3xl` 32px (was `6xl`) and `4xl` 40px (was `7xl`). `5xl`, `6xl` and `7xl` were removed. To keep the same size, rename each size three steps down: `md` to `2xs`, `xs` to `4xs`, `7xl` to `4xl`. `caption` text uses `4xs`, still 13px. `FONT_SIZE_SNAP` maps to the new names.
- The default `Text` size (`FONT_SIZE_DEFAULT`, used when `size` is not set) is still `md`, which is now 18px. It was 15px. To keep 15px, pass `size="2xs"`. `caption` text keeps 13px.
- `Title` `hero` sizes moved the same way: `3xl` is 44px (was `6xl`) and `4xl` is 60px (was `7xl`).
- `SMALL_FONT_SIZE` moved the same way: `5xs` is 12px (was `2xs`) and `6xs` is 11px (was `3xs`). `BadgeFontToken` is now `6xs`, `5xs` or `4xs`. `Badge` sizes did not change.

#### Smaller bundles

- `Tabs`, `DropdownMenu`, `Select` and `DatePicker` no longer load `CENTRAL_ICON_ALIASES`, which pulls in every aliased icon (about 110 KB gzip on web). Only `Icon` loads it now.

#### New props

- `Image`: `resizeMethod` and `resizeMultiplier` on Android, to choose the size the image is decoded at.
- `VideoPlayer`: `onVideoSize`, called with the video's display size once it is known.
- `TextField`: `dataSet`, passed to the input on web (`data-*` attributes).

#### New exports

- `@stage-labs/kit/link`: `NEW_TAB` (target `_blank`, rel `noopener noreferrer`) and `isPlainClick`, the web link helpers.

#### Visual changes

- `Frame` text uses the kit sizes: a `size` is the `FONT_SIZE` of the same name, `md` (18px) when not set, on `Text`, `Title`, `Caption`, `Label` and `Icon`, and `Markdown` text is 18px. Frames had their own scales before: `Text` `md` was 15px, `Title` `md` 18px, `Caption` 13px, `Label` 15px and `Markdown` 15px. `size` also takes every other kit name, such as `2xs`. The ChatKit `Title` size `5xl` is not a kit name and is ignored.
- `Spinner` is the Stage app spinner: a ring that fades into its tail and turns once every 0.5s. On web it spins with a CSS animation. Without `color` it takes the heading colour of the theme, black in light and white in dark (it was `#888888`).
- `Button` `loading` shows `Spinner` instead of the platform `ActivityIndicator`.
- `Button` `xl` is the Stage landing button: 53px high (was 56px), Calibre Medium (was Calibre Semibold) at `FONT_SIZE.lg` 19px (was 18px) with a 29px line height, still 24px side padding. Square `uniform` `xl` buttons are 53px too.
- `Button` `md` labels are `FONT_SIZE.sm` 17px (were 15px) and `lg` labels are `FONT_SIZE.md` 18px (were 17px). Heights and padding did not change. `xs` and `sm` did not change.

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
