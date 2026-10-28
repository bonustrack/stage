# @stage-labs/kit

> The Stage design system: A2UI v1.0 components for React Native and web, an A2UI renderer, the Stage Kit catalog, tokens, icons and theme contracts.

## Overview

`@stage-labs/kit` is the single source of truth for how Stage looks. It ships one React Native component family (rendering on web via react-native-web), the colour, spacing and type tokens, Central Icons with HeroIcon name aliases, avatar helpers, the theme-preference contract, and a framework-free implementation of the [A2UI](https://a2ui.org) v1.0 protocol with a React Native renderer. The universal app ([`apps/stage`](../../apps/stage)) composes the components directly in JSX; agents send A2UI messages that the same components render.

Style logic lives in framework-free core modules (`text.styles.ts`, `button.styles.ts`, `control.styles.ts`, `layout.ts`); components target React Native via peer dependencies and render on every platform, web included.

## Design north star: A2UI first, ChatKit for the extras

**Kit's components are the [A2UI v1.0 basic catalog](https://a2ui.org/specification/v1.0-a2ui/).** Every basic catalog component exists under its A2UI name with its A2UI props, literal unions and defaults. Where A2UI is silent, Kit adds extras that keep the names of [OpenAI ChatKit](https://openai.github.io/chatkit-js/) (`size`, `color`, `pill`, `block`, `ThemeOption`, ...). Rules:

- **A2UI first.** If A2UI has the concept, use its name and values (`Column`, `CheckBox`, `justify: 'spaceBetween'`, `variant: 'caption'`). Never add a Kit component that duplicates an A2UI one.
- **ChatKit for what A2UI lacks.** Extra props and the few extra components (`Title`, `Badge`, `ListView`, ...) mirror ChatKit's names. Don't invent names or token values; never write a raw literal where a token exists (`FONT_SIZE`, `fontName`, `semanticColors`, `RADIUS_SCALE`).
- **Clashes resolve to A2UI.** A2UI's `weight` is flex-grow on every component, so font weight is `fontWeight`. Button `variant` accepts both A2UI's hints (`default | primary | borderless`, default `default`) and ChatKit's fills (`solid | soft | outline | ghost`) used with `color`.
- **JSX adaptations.** A2UI child ids become React children (`child`, `children`, `trigger`, `tabs[].child`), `action` becomes `onPress`, two-way bound values become `value` + `onChange` (`onChangeText` on `TextField`), and `checks` takes already-evaluated `ValidationResult`s. Every component accepts the A2UI common props `weight` and `accessibility`.

### Components

| A2UI basic catalog | Kit component | Kit extras (ChatKit names) |
| --- | --- | --- |
| `Text` (`text`, `variant: body \| caption`) | `react-native/text` | `size`, `fontWeight`, `color`, `textAlign`, `italic`, `lineThrough`, `truncate`, `maxLines`, `fontFamily: sans \| head \| mono`, `markdown` |
| `Image` (`url`, `description`, `fit`, `variant`) | `react-native/image` | `radius`, `size`, `width`, `height`, `aspectRatio`, `background`, `frame`, `flush`, `headers`, Android `resizeMethod` / `resizeMultiplier` (a blank `url` renders a placeholder; `getImageSize(url)` measures one) |
| `Icon` (`name`, `{ svgPath }`) | `react-native/icon` | Central Icons through their HeroIcon alias names and brand names on top of the 59 A2UI names, `size`, `color`, `variant: line \| solid` |
| `Video` (`url`, `posterUrl`) | `react-native/video` | `controls`, `background`, `aspectRatio`, `fit: contain \| cover`, `onVideoSize` |
| `AudioPlayer` (`url`, `description`) | `react-native/audio-player` | `waveform`, `bars`, `accent`, ... |
| `Row` / `Column` (`children`, `justify`, `align`) | `react-native/row`, `react-native/column` | `gap`, `padding`, `margin`, `wrap`, `surface`, `background`, `radius`, sizes, `border`, `align: baseline` |
| `List` (`children`, `direction`, `align`) | `react-native/list` | `gap`, `padding`, and every `ScrollView` prop and ref; both directions scroll |
| `Card` (`child`) | `react-native/card` | `size`, `padding`, `background`, `status`, `confirm`, `cancel`, `onPress` |
| `Tabs` (`tabs: { title, child }[]`) | `react-native/tabs` | `variant: segmented \| underline`, `selectedIndex`, `onChange` |
| `Modal` (`trigger`, `content`) | `react-native/modal` | `open`, `defaultOpen`, `onClose`, `title`, `footer`, `side`, `dismissable`, `fullBleedPanel`, `gestureRoot`, backdrop options |
| `Divider` (`axis`) | `react-native/divider` | `spacing`, `color`, `size`, `flush` |
| `Button` (`child`, `variant`, `action`, `checks`) | `react-native/button` | `color`, `size`, `pill`, `block`, `uniform`, `label`, `iconStart`, `iconEnd`, `loading`, tints |
| `TextField` (`label`, `value`, `placeholder`, `variant`, `checks`) | `react-native/text-field` | `appearance: soft \| outline \| plain`, `hint`, `trailing`, `inputType`, composer options; a `label` gives the Stage form-field look |
| `CheckBox` (`label`, `value`, `checks`) | `react-native/check-box` | `displayStyle: checkbox \| switch` |
| `ChoicePicker` (`options`, `value`, `variant`, `displayStyle`, `filterable`) | `react-native/choice-picker` | `direction` |
| `Slider` (`min`, `max`, `value`, `steps`) | `react-native/slider` | `showValue`, `onChangeEnd` |
| `DateTimeInput` (`value`, `enableDate`, `enableTime`, `min`, `max`) | `react-native/date-time-input` | `placeholder`, `appearance`, `clearable` |

Kit extras with no A2UI equivalent, kept because Stage needs them: `Title`, `Badge` (with `fontWeight`, `textSize`, `background`, composed `children`), `ListView` / `ListViewItem`, `Spinner`, `QrCode`, `Chart` (ChatKit's Chart widget, see below), `DropdownMenu`, `Tooltip`, `VoiceRecorder`, `ColorPicker`, `FilePicker`, `Glyph` (draws one Central icon), and the platform primitives `Pressable` and `GesturePressable`.

### Theme

A2UI v1.0 leaves branding to the renderer, so the theme stays Kit's ChatKit-shaped `ThemeOption` surface (every key name and literal union matches ChatKit):

| ChatKit | Kit |
| --- | --- |
| `colorScheme: 'light' \| 'dark'` | `Scheme` (`tokens.ts`) |
| `radius: 'pill' \| 'round' \| 'soft' \| 'sharp'` | `RadiusName` + `RADIUS_SCALE` |
| `density: 'compact' \| 'normal' \| 'spacious'` | `Density` + `DENSITY_SCALE` |
| `typography.baseSize: 14\|15\|16\|17\|18` | `BaseSize` + `BASE_SIZE_DEFAULT` |
| `typography.fontFamily` / `fontFamilyMono` | `fontFamily.sans` / `.mono` (+ `fontName.*` for RN) |
| `color.surface: { background, foreground }` | `SurfaceColors` (`theme-derive.ts`) |
| `color.accent: { primary, level: 0\|1\|2\|3 }` | `AccentColor` |
| `color.grayscale: { hue, tint: 0-9, shade?: ±4 }` | `GrayscaleOptions` |

OpenAI publishes ChatKit's theme types but not its colour maths, so `theme-derive.ts` implements the documented semantics itself, and the defaults are lossless (guarded by tests). Colour tokens (`text`, `secondary`, `muted`, `link`, `primary`, `danger`, `success`, `border`) on `Text`, `Row`/`Column` backgrounds and the A2UI renderer resolve against the live palette from `KitThemeProvider`.

## A2UI

`src/a2ui/` is a framework-free implementation of A2UI v1.0 (candidate), with the official schemas vendored in `src/a2ui/schemas/`:

- **Protocol:** every agent-to-renderer message (`createSurface` with inline components and data model, `updateComponents`, `updateDataModel`, `deleteSurface`, `callRendererFunction`, `agentFunctionResponse`) and every renderer-to-agent message (`action`, `callAgentFunction`, `rendererFunctionResponse`, `error`), JSON / JSONL / list / wrapper intake, capabilities and the `sendDataModel` transport metadata.
- **Validation:** a JSON Schema (draft 2020-12 subset) validator with the spec's cross-catalog `$ref` rules. It passes all 154 cases of the official v1.0 conformance suite (`test/a2ui/cases`). Invalid components are dropped with `VALIDATION_FAILED`; composition rules report `UNALLOWED_PARENT` / `UNALLOWED_CHILD`; surface misuse reports `INTEGRITY_ERROR`.
- **Evaluation:** JSON Pointer bindings with list-template scopes and relative paths, `formatString` expressions, `@index`, `@@` escapes, the basic functions (`required`, `regex`, `length`, `numeric`, `email`, `formatString`, `formatNumber`, `formatCurrency`, `formatDate`, `pluralize`, `openUrl`, `and`, `or`, `not`), `allowedCallers` and `requiresUserActivation`, and agent-side functions with pending state.
- **Agent functions:** as the spec says, a call to a function the renderer does not implement goes to the agent as `callAgentFunction` and settles from its `agentFunctionResponse` (the basic and Kit catalogs declare none today). In the Kit catalog the agent may call `formatString`, `formatNumber`, `formatCurrency`, `formatDate` and `pluralize` with `callRendererFunction`; everything else, `openSurface` and `closeSurface` included, stays renderer only.
- **Screens:** the Kit catalog adds two functions, `openSurface({ surfaceId })` and `closeSurface()` (user activation required), that reach the host through the client's `navigate` option, so one message can carry several surfaces shown as screens with a back button.
- **Snapshots:** `a2uiSnapshot(messages)` (`@stage-labs/kit/a2ui/snapshot`) replays a message log in a headless client and returns one `createSurface` per surface that renders (components and data model inline) plus the diagnostics, which is how a host stores or validates a surface. `dataModelUpdates(client)` turns a live client's data model back into messages, so local edits survive a reply.

```tsx
import { createA2uiClient } from '@stage-labs/kit/a2ui/client';
import { A2uiSurface } from '@stage-labs/kit/react-native/a2ui-surface';

const client = createA2uiClient({ send: (message, metadata) => transport.send(message, metadata), openUrl });
client.receive(jsonlFromAgent);

<A2uiSurface client={client} surfaceId="payment_request" onActionError={toast} />
```

In React, `useA2uiClient(messages, options)` (`@stage-labs/kit/react-native/a2ui-session`) builds the client for a message list and keeps the latest callbacks; its `send` also gets the client. `A2uiSurface` takes `disabled` (read only: no actions, inputs and buttons disabled) and `mediaUrl`, a filter applied to every `Image`, `Video` and `AudioPlayer` URL (return `''` to block one).

`client.capabilities()` advertises the basic catalog and the **Stage Kit catalog**. The Kit catalog (`https://kit.stage.box/a2ui/v1_0/catalog.json`, built in `src/a2ui/kit-catalog.ts` from the Kit tokens) inherits every basic component and function from the basic catalog and adds the Kit extras: extra props, token enums (font sizes, colours, radii), the HeroIcon and brand icon names, and the `Title`, `Badge`, `ListView`, `ListViewItem`, `Spinner`, `Chart` and `QrCode` components. Every Kit style prop also takes a data binding or a function call (a status colour, a bar width), and `Row`/`Column` take `width`, `height`, their min and max, `aspectRatio` (pixels or a percentage such as `"40%"`), per-side `padding` and a `border`. The renderer keeps only Kit tokens and hex colours, pixel or percentage sizes and known padding sides from the data, and drops anything else. As the spec says, inputs only write to the data model: a Button action whose context references the input paths (or `sendDataModel`) sends their values. A single-line Kit `TextField` can also take a standard `action`, run when the user presses Enter (a submit, never on typing, and not while its checks fail), for inline renames and searches. The gallery build publishes it at that URL. Stage frames and nodes use these messages as their wire format (see [`NODES.md`](../../NODES.md)). The renderer (`react-native/a2ui-renderers*.tsx`) maps every component of both catalogs onto the Kit components above; hosts can pass extra renderers for their own catalogs. A Kit `List` with `sortable: true` renders through the sortable components (`indicator` `preview` by default, or `line`): on drop it reorders the bound arrays in the local data model, writes the move to its `move` binding and runs its standard `action`. A Kit `List` is as tall as its content (it grows only with `weight`) and takes `padding`. `DropdownMenu` opens a menu of rows with standard actions below its trigger, a `Modal` `open` bound to a path opens and closes it from the data model, icon-only Buttons, Icon and Image show their `accessibility.label` as a tooltip on hover, a Button with an event action inside a `Modal` closes the Modal once the action is sent, `borderless` buttons render as links (no padding or background, as the basic catalog describes them), and Text takes `fontFamily: head`, the heading face of `Title`. `Video` and `AudioPlayer` need Expo (`expo-video`, `expo-audio`), so they are not in the default set: hosts that run Expo pass `MEDIA_RENDERERS` from `react-native/a2ui-media`. `a2ui/*` imports no React, React Native or Expo module, so servers can use the client and the catalog.

## Install

Inside the monorepo, workspaces use `workspace:*`, so no separate install is needed.

```sh
bun install            # from the repo root
```

```jsonc
// in a consuming workspace's package.json
"dependencies": { "@stage-labs/kit": "workspace:*" }
```

Other apps install it from npm. Releases go out under the `beta` tag and `latest` follows them, so a plain install gets the newest release:

```sh
bun add @stage-labs/kit
```

The two Central Icons packages and `uqr` (the QR encoder) come with the kit. The app provides the peers: `react`, `react-native`, `react-native-svg`, `react-native-markdown-display`, `react-native-gesture-handler`, `react-native-safe-area-context`, `react-native-reanimated` (`~4.3.1` or `4.5.1`), `expo-audio`, `expo-video`, `expo-document-picker`, `expo-image-picker` and `expo-font`.

### Fonts

Kit ships Calibre Medium and Calibre Semibold (`src/fonts/`) and loads them by itself, so a new project renders kit text in Calibre with no setup. Loading starts as soon as `KitThemeProvider` or any kit component that draws text is imported. On web, Kit adds `@font-face` rules for `Calibre-Medium` and `Calibre-Semibold` (Vite and Expo both turn the font files into URLs). On iOS and Android it registers them with `expo-font`. Native text drawn before the fonts finish loading keeps the system font until it re-renders, so an app that wants Calibre on its very first frame waits with `useFonts(KIT_FONTS)` from `expo-font`, where `KIT_FONTS` (family name to font file) comes from `@stage-labs/kit/react-native/fonts`. Stage does this.

## Usage

```ts
import { colors, resolveColorToken } from '@stage-labs/kit/tokens';
import { resolveBadgeStyle } from '@stage-labs/kit/badge';
```

```tsx
import { Button } from '@stage-labs/kit/react-native/button';
import { Column } from '@stage-labs/kit/react-native/column';
import { Text } from '@stage-labs/kit/react-native/text';

<Column gap={8}>
  <Text text="Hello" size="xl" fontWeight="semibold" />
  <Text variant="caption" text="Small print" />
  <Button variant="primary" label="Continue" onPress={next} />
</Column>
```

`Text` with `markdown` renders A2UI's simple Markdown: no HTML, images or links, which show as plain text. Text sizes are the `FONT_SIZE` tokens: `3xs` 13px, `2xs` 14px, `xs` 16px, `sm` 17px, `md` 18px (body), `lg` 19px, `xl` 20px, `2xl` 24px, `3xl` 26px. The `caption` variant defaults to `3xs` in the secondary colour. `Title` takes `hero` (`3xl` or `4xl`) for the landing and onboarding headlines.

Icons are [Central Icons](https://centralicons.com) (round, radius 1, stroke 2) from the licensed `@central-icons-react-native/*` packages, which the kit depends on rather than vendoring. Import each icon on its own, under its Central name, and draw it with `Glyph`:

```tsx
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { IconThumbtack } from '@central-icons-react-native/round-filled-radius-1-stroke-2/IconThumbtack';

<Glyph icon={IconThumbtack} size={16} color={link} />
```

The package picks the style: `round-outlined-radius-1-stroke-2` is `line`, `round-filled-radius-1-stroke-2` is `solid`. Metro does not tree-shake, so a per-icon import is what keeps the other icons out of the bundle. `Icon` also takes names: the HeroIcon aliases in `CENTRAL_ICON_ALIASES`, the 59 A2UI icon names (`icons.a2ui.ts` maps each one onto a Central icon) and the brand icons, with `variant` `'line'` (default) or `'solid'`; it bundles every named icon. Installing the packages with a package manager that runs dependency install scripts needs a Central licence key; Bun does not run them.

`AudioPlayer` and `Video` play through the `expo-audio` and `expo-video` peers. On web those modules expect the Expo runtime global: an Expo app installs it, and a plain react-native-web host must call `installExpoGlobalPolyfill()` from `expo-modules-core/src/polyfill/dangerous-internal` before importing them, as `gallery/expo-runtime.ts` does. `Video` fullscreen always shows the whole video, and `onVideoSize` gets the display size (rotation applied) once it is known.

## Chart

`Chart` (`@stage-labs/kit/react-native/chart`), a Kit extra, draws OpenAI ChatKit's `Chart` widget with `react-native-svg`, on web, iOS and Android. It takes the same props, with the same defaults, so the JSON of a ChatKit chart works as is. The layout maths (scales, bars, curves, colours) is in `@stage-labs/kit/chart`, with no React.

```tsx
import { Chart } from '@stage-labs/kit/react-native/chart';

<Chart
  data={[{ month: 'Jan', web: 186, mobile: 80 }, { month: 'Feb', web: 305, mobile: 200 }]}
  xAxis="month"
  series={[
    { type: 'bar', dataKey: 'web', label: 'Web' },
    { type: 'line', dataKey: 'mobile', label: 'Mobile', color: 'orange' },
  ]}
/>
```

- `data` is a list of rows of `string` or `number` values. `xAxis` is the key of the category, or `{ dataKey, hide, labels }`, where `labels` maps a value to the text shown for it. Numbers beyond 1e300 count as missing.
- `series` are `bar` (with `stack`), `area` (with `stack` and `curveType`) and `line` (with `curveType`), each with `dataKey`, `label` and `color`. Series with the same `stack` are stacked. `curveType` takes d3's curve names: `natural` (the default), `linear`, `monotone`, `step`, `stepBefore`, `stepAfter`, `basis`, `bump` and the rest of ChatKit's list. A row without a number for a series leaves a gap.
- Defaults are ChatKit's: no y axis (`showYAxis`), a legend when a series has a `label` (`showLegend`), a tooltip (`showTooltip`), `aspectRatio` 4/3, and 5 round y ticks from 0, like Recharts. `barGap` is the space between the bars of one category (3px by default) and `barCategoryGap` the space on each side of a category (10% of it by default), in pixels.
- `yAxis.domain` follows the current ChatKit Widget Builder: a two-item tuple of finite numbers, `"auto"`, `"dataMin"` or `"dataMax"`, applied with `showYAxis: true`. Use `{ domain: ["dataMin", "dataMax"] }` for a data-based price range; omitted domains keep the zero-based default (`[0, "auto"]`). Numeric bounds expand to contain the data, `auto` uses round ticks, stacks include their bases and totals, and constant values get a nonzero range. Invalid domains or numeric bounds beyond 1e300 are ignored. Values and tooltips are never transformed.
- Colours: a series without `color` takes ChatKit's chart colours in order (`blue`, `purple`, `orange`, `green`, `red`, `yellow`, `pink`). A chart with a single bar series and no `color` gets one colour per bar, as in ChatKit. `color` also takes a primitive token (`blue-500`, `gray-300`, `alpha-10`), a Kit colour token (`primary`, `success`, ...), a CSS colour or `{ light, dark }`. The grid, axes, labels, legend and tooltip use the Kit theme.
- Size: `width` (`100%` by default), `height`, `size`, `minWidth`, `minHeight`, `minSize`, `maxWidth`, `maxHeight`, `maxSize` and `flex`, as on a `Box`. Without `height` or `size`, the height comes from `aspectRatio` (a number or a string such as `"16/9"`). The height includes the axis labels and the legend.
- The tooltip shows the category and the value of each series. It opens on hover over a category with a mouse. On a touch screen a tap opens it and a second tap closes it, and the tap still reaches a pressable parent such as a `ListViewItem`.
- `dark` picks the scheme. Without it the chart follows `KitThemeProvider`.

## Sortable

`@stage-labs/kit/react-native/sortable` makes items draggable between and within lists on web and native, built on `react-native-gesture-handler` with JS-thread callbacks (no Reanimated worklets).

```tsx
<SortableScope>
  <SortableList listId="todo" group="board" itemIds={ids} onMove={(move) => save(move)}>
    {cards.map(card => <SortableItem key={card.id} itemId={card.id}><Card>{card.title}</Card></SortableItem>)}
  </SortableList>
</SortableScope>
```

- `SortableScope` coordinates the lists inside it and draws the drag preview. A `SortableList` without a scope makes its own.
- `SortableList` takes `listId`, the `itemIds` in order, `onMove(move, source)`, and optionally `group` (lists of a group exchange items), `direction`, `gap`, `label`, `payload` (handed back as `source.payload`), `accepts(move)`, `placeAt(move)` (the index the item will really land at, for sorted lists), `indicator`, `touchAction`, `keyboard` and `disabled`. `children` can be a function of `{ over, placeholder }`: such a host renders `placeholder` itself where an empty list shows its items.
- `SortableItem` takes `itemId`, `disabled`, `onHold` (a touch hold released without moving), `handle` (drag only from a `SortableHandle` inside it) and `follows` (the id of another item it moves with: not draggable itself and not in `itemIds`, for example the rows under a section header). `children` can be a function of `{ dragging }`.
- `indicator` is `preview` (the default: a floating copy follows the pointer, the item leaves its place and a dimmed copy takes real space where it will land, in any list of the group, so the others make room through normal layout), `line` (the item stays dimmed in place and a line marks the drop place), `none` (the preview only, for hosts that draw their own feedback with `useSortableTarget(listId)`), `shift` (in place, within one list: the dragged item and its followers follow the pointer along the list and the items it passes slide by its size) or `follow` (in place without sliding the others).
- Nested lists: a `SortableItem` joins its nearest `SortableList`, or the ancestor named by its `listId`, so one cell can be a follower in one list and a draggable item in another. `touchAction` (`manipulation`, `pan-x` or `pan-y`) sets which browser pans stay available on touch. `useSortableActive()` returns a getter that is true while a drag runs, for guarding other long-press handlers. `moveAnchor(move)` (pure) is the neighbour the item took the place of.
- Positions come from `itemIds` and whichever items are rendered, so a `SortableList` around a virtualized list (`FlatList`, a windowed web list) orders correctly with most rows unmounted.
- A move is `{ itemId, fromListId, toListId, fromIndex, toIndex, beforeId, afterId }`, where `toIndex` and the neighbours count the target list without the moved item. The lists do not reorder anything themselves: the host updates its data in `onMove`.
- Outside every list, the pointer targets the nearest list of the group across it (inside the scope), so dropping below the last card of a short column lands at its end.
- Touch lifts after a long press, a mouse after a few pixels. On web the page and scroll containers scroll at the edges, and the click after a drop is swallowed. With `keyboard`, a focused item lifts with Space or Enter, moves with the arrow keys (into the next list of the group across the other axis), drops with Space or Enter and cancels with Escape, and screen readers get the same moves as accessibility actions, with announcements.

## Project structure

```
src/
  a2ui/              # A2UI v1.0 core: protocol, schemas, validator, evaluator, functions, client, Kit catalog
  tokens.ts          # colour + spacing tokens, colour helpers (Scheme, resolveColor, resolvePaletteColor, ...)
  theme.ts           # theme-preference contract + resolution
  theme-derive.ts    # custom-palette deriver
  icons.ts           # icon names; central-icons.ts maps HeroIcon names onto Central Icons
  icons.a2ui.ts      # the 59 A2UI icon names mapped onto Central Icons
  chart.ts           # Chart layout core: scales, bars, curves and colours
  fonts/             # Calibre Medium and Semibold, loaded by react-native/fonts.load*.ts
  layout.ts          # Row/Column layout core (spacing, borders, surfaces)
  text.styles.ts / button.styles.ts / control.styles.ts / badge.ts / markdown.styles.ts  # style cores
  react-native/      # THE component family + the A2UI renderer (a2ui-surface.tsx), renders on web via RNW
stories/             # one story file per component (controls for every prop + variant matrices) + A2UI surfaces
gallery/             # the storybook shell: Vite entry, sidebar, controls panel, hash routing
vite.config.ts       # react-native-web aliasing for the gallery, publishes the Kit catalog
```

## Storybook

The component gallery is a small hand-rolled page in `gallery/`, served by Vite and drawn entirely with kit components, so it looks like the kit and renders text exactly as the app does (same fonts, same antialiasing). No Storybook or Ladle dependency.

```sh
bun run --cwd packages/kit storybook        # dev server on http://localhost:6006
bun run --cwd packages/kit storybook:build  # static site in packages/kit/build (gitignored)
```

The gallery opens on a Home page with one live example of each component (its `Controls` story with the default args); a card's title opens that component. Stories use the Storybook component-story format: a default export with a `title`, named exports that render the component, and `args` / `argTypes` on each export. Every kit component has a `Controls` story exposing all of its props as controls, and the ones with variant axes also have a matrix story. The `A2UI Surface` stories render the official A2UI contact form, a basic catalog tour a Kit catalog payment request and a dashboard block (bound colours, proportional bars, a bound Chart and an Apply button) through the renderer and log every renderer-to-agent message; its `Controls` story renders any JSON you paste. The `Theme` story drives the `ThemeOption` surface through `derivePalette`.

## Scripts

| Script              | Description                  |
| ------------------- | --------------------------- |
| `bun run typecheck` | Type-check without emitting. |
| `bun run test`      | Unit, snapshot and A2UI conformance tests (`test/**/*.spec.ts`). |
| `bun run storybook` | Gallery dev server with a story per component. |
| `bun run storybook:build` | Static gallery build into `build/`, including `a2ui/v1_0/catalog.json`. |

Form controls default to `CONTROL_RADIUS_DEFAULT` (8px) and draw no focus ring (`outlineWidth: 0` with `outlineStyle: 'solid'` so the browser's own ring stays off on web). `Modal` renders the Stage look (page background, 1px border, 17px radius, optional title, centered with a 480px max width or a bottom sheet). `DropdownMenu` and `Tooltip` default to the Stage app look and share `OVERLAY_SHADOW` from `overlay.styles.ts`. Cards and images keep `BLOCK_RADIUS_DEFAULT` (12px). Markdown styles come from `markdown.styles.ts` (`@stage-labs/kit/markdown-styles`).

Linting is centralised at the repo root (`bun run lint`). The package is published to npm by `publish-kit.yml` (`bun pm pack`, then `npm publish` under the `beta` tag, through npm trusted publishing with provenance; `latest` is then moved to the same version). Version `0.1.0-beta.11` moved the component API to A2UI names and removed the ChatKit-only components (`Box`, `Col`, `Caption`, `Markdown`, `Input`, `Textarea`, `Checkbox`, `Switch`, `RadioGroup`, `Select`, `DatePicker`, `Label`, `Form`, `Spacer`, `Table`, `Transition`, `AvatarStack`, `AvatarView`, `FlatList`, `Scroll`, `VideoPlayer`, the public `Dialog`) in favour of their A2UI equivalents, and replaced the ChatKit `Frame` renderer with the A2UI renderer.

## Changelog

### 0.1.0-beta.25

- No code changes: from this release on, the publish workflow also points `latest` at each release, so a plain install gets the newest version.

### 0.1.0-beta.24

- No code changes: the first release published through npm trusted publishing, with a provenance attestation.

### 0.1.0-beta.23

- `DropdownMenuSeparator` keeps the menu's vertical padding above and below its line (4px, 8px in a sheet), so a separated group has the same space as the top and bottom of the menu.

### 0.1.0-beta.22

- Fix: hover tooltips and the drag preview render in a layer on the document body on web, so later components no longer paint over them.
- Fix: a `Modal` (and an A2UI `DropdownMenu`) trigger no longer turns off pointer events in its content, so tooltips and nested controls inside a trigger work, for example an avatar inside a card that opens a dialog. A kit `Button` inside a trigger opens it, as before.

### 0.1.0-beta.21

- An empty `SortableList` no longer reserves a 40px drop area: a drag near it still targets it (the nearest list across the pointer), and the dimmed preview gives it room while targeted.
- `Card` clips its children to its rounded corners.
- A2UI: `DropdownMenu` in the Kit catalog (a `trigger` child and `items` with `label`, `icon`, `danger` and a standard `action`, evaluated in the menu's scope; `align` start or end), built on the Kit `DropdownMenu`.
- A2UI: `Modal` `open`, a boolean that can be bound: the renderer writes true when the trigger is pressed and false when the dialog closes, so the agent can open or close it with `updateDataModel`. `Modal` takes `onOpen` for that.
- A2UI: on web, `accessibility.label` shows as a hover tooltip on icon-only Buttons, Icon, Image and DropdownMenu, with no new prop.

### 0.1.0-beta.20

- `SortableList` `indicator="preview"`, now the default: the dragged item leaves its place and a dimmed copy takes real space where it will land, in its own list or another. `line` keeps the previous look.
- `SortableList` `placeAt(move)` lets a sorted list show and report where an item really lands, and render-prop lists get the empty-list `placeholder`.
- A pointer outside every list targets the nearest list of the group across it, so a drop below the last item lands at the end.
- A2UI: `List` `indicator` (`preview` or `line`) and `padding`, a `List` without `weight` no longer grows, a Button event inside a `Modal` closes it, `borderless` buttons render as links, and Text `fontFamily: head`.
- A2UI: a single-line `TextField` takes an `action` that runs on Enter, closing an enclosing Modal like a Button event.
- `useModalClose()` in `react-native/modal`: closes the enclosing Modal.

### 0.1.0-beta.19

- `indicator="follow"`, `SortableItem` `listId`, `SortableList` `touchAction`, `useSortableActive()` and the pure `moveAnchor(move)`, so nested and virtualized lists (Stage's chat list) can run on the sortable components.

### 0.1.0-beta.18

- `SortableList` `indicator="shift"`: in-place dragging within one list, where the other items slide to make room.
- `SortableItem` `follows`: items that move with another one, so a section header carries its rows.
- `useSortableTarget(listId)`: the live drop target, for custom feedback.
- Positions and neighbours come from `itemIds`, so sortable lists work inside virtualized lists.
- Fixes: the drop line stays inside its list and the drag preview is fixed to the viewport on web, so neither can make a list or the page scroll during a drag.

### 0.1.0-beta.17

- New: `react-native/sortable` (`SortableScope`, `SortableList`, `SortableItem`, `SortableHandle`) and the pure `sortable` model: drag and drop within and between lists on web and native, with keyboard and screen-reader moves.
- Kit catalog: `List` takes `sortable`, `group`, `listId`, `itemKey`, `move` and `action`, so agents can build reorderable lists and kanban boards from standard A2UI components; the move reaches the agent through a standard event.
- `RenderContext` has `pointer`, `read` and `write` for custom renderers that update the surface data model.

### 0.1.0-beta.16

- Renderer: a `radius` of `100%` (a circle) now applies, as the Kit catalog already allowed; the renderer reads its radius tokens from the same scale as the catalog.
- `AudioPlayer`: the waveform player's time label uses the Kit font instead of a font the kit never loads.
- New: `useKitPaletteFor(dark)` in `react-native/theme-context`, the palette for an explicit scheme (it replaces three private copies in `Menu`, `Modal` and `Tooltip`).
- Internal cleanup with no change to rendering, props or defaults: simpler style cores and components, and `radius.ts` folded into `tokens.ts` (same exports).

### 0.1.0-beta.15

- `QrCode` encodes with `uqr` (ESM only, no dependencies) instead of the CommonJS `qrcode`, so a Vite host that serves the kit sources in dev needs no `optimizeDeps` entry for it. `qrcode` and `@types/qrcode` are no longer dependencies. Codes keep error correction level M and scan the same, but their module pattern can differ from before.

### 0.1.0-beta.14

- Kit catalog: `TextField` takes `pill` (fully rounded), for the compact search look with `hideLabel`.
- `qrcode` is imported as a default import, so Vite dev serves the kit without pre-bundling `qrcode` by hand.

### 0.1.0-beta.13

#### Breaking changes

- `A2uiSurface` no longer renders `Video` and `AudioPlayer` by default: their renderers load `expo-video` and `expo-audio`, which a react-native-web app without the Expo runtime cannot load. Hosts that run Expo pass them: `<A2uiSurface renderers={MEDIA_RENDERERS} />` from `@stage-labs/kit/react-native/a2ui-media`. Without them those components render nothing.

#### Fixes

- A plain Vite + react-native-web app that renders `A2uiSurface` builds and runs.
- `@types/qrcode` is a dependency, so apps that typecheck the kit sources get the `qrcode` types.
- `a2ui/*` and the style cores it uses import no React, React Native or Expo module, types included, so a server can import `createA2uiClient` or `KIT_CATALOG` without React Native's global types. A lint rule keeps it so.

#### New

- `TextField` `hideLabel`: keeps the compact field; the label is read by screen readers only.
- `Card` `surface` (`surface` is the page background), like `Row` and `Column`.
- `Title` `maxLines`.
- `Chart` `series` can be bound as a whole, and each series' `dataKey`, `label`, `color` and `stack` take bindings.
- A `Row`, `Column` or `List` whose list template has no items renders nothing, so it takes no gap in its parent.
- A `Row` or `Column` with a percentage `width` shrinks to fit, so percentage parts plus a `gap` share the space left after the gaps.

### 0.1.0-beta.12

- Kit catalog: every Kit style prop (colours, sizes, variants, flags, widths) takes a data binding or a function call besides its literal value.
- Kit catalog: `Row` and `Column` take `width`, `height`, `minWidth`, `minHeight`, `maxWidth`, `maxHeight` (pixels or a percentage), `aspectRatio`, per-side `padding` (`top`, `right`, `bottom`, `left`, `x`, `y`) and `border` (a width or `{ size, color, style }`); `Card` takes `background`.
- Kit catalog: `Chart` with the ChatKit Chart props, its `data` usually bound to the data model (500 rows and 12 series at most).
- Renderer: bound colours must be Kit tokens or hex, sizes pixels or percentages; other values are dropped.

### 0.1.0-beta.11

#### Breaking changes

- Components take A2UI v1.0 names and props: `Row`, `Column` (was `Box`/`Col`), `List` (was `Scroll`), `TextField` (was `Input`/`Textarea`, `variant` is now `shortText | longText | number | obscured` and the surface style is `appearance`), `CheckBox` with `displayStyle="switch"` (was `Checkbox`/`Switch`), `Video` (was `VideoPlayer`, `src` is `url`, `poster` is `posterUrl`), `Image` `url`/`description` (was `src`/`alt`, `fit` defaults to `fill`), `Text` `text`/`fontWeight` (was `value`/`weight`) and `variant="caption"` (was `Caption`), `Tabs` `tabs`/`selectedIndex`/`onChange(index)`.
- `weight` is the A2UI flex grow on every component; font weight is `fontWeight` (Text, Badge). `justify` uses `spaceBetween | spaceAround | spaceEvenly`.
- `Button` `variant` defaults to A2UI's `default` (secondary solid); `primary` and `borderless` are the other hints, and `solid | soft | outline | ghost` still pick a fill with `color`.
- Removed `Frame`, `parseFrame` and the ChatKit widget JSON, `Caption`, `Markdown` (use `Text markdown`), `Label`, `Form`, `Spacer`, `Table`, `Transition`, `RadioGroup` and `Select` (use `ChoicePicker`), `DatePicker` (use `DateTimeInput`), `AvatarStack`, `AvatarView`, `FlatList`, `BrandIcon` (use `Icon`) and the `dialog` export (use `Modal`).

#### New

- The A2UI v1.0 core (`@stage-labs/kit/a2ui/*`), the React Native renderer (`A2uiSurface`, `useA2uiClient`) and the Stage Kit catalog with the `openSurface` and `closeSurface` screen functions.
- `CheckBox`, `ChoicePicker`, `Slider`, `DateTimeInput` (1 minute steps), `Video` with `background`, `aspectRatio`, `fit` and `onVideoSize`, `Modal` `trigger`/`defaultOpen`, the A2UI icon names on `Icon`, and `checks` on Button and the inputs.

### 0.1.0-beta.10

- Release the current main source, including the Input and Textarea typography change excluded from beta.9. Both controls now match the same `Text` size: `xs` 16px, `sm` 17px, `md` 18px, `lg` 19px and `xl` 20px. Their height and padding settings, variants and explicit style overrides are unchanged.
- Keep beta.9's strict TypeScript 5.9 `Title` fix. All 62 package exports and the dependency requirements are unchanged.

### 0.1.0-beta.9

- `Title` sets its default font size and family only when there is no hero, fixing TS2783 for strict TypeScript 5.9 consumers. All rendered styles are unchanged.
- This maintenance release uses the beta.8 source baseline; later Input and Textarea typography changes on main are not included.

### 0.1.0-beta.8

- Chart mixed `auto` domains expand both ends to the nice ticks, equal numeric bounds expand against the data, and ticks retain their precision in narrow ranges around large values.

### 0.1.0-beta.7

- `Chart` and Frame Chart nodes support the official ChatKit `yAxis.domain` tuple with `showYAxis: true`, including data-based line ranges, numeric bounds and `auto`. Existing zero-based chart defaults are unchanged.

### 0.1.0-beta.6

- `Frame` refuses `Image` `src` and Markdown link URLs with a double quote, a backslash, angle brackets or a user name before the host (`https://stage.box@evil.example`). A double quote in an image `src` could add extra background images on web. The check now runs in linear time on long dotted hosts. Plain `https` URLs, ports, paths with parentheses or `@`, and a trailing dot still pass.

### 0.1.0-beta.5

- `Badge` text follows its `size`: `md` is 15px and `lg` is 16px (both were 13px). `3xs`, `2xs` and `sm`, the default, stay 13px. Frame badges sized `md` or `lg` grow the same way. `textSize` still replaces it.
- `Badge` `children` can be a function. It gets the badge's text props (`weight`, `color` and a `style` with the font size), so composed content such as a label with an icon uses the badge's text size.
- Breaking for code that reads the style core: `resolveBadgeStyle` returns `fontSize` in pixels instead of `fontToken`, and `BadgeFontToken` is removed.
- Stage label chips take their text size from `Badge`: the sidebar filters are `md` (15px, was 14px) and the other label chips `lg` (16px, as before).

### 0.1.0-beta.4

- New `Chart` component, `@stage-labs/kit/react-native/chart`, with the props and defaults of OpenAI ChatKit's `Chart` widget: bar, line and area series, stacks, d3 curves, legend, tooltip on hover or tap, optional y axis and ChatKit's chart colours. It is drawn with `react-native-svg`, so there is no new dependency. The layout core is `@stage-labs/kit/chart`. See Chart above.
- `Frame` draws `Chart` nodes as charts instead of a table of their data, and a `Chart` in a `Row` shrinks like a box.
- Breaking for code that reads parsed frames: a `Chart` node (`FrameNodeOf<'Chart'>`) now has ChatKit's props (`data`, `series`, `xAxis`, `showYAxis`, `showLegend`, `showTooltip`, `barGap`, `barCategoryGap`, the sizes and `aspectRatio`) instead of `{ header, rows }`.

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
- A2UI specification: [a2ui.org](https://a2ui.org/specification/v1.0-a2ui/)
