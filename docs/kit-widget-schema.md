# Kit Widget JSON Schema — Reference

A precise reference for the widget JSON format the Kit renderer emits/consumes, written so we can build a faithful renderer in our own design system.

This document is derived primarily from the canonical Pydantic widget models and their JS type definitions. The Python models serialize to the exact JSON shape the client renders, and each model carries a literal `type` discriminator field that becomes `"type": "..."` in JSON.

> Provenance: the widget JSON format documented here is derived from upstream Python/JS widget SDKs (`widgets.py`, `actions.py`, JS `widgets.d.ts`); this reference tracks that JSON shape so we can render it in our own design system.

> Note: the format is evolving. The upstream Python SDK marks direct construction of named widget classes as deprecated in favor of `.widget` template files (Jinja2), but the **serialized JSON shape is identical** — templates simply produce these same nodes. Build the renderer against the JSON shape below.

---

## 1. Core model

A widget is a tree of **nodes**. Every node is a JSON object with:

- A required `"type"` string discriminator (e.g. `"Card"`, `"Text"`, `"Button"`).
- An optional `"id"` (string) and `"key"` (string). `key` is a React-style reconciliation key used during streaming updates; `id` identifies the node for targeted updates. Both are present on essentially every node.
- Node-specific fields.

Children are expressed **two different ways** depending on the node:

- **`children` array** — most containers (`Box`, `Row`, `Col`, `Card`, `Form`, `ListView`, `ListViewItem`).
- **Single `children` node** — `Transition` takes one child node (not a list).
- **Named slots** — a few container-level nodes use named fields instead of/in addition to `children`: `Card.confirm` / `Card.cancel` (each a `{label, action}` object), `Card.status`, `ListView.status`, `Button.iconStart` / `Button.iconEnd`, `Select.options` / `RadioGroup.options`.
- **Leaf nodes** (`Text`, `Title`, `Caption`, `Badge`, `Markdown`, `Image`, `Icon`, `Divider`, `Spacer`, all inputs) have **no children**; their content is a `value` / `label` / `src` / `name` string field.

### Type categories

| Category | Node `type` values |
| --- | --- |
| Roots | `Card`, `ListView`, `Basic` |
| Layout | `Box`, `Row`, `Col`, `Form`, `Spacer`, `Divider` |
| Text | `Text`, `Title`, `Caption`, `Markdown`, `Label` |
| Visual | `Image`, `Icon`, `Badge` |
| Interactive | `Button`, `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`, `DatePicker` |
| Collection | `ListView`, `ListViewItem` |
| Misc | `Transition`, `Chart` |

> There is **no** `Table` / `TableRow` / `TableCell` node in the current Python SDK, despite some older JS type listings mentioning them. Tables are not part of the current shipped schema — do not rely on them. Use `Chart` for data viz.

---

## 2. Root structure & identification

A rendered widget's top node (`WidgetRoot`) is one of:

- **`Card`** — bounded card container (the most common root). Required `children` array.
- **`ListView`** — vertical list; `children` must be `ListViewItem` nodes.
- **`Basic`** (`BasicRoot`) — a permissive root (`extra="allow"`); `children` may be a single node or a list. Used as a thin wrapper.

**Identify the root by its `type` field.** A renderer should switch on `type` at the top level: `Card` and `ListView` are the two you will see in practice. Everything else (`Box`, `Text`, ...) is a non-root node that appears nested inside a root.

In the widget data model the widget is delivered inside a thread item (a `WidgetItem`) whose `widget` field holds this root node. Streaming updates patch the tree by `id`/`key`.

---

## 3. Shared vocabulary (theming / layout)

These literal enums are reused across many nodes. A renderer should implement them as a shared lookup.

### Sizes
- `TextSize` = `"xs" | "sm" | "md" | "lg" | "xl"`
- `TitleSize` = `"sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl"`
- `CaptionSize` = `"sm" | "md" | "lg"`
- `IconSize` = `"xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl"`
- `ControlSize` (Button/Input/Textarea/Select/DatePicker) = `"3xs" | "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl"`

### Text styling
- `weight` = `"normal" | "medium" | "semibold" | "bold"`
- `textAlign` (`TextAlign`) = `"start" | "center" | "end"`

### Flex alignment
- `align` (`Alignment`) = `"start" | "center" | "end" | "baseline" | "stretch"`
- `justify` (`Justification`) = `"start" | "center" | "end" | "between" | "around" | "evenly" | "stretch"`
- `wrap` = `"nowrap" | "wrap" | "wrap-reverse"`
- `direction` = `"row" | "col"`

### Control variants
- `ControlVariant` (Button/Select/DatePicker) = `"solid" | "soft" | "outline" | "ghost"`
- Input/Textarea `variant` = `"soft" | "outline"`

### Radius
- `RadiusValue` = `"2xs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "full" | "100%" | "none"`

### Color
- `color` / `background` accept either a **string** (a theme token name or CSS color) **or** a `ThemeColor` object: `{ "dark": "<color>", "light": "<color>" }` (both keys required). This is how a node specifies different colors per theme.
- Badge/Button use **constrained color enums** instead (see those nodes).

### Spacing (`padding`, `margin`)
Accept a **number** (uniform), a **string**, or a `Spacing` object with any subset of:
```json
{ "top": 8, "right": 8, "bottom": 8, "left": 8, "x": 8, "y": 8 }
```
(`x` = left+right, `y` = top+bottom; each value is number or string.)

### Borders (`border`)
Accept a **number** (uniform width), a single `Border`, or a `Borders` object keyed by side (`top/right/bottom/left/x/y`).
```jsonc
// Border
{ "size": 1, "color": "#e5e5e5", "style": "solid" }
// style ∈ "solid" | "dashed" | "dotted" | "double" | "groove" | "ridge" | "inset" | "outset"
// Borders
{ "top": 1, "bottom": { "size": 2, "color": "#000" } }
```

### Dimension fields
`width`, `height`, `size`, `minWidth`, `minHeight`, `minSize`, `maxWidth`, `maxHeight`, `maxSize`, `gap`, `flex`, `aspectRatio` — each accepts a number or string (e.g. `200`, `"100%"`, `"auto"`). `size` sets both width and height; `minSize`/`maxSize` similarly.

---

## 4. Node reference

> Convention below: `type` is the discriminator. Every node also allows `id?: string` and `key?: string` (omitted from each list for brevity). Fields marked **required** must be present.

### Roots

#### Card — `"type": "Card"`
Bounded container, optionally a form, with status line and confirm/cancel action footer.
- `children`: array of nodes — **required**
- `asForm`: bool — treat the card as a `<form>` (inputs submit together)
- `background`: string | ThemeColor
- `size`: `"sm" | "md" | "lg" | "full"`
- `padding`: number | string | Spacing
- `status`: `WidgetStatus` (see below) — status line rendered with the card
- `collapsed`: bool
- `confirm`: `CardAction` = `{ "label": string, "action": ActionConfig }` — primary footer button
- `cancel`: `CardAction` — secondary footer button
- `theme`: `"light" | "dark"`

#### ListView — `"type": "ListView"`
- `children`: array of **ListViewItem** — **required**
- `limit`: number | `"auto"` — max items shown (with show-more affordance)
- `status`: `WidgetStatus`
- `theme`: `"light" | "dark"`

#### Basic — `"type": "Basic"`
Permissive root wrapper (allows extra fields).
- `children`: a single node **or** an array of nodes

### Layout

#### Box — `"type": "Box"`
General flex container. Carries the full `BoxBase` field set (shared by Row/Col/Form):
- `children`: array of nodes
- `direction`: `"row" | "col"` (Box only)
- `align`: Alignment · `justify`: Justification · `wrap`: nowrap|wrap|wrap-reverse
- `flex`: number | string · `gap`: number | string
- `width` / `height` / `size` / `min*` / `max*`: number | string
- `padding` / `margin`: number | string | Spacing
- `border`: number | Border | Borders
- `radius`: RadiusValue
- `background`: string | ThemeColor
- `aspectRatio`: number | string

#### Row — `"type": "Row"`
Same as `BoxBase` (horizontal). No `direction` field. `children` array.

#### Col — `"type": "Col"`
Same as `BoxBase` (vertical). No `direction` field. `children` array.

#### Form — `"type": "Form"`
`BoxBase` fields **plus**:
- `onSubmitAction`: `ActionConfig` — fired on submit; payload auto-populated from contained inputs (keyed by each input's `name`)
- `direction`: `"row" | "col"`
- `children`: array of nodes

#### Spacer — `"type": "Spacer"`
- `minSize`: number | string

#### Divider — `"type": "Divider"`
- `color`: string | ThemeColor
- `size`: number | string (thickness)
- `spacing`: number | string (margin around it)
- `flush`: bool (bleed to container edges)

### Text

#### Text — `"type": "Text"`
- `value`: string — **required**
- `streaming`: bool (value is being streamed in)
- `italic`: bool · `lineThrough`: bool
- `color`: string | ThemeColor
- `background`: string | ThemeColor — fills the text run's background (RN `TextStyle.backgroundColor`; Vue CSS `background-color`). Used for the search-match highlight (`#FFF200` yellow) in `highlightText`/channel-row titles, restoring the original highlight exactly.
- `lineHeight`: number (px) — explicit line height (RN `TextStyle.lineHeight`; Vue CSS `line-height`).
- `fontSize`: number (px) — explicit font-size override beyond the `size` token range (e.g. `19` for the `3xl` search-highlight body, which `size` cannot express since `TextSize` caps at `xl`).
- `weight`: normal|medium|semibold|bold
- `size`: TextSize (`xs`..`xl`)
- `textAlign`: start|center|end
- `truncate`: bool · `minLines`: int · `maxLines`: int
- `width`: number | string
- `editable`: `false` **or** `EditableProps` (inline-edit; see EditableProps)

#### Title — `"type": "Title"`
- `value`: string — **required**
- `color`, `weight`, `textAlign`, `truncate`, `maxLines`
- `size`: TitleSize (`sm`..`5xl`)

#### Caption — `"type": "Caption"`
- `value`: string — **required**
- `color`, `weight`, `textAlign`, `truncate`, `maxLines`
- `size`: CaptionSize (`sm | md | lg`)

#### Markdown — `"type": "Markdown"`
- `value`: string (markdown source) — **required**
- `streaming`: bool

#### Label — `"type": "Label"`
A form-field label bound to an input.
- `value`: string — **required**
- `fieldName`: string — **required** (name of the input it labels)
- `size`: TextSize · `weight` · `textAlign` · `color`

### Visual

#### Image — `"type": "Image"`
- `src`: string — **required**
- `alt`: string
- `fit`: `"cover" | "contain" | "fill" | "scale-down" | "none"`
- `position`: `"top left" | "top" | "top right" | "left" | "center" | "right" | "bottom left" | "bottom" | "bottom right"`
- `radius`: RadiusValue
- `frame`: bool (draw a frame/border) · `flush`: bool (bleed to edges)
- `width`/`height`/`size`/`min*`/`max*`: number | string
- `margin`: number | string | Spacing
- `background`: string | ThemeColor · `aspectRatio`: number | string · `flex`: number | string

#### Icon — `"type": "Icon"`
- `name`: `WidgetIcon` (icon-name string) — **required**
- `color`: string | ThemeColor
- `size`: IconSize (`xs`..`3xl`)

> `WidgetIcon`/`IconName` is a large enum of named glyphs defined in the upstream `icons.py` (e.g. `"check"`, `"chevron-right"`, etc.). Map these to our own icon set; fall back gracefully on unknown names.

#### Badge — `"type": "Badge"`
- `label`: string — **required**
- `color`: semantic enum (`"secondary" | "success" | "danger" | "warning" | "info" | "discovery"`) **or** an arbitrary color value (hex/token/`ThemeColor`). A custom color is treated as the badge background with an auto-computed readable foreground (luminance-based), exactly like `Button`.
- `background`: arbitrary color value (hex/token/`ThemeColor`) — sets the badge background explicitly. When `background` is set, `color` (if a non-semantic color value) becomes the **foreground** text color, so background and text can be chosen independently (used by the member Owner/Admin badges).
- `weight`: `FontWeight` — label weight (defaults to `semibold`; member badges use `medium`).
- `variant`: `"solid" | "soft" | "outline"`
- `size`: `"3xs" | "2xs" | "sm" | "md" | "lg"` — `3xs` = 11px label, `2xs` = 12px, `sm`/`md`/`lg` = 13px. Matches the `Text` size tokens.
- `pill`: bool

### Interactive controls

#### Button — `"type": "Button"`
- `label`: string
- `submit`: bool (acts as form submit button)
- `onClickAction`: `ActionConfig`
- `iconStart` / `iconEnd`: `WidgetIcon`
- `style`: `"primary" | "secondary"`
- `iconSize`: `"sm" | "md" | "lg" | "xl" | "2xl"`
- `color`: `"primary" | "secondary" | "info" | "discovery" | "success" | "caution" | "warning" | "danger"` (or an arbitrary color value — see notes)
- `background`: arbitrary color value (hex/token/`ThemeColor`) — custom solid background.
- `pressedBackground`: arbitrary color value — background shown while the button is pressed (RN `pressed`, web `:active`). Lets a `ghost`/`uniform` icon button reproduce a custom pressed-fill (e.g. the member remove control's pink pressed background).
- `foreground`: arbitrary color value — overrides the label/icon color (e.g. a fixed `danger` token for the trash icon).
- `radius`: RadiusValue — overrides the default pill radius (e.g. `"full"` for a round icon button).
- `variant`: ControlVariant (`solid | soft | outline | ghost`)
- `size`: ControlSize (`3xs`..`3xl`)
- `pill`: bool · `uniform`: bool (square/icon button) · `block`: bool (full width) · `disabled`: bool

The **member remove control** (round trash icon, transparent until pressed, pink pressed-fill, 18px danger icon) is expressed as a `Button` with `variant: "ghost"`, `uniform: true`, `radius: "full"`, `iconStart: "trash"`, `foreground` set to the danger token, and `pressedBackground` set to the per-theme pink.

#### Input — `"type": "Input"`
- `name`: string — **required** (payload key on submit)
- `inputType`: `"number" | "email" | "text" | "password" | "tel" | "url"`
- `defaultValue`: string · `placeholder`: string · `pattern`: string · `required`: bool
- `disabled`: bool · `autoFocus`: bool · `autoSelect`: bool · `allowAutofillExtensions`: bool
- `variant`: `"soft" | "outline"`
- `size`: ControlSize
- `gutterSize`: `"2xs" | "xs" | "sm" | "md" | "lg" | "xl"`
- `pill`: bool

#### Textarea — `"type": "Textarea"`
- `name`: string — **required**
- `defaultValue` · `placeholder` · `pattern` · `required` · `disabled` · `autoFocus` · `autoSelect`
- `variant`: `"soft" | "outline"` · `size`: ControlSize · `gutterSize`: `2xs..xl`
- `rows`: int · `autoResize`: bool · `maxRows`: int · `allowAutofillExtensions`: bool

#### Select — `"type": "Select"`
- `name`: string — **required**
- `options`: array of `SelectOption` — **required** — `{ "value": str, "label": str, "disabled"?: bool, "description"?: str }`
- `onChangeAction`: `ActionConfig`
- `placeholder` · `defaultValue`: string
- `variant`: ControlVariant · `size`: ControlSize
- `pill` · `block` · `clearable` · `disabled` · `searchable`: bool

#### Checkbox — `"type": "Checkbox"`
- `name`: string — **required**
- `label`: string
- `defaultChecked`: bool
- `onChangeAction`: `ActionConfig`
- `disabled` · `required`: bool

#### RadioGroup — `"type": "RadioGroup"`
- `name`: string — **required**
- `options`: array of `RadioOption` — `{ "label": str, "value": str, "disabled"?: bool }`
- `ariaLabel`: string
- `onChangeAction`: `ActionConfig`
- `defaultValue`: string
- `direction`: `"row" | "col"`
- `disabled` · `required`: bool

#### DatePicker — `"type": "DatePicker"`
- `name`: string — **required**
- `onChangeAction`: `ActionConfig`
- `placeholder`: string
- `defaultValue` / `min` / `max`: ISO datetime string (serialized from Python `datetime`)
- `variant`: ControlVariant · `size`: ControlSize
- `side`: `"top" | "bottom" | "left" | "right"` (popover position)
- `align`: `"start" | "center" | "end"`
- `pill` · `block` · `clearable` · `disabled`: bool

### Collections

#### ListViewItem — `"type": "ListViewItem"`
A row inside a `ListView`.
- `children`: array of nodes — **required**
- `onClickAction`: `ActionConfig` (makes the whole row clickable)
- `gap`: number | string
- `align`: Alignment
- `padding`: SpacingValue — overrides the default row padding (`16` vertical / `16` horizontal). Accepts a number/string (all sides) or `{ x, y, top, right, bottom, left }`.
- `paddingX` · `paddingY`: number | string — override only the horizontal / vertical padding (applied after `padding`).
- `border`: BorderValue — same shape as `Box.border` (number, `{ size, color, style }`, or per-side `{ top, right, bottom, left, x, y }`). Useful to reserve a transparent border that `pressedBorderColor` colors on press without shifting layout.
- `pressedBackground`: Color — overrides the palette-derived pressed background.
- `pressedBorderColor`: Color — on press, colors the row border instead of filling a background (border-pressed highlight). Takes precedence over `pressedBackground` while pressed.
- `showDivider`: bool — draws a bottom hairline divider (1px, theme border color, inset by 16) inside the row content.

All of the above default to the current behavior, so existing rows are unchanged unless a field is set explicitly.

### Misc

#### Transition — `"type": "Transition"`
Animated wrapper around a **single** child.
- `children`: a single node (NOT an array)

#### Chart — `"type": "Chart"`
- `data`: array of objects `{ [key]: str | int | float }` — **required**
- `series`: array of series — **required** (see below)
- `xAxis`: string **or** `XAxisConfig` = `{ "dataKey": str, "hide"?: bool, "labels"?: { [k]: str } }` — **required**
- `showYAxis` · `showLegend` · `showTooltip`: bool
- `barGap` · `barCategoryGap`: int
- sizing fields: `flex`, `width`, `height`, `size`, `min*`, `max*`, `aspectRatio`

Series objects (discriminated by `type`):
- `{ "type": "bar", "dataKey": str, "label"?: str, "stack"?: str, "color"?: str|ThemeColor }`
- `{ "type": "line", "dataKey": str, "label"?, "color"?, "curveType"?: CurveType }`
- `{ "type": "area", "dataKey": str, "label"?, "stack"?, "color"?, "curveType"?: CurveType }`
- `CurveType` = `"basis" | "basisClosed" | "basisOpen" | "bumpX" | "bumpY" | "bump" | "linear" | "linearClosed" | "natural" | "monotoneX" | "monotoneY" | "monotone" | "step" | "stepBefore" | "stepAfter"`

---

## 4b. Extension nodes (Stage additions)

These node types are **Stage extensions** to the base widget schema — authored as JSON, rendered by `KitRenderer` in BOTH the React Native and Vue renderers. They are not part of the upstream SDK; they cover widgets the base schema cannot express. Like every node they accept `id?`/`key?`.

#### Spinner — `"type": "Spinner"`
Indeterminate activity indicator.
- `size`: `"sm" | "md" | "lg"` **or** a number (px) — default `md` (24px)
- `color`: string | ThemeColor

RN renders an animated `react-native-svg` ring; Vue renders an SVG ring with a CSS `@keyframes` rotation.

#### Switch — `"type": "Switch"`
Controlled on/off toggle (distinct from the form-only `Checkbox`).
- `name`: string — **required** (form payload key)
- `checked`: bool — **required** (controlled)
- `onChangeAction`: `ActionConfig` — dispatched with `{ [name]: boolean }`
- `disabled`: bool · `label`: string

RN renders a `Pressable` track+knob; Vue renders a `role="switch"` button.

#### Tabs — `"type": "Tabs"`
Segmented control / tab switcher.
- `name`: string — **required**
- `value`: string — **required** (selected option value)
- `options`: array of `{ value, label, icon? }` — **required**
- `onChangeAction`: `ActionConfig` — dispatched with `{ [name]: value }`
- `variant`: `"segmented"` (default) | `"underline"`

#### AvatarStack — `"type": "AvatarStack"`
Overlapping avatar cluster with a `+N` overflow chip.
- `items`: array of `{ src?, fallback? }` — **required**
- `size`: number (px, default 32) · `max`: number (default 4) · `overlap`: number (px, default 10)

#### QRCode — `"type": "QRCode"`
QR code rendered as SVG (shared matrix builder, `qrcode` lib, error-correction level M).
- `value`: string — **required**
- `size`: number (px, default 160) · `color`: string | ThemeColor · `background`: string | ThemeColor

#### AudioPlayer — `"type": "AudioPlayer"`
- `src`: string — **required**
- `duration`: number (seconds) · `onPlayAction`: `ActionConfig` (fired on first play)
- `waveform`: bool — switches to the **voice-message** presentation: a circular play/pause button, a tap/click-to-seek amplitude waveform, and a time label, instead of the default chrome. Used by `voiceMessage`.
- `bars`: number[] — per-bar normalized amplitudes (0..1) for the waveform. The container decodes the audio (RN `react-native-audio-api`, Vue `AudioContext`) into `VOICE_BAR_COUNT` (34) buckets and passes them; while decoding it passes a synthetic deterministic fallback (`voiceWaveformBars`). When absent the node renders flat half-height bars.
- `barCount`: number — bar count when `bars` is omitted (default 34).
- `accent`: string | ThemeColor — waveform play-icon color (the bubble accent, e.g. `#0a7cff`).
- `onAccent`: string | ThemeColor — waveform foreground (button fill, bars, label, e.g. `#ffffff`).

Default chrome: RN uses `expo-av` (`Audio.Sound`); Vue uses a native `<audio controls>` element. Waveform mode: RN/Vue both seek by tap/click X-fraction across the bar track. Active (played) bars render at full opacity; remaining bars at `0.45`. Continuous drag-to-scrub is not declarative — tap/click-to-seek is the exact-parity affordance (the original supported tap-to-seek; pointer-drag was not a distinct gesture).

#### VideoPlayer — `"type": "VideoPlayer"`
- `src`: string — **required**
- `poster`: string · `controls`: bool (default true)

RN uses `expo-av` `Video`; Vue uses a native `<video>` element.

#### TextField — `"type": "TextField"`
Controlled live text input — dispatches `onChangeAction` on **every keystroke** (distinct from the form-only `Input`, whose value only reaches the server on form submit).
- `name`: string — **required**
- `value`: string — **required** (controlled)
- `onChangeAction`: `ActionConfig` — **required** — dispatched with `{ [name]: text }`
- `placeholder`: string · `multiline`: bool · `autoFocus`: bool · `autoGrow`: bool · `disabled`: bool
- `onSelectionChangeAction`: `ActionConfig` — dispatched with `{ start, end }` (caret/selection character offsets) on every caret move or selection change. Unblocks @-mention range detection so the composer input can be a `TextField`.
- `selection`: `{ start, end }` — optional controlled caret/selection range.
- `onSubmitAction`: `ActionConfig` — dispatched with `{ [name]: value }` on submit/done (RN `onSubmitEditing`; web Enter on a single-line field).
- `returnKeyType`: `"done" | "go" | "next" | "search" | "send"` — keyboard return key (RN `returnKeyType`; web `enterkeyhint`).
- `maxLength`: number · `maxHeight`: number | string (caps a `multiline` field's height for scroll).
- `autoFocus`: bool (focus on mount) · `focusNonce`: number — declarative imperative-focus: whenever the value **changes**, the input is re-focused. Replaces an imperative focus ref.
- `blurNonce`: number — declarative imperative-blur: whenever the value **changes**, the input is blurred (RN `ref.blur()`; Vue `el.blur()`). Pairs with `focusNonce` so a container can drive focus AND blur purely with incrementing nonces — e.g. the composer's blur-on-background and blur-then-refocus-on-reply, with no input ref.
- `autoGrow` (multiline): the field grows with content up to `maxHeight`. RN reads `onContentSizeChange`; **Vue** measures `scrollHeight` (`height='auto'` then `min(scrollHeight, maxHeight)`) on input, on value change, and on mount — matching the app's JS auto-grow.
- `autoCapitalize`: `"none" | "sentences" | "words" | "characters"` · `autoCorrect`: bool.

Styling (all optional; defaults reproduce the current outline field exactly):
- `variant`: `"outline"` (default — bordered, filled) | `"plain"` (transparent background, no border — for the composer).
- `background` / `borderColor` / `color` / `placeholderColor`: arbitrary color value (hex/token/`ThemeColor`).
- `radius`: RadiusValue · `paddingX` / `paddingY`: number | string (box padding).
- `paddingTop` / `paddingBottom`: number | string — override the top/bottom padding per side (takes precedence over `paddingY`). The composer uses `paddingTop: 4`, `paddingBottom: 8`.
- `lineHeight`: number (px) — explicit line height (RN `TextStyle.lineHeight`; Vue CSS `line-height`). The composer uses `23`.
- `fontSize`: number (px) · `fontWeight`: `FontWeight` (resolves to the Calibre family, like other text nodes).

RN renders a `TextInput` (selection via `onSelectionChange`/`selection` props); Vue renders an `<input>` or `<textarea>` (when `multiline`) reading `selectionStart`/`selectionEnd` on `input`/`select`/`keyup`/`click`.

#### ColorPicker — `"type": "ColorPicker"`
Color picker with two modes.
- `name`: string — **required**
- `value`: string — **required** (current hex)
- `mode`: `"swatches" | "hsv"` — default `"swatches"`. `"swatches"` renders the tap-to-pick swatch grid; `"hsv"` renders the full continuous HSV picker (live-preview chip, draggable Hue/Saturation/Value gradient tracks, and a hex `Input`). RN hosts the gesture tracks via `react-native-gesture-handler` (`Gesture.Pan` + `runOnJS`); Vue hosts them via pointer-capture drag on gradient `div`s.
- `onChangeAction`: `ActionConfig` — dispatched with `{ [name]: hex }`
- `swatches`: array of hex strings (swatches mode only; falls back to a default palette)
- `headColor` · `subColor` · `borderColor` · `rowBg`: `Color` — optional palette overrides for HSV mode (label/value text, secondary text, track/preview border, hex-input background); each falls back to the kit theme palette when unset.

#### Stack — `"type": "Stack"`
Z-axis overlay container: children are painted in document order, so the **last child is on top**. Enables poll % fill-bars behind text, avatar overlap, and badge-on-avatar overlays.
- `children`: array of nodes — **required**
- `width` · `height` · `size` (sets both): `Dimension` (number px or string, e.g. `"100%"`)
- `align`: `"start" | "center" | "end" | "stretch" | "baseline"` · `justify`: `"start" | "center" | "end" | "between" | "around" | "evenly"`

**Overlay positioning** — any child *inside a Stack* may carry the optional position fields (see *Field extensions*). A child with `position: "absolute"` (or any of `top/right/bottom/left/inset/zIndex` set, which implies `absolute`) is taken out of flow and positioned against the Stack box; otherwise it stacks `relative` in normal flow. Example fill-bar: a full-size `Box` with `inset: 0`, then an absolute `Box` with `left: 0, top: 0, bottom: 0, width: "62%"`, then a centered `Box` (`inset: 0`) holding the `Text`.

RN renders a `position:'relative'` `View` wrapping each child in an absolutely/relatively-positioned `View`; Vue renders a `position:relative` flex `div` with each child wrapped in a positioned `div`.

#### ScrollRow — `"type": "ScrollRow"`
Horizontally scrolling container for chip/tab strips.
- `children`: array of nodes — **required**
- `gap`: `Dimension` (space between children) · `padding`: `SpacingValue`

RN renders a horizontal `ScrollView` (`showsHorizontalScrollIndicator={false}`) around a row `Box`; Vue renders an `overflow-x:auto` flex-row `div` using native scroll.

#### Pressable — `"type": "Pressable"`
Generic gesture-aware wrapper around arbitrary children.
- `children`: array of nodes — **required**
- `onClickAction`: `ActionConfig` (tap)
- `onLongPressAction`: `ActionConfig` (long-press)
- `onSwipeAction`: `ActionConfig` — dispatched with `{ direction: "left" | "right" | "up" | "down" }`
- `hitSlop`: number (px) — expands the tap target symmetrically without affecting layout. RN sets the gesture-handler `Tap.hitSlop` and the wrapper `View.hitSlop`; Vue adds `padding: Npx; margin: -Npx` to the pointer element. Used by the profile short-address copy-row (`hitSlop: 8`).

RN wires gestures via `react-native-gesture-handler` (`Tap`/`LongPress`/`Pan`); Vue uses pointer events.

#### Popover — `"type": "Popover"`
Tap-to-open menu: a trigger child plus a positioned panel of item rows. Opens on trigger press, dismisses on outside-click (and after an item runs). Replaces the bespoke `OverflowMenu` popover at identical position/overlay/styling.
- `trigger`: a single node — **required** (the button/icon that opens the menu).
- `items`: array — **required**. Each item: `id` (string, **required**), `label` (string, **required**), `icon?` (HeroIcon name), `danger?` (bool — red label/icon), `disabled?` (bool — dimmed, non-pressable), `pressType?` (string — the `ActionConfig.type` dispatched on press; defaults to `"popover.item.press"`), `payload?` (object merged into the dispatched payload).
- `side`: `"bottom"` (default — panel below the trigger) | `"top"` (panel above).
- `align`: `"end"` (default — right-aligned) | `"start"` (left-aligned).

Pressing an item dispatches `{ type: pressType, payload: { ...payload, id } }` through the action registry, then closes the panel. RN renders a `Pressable` trigger + a `Modal` overlay with an absolutely-positioned panel (top/bottom `52`, left/right `8`, `minWidth 200`, rounded surface with border + shadow); Vue renders the trigger + a `fixed inset-0` outside-click catcher + a `fixed` positioned panel (`top-[52px]`/`bottom-[52px]`, `right-2`/`left-2`, `min-w-[200px]`, `rounded-lg shadow-lg`, surface bg + border) — matching the former `OverflowMenu` exactly.

### Field extensions (no new node)

- **`Title.size`** additionally accepts `"6xl"` and `"7xl"` for large hero text (RN/Vue render at 44px / 60px respectively).
- **`Button.color`** additionally accepts an arbitrary color **string** or a `ThemeColor` (`{dark, light}`) on top of the semantic enum (`primary`…`danger`). A **`Button.background`** field is also accepted. When a custom color/background is supplied, the button is rendered solid with that background and an automatically-contrasting foreground.
- **`ListViewItem`** additionally accepts `onLongPressAction` and `onSwipeAction` (same direction payload as `Pressable`).
- **Overlay positioning fields** are accepted on any layout node (`Box`/`Row`/`Col`/`Form`/`Stack`/`ScrollRow`) and take effect when the node is a direct child of a `Stack`: `position` (`"absolute" | "relative"`), `top`/`right`/`bottom`/`left` (`Dimension` — number px, string, or `"%"`), `inset` (shorthand applying to all four sides), and `zIndex` (number). Any of these (other than `position: "relative"`) implies `position: "absolute"`. Outside a `Stack` they are ignored.

---

## 5. Supporting object types

```jsonc
// ThemeColor
{ "dark": "#fff", "light": "#000" }   // both required

// Spacing  (any subset)
{ "top": 8, "right": 8, "bottom": 8, "left": 8, "x": 8, "y": 8 }

// Border / Borders
{ "size": 1, "color": "#e5e5e5", "style": "solid" }
{ "top": 1, "bottom": { "size": 2, "color": "#000" } }

// SelectOption
{ "value": "a", "label": "Option A", "disabled": false, "description": "..." }

// RadioOption
{ "label": "Yes", "value": "yes", "disabled": false }

// CardAction (used by Card.confirm / Card.cancel)
{ "label": "Confirm", "action": { /* ActionConfig */ } }

// WidgetStatus — one of:
{ "text": "Loading", "favicon": "https://...", "frame": true }   // WidgetStatusWithFavicon
{ "text": "Done", "icon": "check" }                               // WidgetStatusWithIcon

// XAxisConfig
{ "dataKey": "month", "hide": false, "labels": { "jan": "January" } }

// EditableProps (Text.editable)
{ "name": "field", "placeholder": "...", "required": true,
  "pattern": "...", "autoFocus": true, "autoSelect": true,
  "autoComplete": "off", "allowAutofillExtensions": false }
```

---

## 6. Actions & interactivity

Actions are how widget interactions reach your server (or are handled client-side). They appear on these fields: `Button.onClickAction`, `Select/Checkbox/RadioGroup/DatePicker.onChangeAction`, `ListViewItem.onClickAction`, `Form.onSubmitAction`, and inside `Card.confirm/cancel`.

### ActionConfig (the JSON embedded in the widget)

```jsonc
{
  "type": "string-identifier",   // REQUIRED — your action name
  "payload": { /* any JSON */ },  // optional, default null
  "handler": "server",            // "server" (default) | "client"
  "loadingBehavior": "auto",      // "auto" (default) | "none" | "self" | "container"
  "streaming": true               // default true — whether the server may stream a response
}
```

- `handler: "server"` → the host POSTs the action to your backend's `action()` method.
- `handler: "client"` → the host app's `onAction` callback handles it in the browser (no round trip).
- `loadingBehavior`: `auto` adapts to context; `self` highlights the triggering control; `container` fades the whole widget; `none` shows no feedback.

> There is **no separate discriminator field** on the action object beyond `type`. The string `type` is the routing key.

### The delivered Action (what the server receives)

When dispatched, the server handler receives an `Action`:
```jsonc
{ "type": "approve", "payload": { "id": 123, "title": "..." } }
```

### Form submission → payload merge

When a `Form` (or `Card` with `asForm: true`) submits, every contained input contributes to the action payload keyed by its `name`. So `Select(name="title")` arrives as `action.payload.title`, `Input(name="email")` as `action.payload.email`, etc. — merged on top of any static `payload` set in the `ActionConfig`.

### Imperative client trigger
The host app can also dispatch actions directly (no widget interaction):
```javascript
await kit.sendAction({ type: "example", payload: { id: 123 } });
```

### Server handler shape (Python, for context)
```python
async def action(self, thread, action: Action[str, Any], sender, context):
    if action.type == "approve":
        await do_thing(action.payload["id"])
        # yield Events to stream UI / widget updates back
```

---

## 7. Complete example widget JSON

### 7.1 A Card with a header, body text, badge, and confirm/cancel footer

```json
{
  "type": "Card",
  "size": "md",
  "padding": 16,
  "status": { "text": "Pending approval", "icon": "clock" },
  "children": [
    {
      "type": "Row",
      "justify": "between",
      "align": "center",
      "children": [
        { "type": "Title", "value": "Expense report", "size": "lg", "weight": "semibold" },
        { "type": "Badge", "label": "Needs review", "color": "warning", "variant": "soft", "pill": true }
      ]
    },
    { "type": "Caption", "value": "Submitted 2 hours ago", "color": "secondary", "size": "sm" },
    { "type": "Divider", "spacing": 12 },
    { "type": "Text", "value": "Total amount: $482.10 across 6 receipts.", "size": "md" }
  ],
  "confirm": {
    "label": "Approve",
    "action": { "type": "approve_expense", "payload": { "report_id": "rep_123" }, "handler": "server" }
  },
  "cancel": {
    "label": "Reject",
    "action": { "type": "reject_expense", "payload": { "report_id": "rep_123" } }
  }
}
```

### 7.2 A ListView of clickable items

```json
{
  "type": "ListView",
  "limit": "auto",
  "children": [
    {
      "type": "ListViewItem",
      "align": "center",
      "gap": 12,
      "onClickAction": { "type": "open_order", "payload": { "order_id": "ord_1" } },
      "children": [
        { "type": "Image", "src": "https://example.com/p1.jpg", "size": 48, "radius": "md", "fit": "cover" },
        {
          "type": "Col",
          "flex": 1,
          "children": [
            { "type": "Text", "value": "Order #1024", "weight": "medium" },
            { "type": "Caption", "value": "Delivered Jun 12", "color": "secondary" }
          ]
        },
        { "type": "Badge", "label": "Delivered", "color": "success", "variant": "soft" },
        { "type": "Icon", "name": "chevron-right", "color": "secondary", "size": "sm" }
      ]
    }
  ]
}
```

### 7.3 A Form card with inputs and a submit action

```json
{
  "type": "Card",
  "asForm": true,
  "padding": 20,
  "children": [
    { "type": "Title", "value": "Book a meeting", "size": "lg" },
    { "type": "Label", "value": "Your name", "fieldName": "name" },
    { "type": "Input", "name": "name", "inputType": "text", "placeholder": "Jane Doe", "required": true },
    { "type": "Label", "value": "Topic", "fieldName": "topic" },
    {
      "type": "Select",
      "name": "topic",
      "placeholder": "Choose a topic",
      "options": [
        { "value": "sales", "label": "Sales" },
        { "value": "support", "label": "Support", "description": "Existing customers" }
      ]
    },
    { "type": "DatePicker", "name": "date", "placeholder": "Pick a date" },
    { "type": "Checkbox", "name": "reminder", "label": "Email me a reminder", "defaultChecked": true },
    {
      "type": "Row",
      "justify": "end",
      "gap": 8,
      "children": [
        {
          "type": "Button",
          "label": "Submit",
          "submit": true,
          "color": "primary",
          "variant": "solid",
          "onClickAction": { "type": "book_meeting", "loadingBehavior": "container" }
        }
      ]
    }
  ]
}
```
On submit, the server receives `action.type == "book_meeting"` with
`payload = { "name": "...", "topic": "sales", "date": "2026-07-01", "reminder": true }`.

### 7.4 A Chart card

```json
{
  "type": "Card",
  "children": [
    { "type": "Title", "value": "Weekly signups", "size": "md" },
    {
      "type": "Chart",
      "height": 220,
      "showLegend": true,
      "showTooltip": true,
      "xAxis": { "dataKey": "day" },
      "data": [
        { "day": "Mon", "free": 12, "paid": 3 },
        { "day": "Tue", "free": 18, "paid": 5 }
      ],
      "series": [
        { "type": "bar", "dataKey": "free", "label": "Free", "stack": "a" },
        { "type": "bar", "dataKey": "paid", "label": "Paid", "stack": "a", "color": "success" }
      ]
    }
  ]
}
```

---

## 8. Renderer implementation notes

- **Dispatch on `type`** at every node. Treat unknown `type` values defensively (render nothing or a placeholder) so forward-compatible schema additions don't crash.
- **`key`/`id`** are reconciliation/update handles. For a static renderer you can ignore them; for live-updating widgets, key your DOM/component tree by them.
- **`children` is mostly an array** but `Transition` is a single node — handle both.
- **Named slots** (`confirm`, `cancel`, `status`, `iconStart`, `iconEnd`, `options`) are NOT in `children`; render them in their designated regions.
- **Color/background** can be a string OR a `{dark, light}` object — resolve against the active theme.
- **Spacing/border** can be a scalar OR a per-side object.
- **Constrained color enums** differ: `Badge.color` and `Button.color` are fixed semantic enums, while generic `color`/`background` fields are free strings or ThemeColor. Map the semantic enums to your design tokens.
- **Inputs only meaningfully submit inside a `Form` or `asForm` Card.** A bare input outside a form has no submission path; its value reaches the server only when an enclosing form/card submits, keyed by `name`.
- **Actions**: respect `handler` (`server` vs `client`) and `loadingBehavior`. For our renderer, `onClickAction`/`onChangeAction`/`onSubmitAction` should be surfaced to our action-dispatch layer carrying `{type, payload}` (plus merged form values for submits).
