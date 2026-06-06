# Kit components proposal: mirror OpenAI ChatKit's real widget primitives

Issue: https://github.com/bonustrack/metro/issues/280

Status: PROPOSAL ONLY. Nothing here is implemented. Sign-off required before any
implementation.

No em-dashes anywhere in this doc (hyphens only), per Less's preference.

## 0. Constraint and the honest premise

Less's constraint: only propose Kit components that ACTUALLY EXIST in OpenAI
ChatKit, and follow ChatKit's same prop API. Drop anything that is not a real
ChatKit component.

This forced a re-read of what ChatKit is. ChatKit is NOT a general-purpose
mobile component library. It is two things:

1. An embeddable chat widget (`<openai-chatkit>` web component / `ChatKit` +
   `useChatKit` React bindings) configured by an OPTIONS object (theme,
   composer, startScreen, threads, header, entities, history, locale). These are
   configuration keys, not reusable components.
2. A server-driven WIDGET system: the assistant streams a tree of widget nodes
   that ChatKit renders inside assistant messages. THIS is where ChatKit's
   granular, prop-bearing components live (Card, ListView, Box, Text, Button,
   Badge, etc).

So the only place ChatKit exposes a "kit of components with props" is its widget
node set. That set is the accurate source of truth for this proposal. Everything
we mirror below is a real ChatKit widget node or container, copied with its
documented prop names. Anything not in that set has been dropped or demoted to
an honest note (Section 4).

Because ChatKit's widget set is chat-message-rendering oriented, only a SUBSET
generalizes to a generic mobile app. We do not pad the list. The realistic
scope is small: roughly 6 components that both exist in ChatKit AND map to real
repetition in apps/app, plus 3 we already have.

Sources (all fetched from official OpenAI docs):
- Widget components + props: https://developers.openai.com/api/docs/guides/chatkit-widgets
- Theme / options config: https://developers.openai.com/api/docs/guides/chatkit-themes
- Web component / React options interface: https://openai.github.io/chatkit-js/api/openai/chatkit/interfaces/openaichatkit/
- ChatKit.js docs root: https://openai.github.io/chatkit-js/

## 1. Accurate ChatKit inventory (with props, cited)

Source for this whole section:
https://developers.openai.com/api/docs/guides/chatkit-widgets

### 1a. Containers (WidgetRoot)

- `Card` - props: `children`, `size`, `padding`, `background`, `status`,
  `collapsed`, `asForm`, `confirm`, `cancel`, `theme`, `key`.
- `ListView` - props: `children`, `limit`, `status`, `theme`, `key`.

### 1b. Components (WidgetNode)

- `Box` - `children`, `direction`, `align`, `justify`, `wrap`, `flex`,
  `height`, `width`, `minHeight`, `minWidth`, `maxHeight`, `maxWidth`, `size`,
  `minSize`, `maxSize`, `gap`, `padding`, `margin`, `border`, `radius`,
  `background`, `aspectRatio`, `key`.
- `Row` - same layout props as Box (no `direction`; it is the row).
- `Col` - same layout props as Box (no `direction`; it is the column).
- `Button` - `submit`, `style`, `label`, `onClickAction`, `iconStart`,
  `iconEnd`, `color`, `variant`, `size`, `pill`, `block`, `uniform`,
  `iconSize`, `key`.
- `Caption` - `value`, `size`, `weight`, `textAlign`, `color`, `truncate`,
  `maxLines`, `key`.
- `Text` - `value`, `color`, `width`, `size`, `weight`, `textAlign`, `italic`,
  `lineThrough`, `truncate`, `minLines`, `maxLines`, `streaming`, `editable`,
  `key`.
- `Title` - `value`, `size`, `weight`, `textAlign`, `color`, `truncate`,
  `maxLines`, `key`.
- `Badge` - `label`, `color`, `variant`, `pill`, `size`, `key`.
- `Icon` - `name`, `color`, `size`, `key`.
- `Image` - `src`, `alt`, `fit`, `position`, `frame`, `flush`, `size`,
  `height`, `width`, `min/max` size props, `radius`, `background`, `margin`,
  `aspectRatio`, `flex`, `key`.
- `Markdown` - `value`, `streaming`, `key`.
- `Divider` - `spacing`, `color`, `size`, `flush`, `key`.
- `Select` - `options`, `onChangeAction`, `name`, `placeholder`,
  `defaultValue`, `variant`, `size`, `pill`, `block`, `clearable`, `disabled`,
  `key`.
- `DatePicker` - `onChangeAction`, `name`, `min`, `max`, `side`, `align`,
  `placeholder`, `defaultValue`, `variant`, `size`, `pill`, `block`,
  `clearable`, `disabled`, `key`.
- `ListViewItem` - `children`, `onClickAction`, `gap`, `align`, `key`.
- `Form` - `onSubmitAction`, `children`, layout props (`align`, `justify`,
  `flex`, `gap`, sizing, `padding`, `margin`, `border`, `radius`,
  `background`), `key`.
- `Spacer` - `minSize`, `key`.
- `Transition` - `children`, `key`.

Important: there is NO `Input` / text-field widget, NO `Sheet` / modal, NO
`Tabs`, NO `Header`, NO `Screen`, NO `EmptyState`, NO `List.Item` (it is
`ListViewItem`, child of `ListView`), and NO `IdentityRow` in ChatKit. The
composer (text input) is part of the embed OPTIONS, not a widget component.

### 1c. Embed options (config, not components)

Source: https://developers.openai.com/api/docs/guides/chatkit-themes and the
options interface. These are configuration keys, useful as naming references for
our theme, but they are NOT reusable components:

- `theme`: `colorScheme` (`light`/`dark`), `color.accent.primary` + `.level`,
  `radius` (`round`/`pill`/`soft`/`sharp`), `density`
  (`compact`/`normal`/`spacious`), `typography.fontFamily`.
- `composer`: `placeholder`, `attachments` (`uploadStrategy`/`maxSize`/
  `maxCount`/`accept`), `tools` (`id`/`label`/`icon`/`pinned`).
- `startScreen`: `greeting`, `prompts` (`name`/`prompt`/`icon`).
- `header`: `enabled`, `customButtonLeft`/`customButtonRight` (`icon`/`onClick`).
- `threads`, `history.enabled`, `locale`, `entities`
  (`onTagSearch`/`onClick`/`onRequestPreview`).

We already align with `theme` here: kit `tokens.ts` has the color scale,
`radius` tokens, and `fontFamily`; our `dark` boolean maps to `colorScheme`.

## 2. What Kit already mirrors today

Kit already has hook-free RN versions of these ChatKit nodes (caller passes
`dark`):

- `Box`/`Row`/`Col` (via `layout.ts` + the app `Box`) - matches ChatKit
  `Box`/`Row`/`Col` layout props (`direction`, `gap`, `align`, `justify`,
  `flex`, `wrap`, `radius`, `background`).
- `Text` - matches ChatKit `Text` (`value` as children, `color`, `size`,
  `weight`, `textAlign`). Our `mono` variant is an extra; ChatKit has no mono.
- `Title` - matches ChatKit `Title` (`size`/level, `weight`, `color`).
- `Button` - matches ChatKit `Button` (`variant`, `size`, `pill`, icon slots).
  Our names differ slightly (`icon`/`iconRight` vs `iconStart`/`iconEnd`); see
  Section 3 for an alignment note.
- `Icon` - matches ChatKit `Icon` (`name`, `color`, `size`).

So the existing kit is already a faithful partial mirror. The gaps below are
the ChatKit nodes we have NOT yet built that also recur in apps/app.

## 3. Proposed additions (real ChatKit nodes only, ChatKit prop names)

Ranked by impact (repetition in apps/app x how cleanly the ChatKit node maps).
Each entry cites the ChatKit node it mirrors and copies its prop names. Where
RN forces a difference from ChatKit (web), it is called out explicitly.

### #1 - `Card` (ChatKit `Card`)

ChatKit `Card`: `children`, `size`, `padding`, `background`, `status`,
`collapsed`, `asForm`, `confirm`, `cancel`, `theme`.

apps/app hand-rolls bordered rounded surfaces with an optional status line and
confirm/cancel actions in `ChannelCard.tsx`, `MediaCard.tsx`,
`GitHubLinkCard.tsx`, `MessengerBubble.cards.tsx`, grouped settings boxes, and
wallet token cards (part of the 141 inline `borderRadius` uses). ChatKit's
`status` + `confirm` + `cancel` props map directly onto our confirm/cancel
surfaces.

Proposed API (ChatKit prop names kept; `dark` added because kit is hook-free,
`onPress` added because RN has no `onClickAction` dispatcher):

```ts
interface CardProps {
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';           // ChatKit: size
  padding?: number | string;            // ChatKit: padding
  background?: string;                  // ChatKit: background
  status?: { text: string; favicon?: string };  // ChatKit: status
  collapsed?: boolean;                  // ChatKit: collapsed
  asForm?: boolean;                     // ChatKit: asForm
  confirm?: { label: string; onPress(): void };  // ChatKit: confirm
  cancel?: { label: string; onPress(): void };   // ChatKit: cancel
  onPress?: () => void;                 // RN addition (ChatKit uses actions)
  dark: boolean;                        // kit is hook-free
}
function Card(p: CardProps): ReactElement;
```

Estimated reduction: ~200-300 LOC; one home for the bordered-surface +
status + confirm/cancel pattern.

### #2 - `ListView` + `ListViewItem` (ChatKit `ListView` / `ListViewItem`)

ChatKit `ListView`: `children`, `limit`, `status`, `theme`. ChatKit
`ListViewItem`: `children`, `onClickAction`, `gap`, `align`.

This is the biggest repetition win and it maps to a REAL ChatKit container.
Note ChatKit's `ListViewItem` is intentionally minimal: it is just a clickable
row wrapper (`children` + `onClickAction` + `gap` + `align`). It does NOT have
`title`/`subtitle`/`leading`/`trailing` props. So we mirror it faithfully and
let callers compose the row body from `Row`/`Icon`/`Text` (which we already
have), rather than inventing a richer item API that ChatKit does not expose.

apps/app re-implements clickable bordered rows in `settings/SettingsMenu.tsx`,
`settings/DisplaySettings.tsx`, `NotificationsSettings.tsx`,
`MessengerSettings.tsx`, `SecuritySettings.tsx`, `ChannelRow.tsx`,
`SearchScreen.rows.tsx`, `send.recipient.tsx`, `LeftDrawer.parts.tsx`,
`AccountsManager.list.tsx` (the ~45 pressed-row blocks).

Proposed API (ChatKit prop names; `dark` added; `onPress` replaces
`onClickAction`):

```ts
interface ListViewProps {
  children: ReactNode;                  // ListViewItem children
  limit?: number;                       // ChatKit: limit (max rows shown)
  status?: { text: string };            // ChatKit: status
  dark: boolean;
}
function ListView(p: ListViewProps): ReactElement;

interface ListViewItemProps {
  children: ReactNode;                  // caller composes Row/Icon/Text
  onPress?: () => void;                 // RN form of onClickAction
  gap?: number;                         // ChatKit: gap
  align?: 'start' | 'center' | 'end';  // ChatKit: align
  dark: boolean;
}
function ListViewItem(p: ListViewItemProps): ReactElement;
```

This is honest about ChatKit's shape. It saves the wrapper/pressed-bg/border/
divider scaffolding (the bulk of the 45 row blocks), but row CONTENT stays
composed from existing primitives, because ChatKit does the same.

Estimated reduction: ~350-500 LOC (wrapper + dividers + pressed-state, not the
content markup, since ChatKit does not abstract content).

### #3 - `Badge` (ChatKit `Badge`)

ChatKit `Badge`: `label`, `color`, `variant`, `pill`, `size`.

45 `999`-radius pill blocks in apps/app: unread counts (ChannelRow), label
chips (`ChannelRow` LabelChips, group.labels), status pills.

Proposed API (ChatKit prop names verbatim; `dark` added):

```ts
interface BadgeProps {
  label: string | number;              // ChatKit: label
  color?: string;                      // ChatKit: color (token name or hex)
  variant?: 'solid' | 'soft' | 'outline';  // ChatKit: variant
  pill?: boolean;                      // ChatKit: pill
  size?: 'sm' | 'md' | 'lg';           // ChatKit: size
  dark: boolean;
}
function Badge(p: BadgeProps): ReactElement;
```

Estimated reduction: ~120-180 LOC.

### #4 - `Divider` (ChatKit `Divider`)

ChatKit `Divider`: `spacing`, `color`, `size`, `flush`.

The 1px border-token line recurs throughout (absorbed partly by ListView, but
needed standalone outside lists).

```ts
interface DividerProps {
  spacing?: number;     // ChatKit: spacing
  color?: string;       // ChatKit: color
  size?: number;        // ChatKit: size (thickness)
  flush?: boolean;      // ChatKit: flush (ignore container padding)
  dark: boolean;
}
function Divider(p: DividerProps): ReactElement;
```

Estimated reduction: ~40-80 LOC.

### #5 - `Caption` (ChatKit `Caption`)

ChatKit `Caption`: `value`, `size`, `weight`, `textAlign`, `color`, `truncate`,
`maxLines`.

The tiny uppercase section labels and secondary captions (48 occurrences of
fontSize 12/13 Medium labels) are exactly ChatKit's `Caption` role. Today we
fake them with `<Text variant="caption">`; ChatKit treats `Caption` as a real
distinct node, so promoting it matches ChatKit and removes the per-call font
styling.

```ts
interface CaptionProps {
  value: string;                       // ChatKit: value (children allowed too)
  size?: 'sm' | 'md';                  // ChatKit: size
  weight?: 'normal' | 'medium' | 'semibold';  // ChatKit: weight
  textAlign?: 'start' | 'center' | 'end';     // ChatKit: textAlign
  color?: string;                      // ChatKit: color
  truncate?: boolean;                  // ChatKit: truncate
  maxLines?: number;                   // ChatKit: maxLines
  dark: boolean;
}
function Caption(p: CaptionProps): ReactElement;
```

Estimated reduction: ~60-120 LOC (the inline section-label styling).

### #6 - `Select` (ChatKit `Select`)

ChatKit `Select`: `options`, `onChangeAction`, `name`, `placeholder`,
`defaultValue`, `variant`, `size`, `pill`, `block`, `clearable`, `disabled`.

apps/app has a few hand-rolled dropdown/picker rows (display options, network
picker, label picker). Lower count than the above but it is a real ChatKit node
and removes ad-hoc picker styling.

```ts
interface SelectProps {
  options: { value: string; label: string }[];  // ChatKit: options
  value?: string;                       // controlled (ChatKit: defaultValue)
  onChange: (v: string) => void;        // RN form of onChangeAction
  name?: string;                        // ChatKit: name
  placeholder?: string;                 // ChatKit: placeholder
  variant?: 'solid' | 'soft' | 'outline';  // ChatKit: variant
  size?: 'sm' | 'md' | 'lg';            // ChatKit: size
  pill?: boolean;                       // ChatKit: pill
  block?: boolean;                      // ChatKit: block (full width)
  clearable?: boolean;                  // ChatKit: clearable
  disabled?: boolean;                   // ChatKit: disabled
  dark: boolean;
}
function Select(p: SelectProps): ReactElement;
```

Estimated reduction: ~80-140 LOC (only where real pickers exist; do not force
it onto toggle rows).

### Lower priority real nodes (optional, only if a real need shows up)

These ARE real ChatKit nodes but map weakly to current apps/app surfaces, so
they are listed but not recommended for the first pass:

- `Image` (ChatKit) - apps/app already has avatar/media handling; only adopt if
  we want ChatKit's `fit`/`frame`/`aspectRatio` semantics.
- `Markdown` (ChatKit) - relevant only for rendering rich message bodies; we
  already render messages elsewhere.
- `Form` (ChatKit) - a layout+submit wrapper; only useful once we have multiple
  multi-field forms worth standardizing.
- `Spacer`, `Transition`, `DatePicker` - real ChatKit nodes, no clear current
  use in apps/app. Skip until needed.

### Optional alignment: Button icon prop names

Our existing `Button` uses `icon`/`iconRight`; ChatKit uses
`iconStart`/`iconEnd`. To follow ChatKit's prop API exactly we could add
`iconStart`/`iconEnd` as the canonical names (keeping the old ones as
deprecated aliases). Non-breaking, optional.

## 4. Dropped from the previous proposal (NOT real ChatKit components)

The earlier draft invented a mobile component library and labeled it
"ChatKit-flavored". These are removed because ChatKit has no such component:

- `Screen` scaffold - not a ChatKit component. (Screen layout in ChatKit is the
  embed host, configured via options, not a node.) Keep as an app-local helper
  if wanted, but it is not part of a ChatKit mirror.
- `Header` - not a ChatKit component. ChatKit's `header` is an EMBED OPTION
  (`enabled` + `customButtonLeft/Right`), not a reusable RN component. Keep
  `SystemHeader` app-local.
- `Field` / `useField` / text `Input` - ChatKit has NO input/text-field widget.
  Text entry is the COMPOSER, an embed option, not a widget node. Dropped.
- `Sheet` / `useSheet` - not a ChatKit component. Keep `AppModal` app-local.
- `Tabs` / `useTabs` - not a ChatKit component. Keep app-local.
- `EmptyState` - not a ChatKit component. ChatKit's equivalent is the
  `startScreen` embed OPTION (greeting + prompts), not a node. Keep app-local.
- `SectionLabel` - not a distinct ChatKit node; its role is covered by the real
  `Caption` node (see #5). Folded into Caption.
- `List.Item` with `title`/`subtitle`/`leading`/`trailing` - ChatKit's item is
  `ListViewItem` (`children`/`onClickAction`/`gap`/`align`) with no such props.
  Reframed to the real `ListViewItem` shape (see #2).
- `IdentityRow` / `useIdentity` - fully invented; no ChatKit equivalent.
  Dropped. Identity rows stay app-local, composed from `ListViewItem` + `Row` +
  `Icon`/`Avatar` + `Text`.

Also note: the previous draft's claim that kit "already mirrors ChatKit's leaf
nodes" was mostly right for Box/Row/Col/Text/Title/Button/Icon, but it then
listed `Field`, `Sheet`, `Tabs` as ChatKit's "container + compound layer",
which is false. Corrected above.

## 5. Realistic scope assessment

ChatKit is chat-domain-specific. Its only granular, prop-bearing component set
is the widget-node system for rendering assistant-message UI. Of that set, the
nodes that both (a) exist in ChatKit and (b) map to real, measured repetition in
apps/app are: `Card`, `ListView`/`ListViewItem`, `Badge`, `Divider`, `Caption`,
and `Select`. We already have faithful mirrors of `Box`/`Row`/`Col`, `Text`,
`Title`, `Button`, `Icon`.

That is the entire honest list. Six new components, not ten-plus. The previous
total (1,900-2,650 LOC) was inflated by invented components (Field, Sheet,
Tabs, Screen, Header, EmptyState, IdentityRow). The accurate estimate for the
real ChatKit-backed set:

| Component (ChatKit node) | Est. LOC saved | Reuse sites |
| --- | --- | --- |
| #1 Card | 200-300 | ~6 files |
| #2 ListView / ListViewItem | 350-500 | ~10 files |
| #3 Badge | 120-180 | ~8 sites |
| #4 Divider | 40-80 | many |
| #5 Caption | 60-120 | ~48 labels |
| #6 Select | 80-140 | a few pickers |
| TOTAL | ~850-1,320 | |

Recommendation: scope the work to these six. The big remaining repetition in
apps/app (inputs/fields, sheets, tabs, screen scaffolds, empty states) is real
and worth deduping, but it should be tracked as an APP-LOCAL shared-components
effort, NOT framed as a ChatKit mirror, because ChatKit genuinely has no
equivalent. Conflating the two is what produced the inaccurate first draft.

## 6. Suggested implementation order (post sign-off)

1. `Divider` + `Caption` + `Badge` (leaf nodes, zero behavior).
2. `Card` (with `status`/`confirm`/`cancel`).
3. `ListView` + `ListViewItem` (migrate settings screens first).
4. `Select` (only where real pickers exist).
5. Optional: `Button` `iconStart`/`iconEnd` alias for full ChatKit parity.

Each step is its own PR off main, JS-only (no native deps), behavior-identical,
verified against the Kit gallery plus tsc + lint.

## 7. Risks / notes

- Kit stays hook-free re: theme (caller passes `dark` + palette), matching the
  existing Button/Text/Title contract. The only ChatKit-prop deviations are the
  added `dark` and the RN `onPress` in place of ChatKit's `onClickAction`/
  `onChangeAction` action-dispatch model (ChatKit dispatches server actions; RN
  calls a local handler). Both are called out per component.
- No native modules introduced; safe for the served branch + hot-reload.
- Migrations must be behavior-identical and verified per-surface.
- Do NOT bump `packages/metro/package.json`.
