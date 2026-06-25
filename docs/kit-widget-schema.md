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
- `color`: `"secondary" | "success" | "danger" | "warning" | "info" | "discovery"`
- `variant`: `"solid" | "soft" | "outline"`
- `size`: `"sm" | "md" | "lg"`
- `pill`: bool

### Interactive controls

#### Button — `"type": "Button"`
- `label`: string
- `submit`: bool (acts as form submit button)
- `onClickAction`: `ActionConfig`
- `iconStart` / `iconEnd`: `WidgetIcon`
- `style`: `"primary" | "secondary"`
- `iconSize`: `"sm" | "md" | "lg" | "xl" | "2xl"`
- `color`: `"primary" | "secondary" | "info" | "discovery" | "success" | "caution" | "warning" | "danger"`
- `variant`: ControlVariant (`solid | soft | outline | ghost`)
- `size`: ControlSize (`3xs`..`3xl`)
- `pill`: bool · `uniform`: bool (square/icon button) · `block`: bool (full width) · `disabled`: bool

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
