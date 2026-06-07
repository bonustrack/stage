# ChatKit alignment plan: RN port, Kit-only enforcement, token alignment

Planning doc only. No feature code here. Three linked objectives:

1. Exact RN port of OpenAI ChatKit's widget surface into `packages/kit`.
2. ESLint enforcement so `apps/app` uses Kit components, not raw RN primitives.
3. Align Kit design variables (tokens) with ChatKit's theming naming.

Status quo (audited 2026-06-08):
- Kit already mirrors a large slice of ChatKit's **Widgets** namespace, hook-free, with `dark: boolean` and `onPress` substituted for ChatKit's server `onClickAction`.
- The big gap is the **chat-app shell** widgets (composer, message bubble, message list, thread list, attachments, typing indicator, suggested prompts) plus a handful of form/content widgets.
- `apps/app` already restricts raw `View` (migrated to `Box/Row/Col`). The remaining exposure is `Text` and `Pressable` (72 files each).

---

## Background: what ChatKit actually is

ChatKit (`@openai/chatkit` + `@openai/chatkit-react`) is a web component. Two distinct surfaces:

1. **The hosted `<ChatKit>` element** - a full chat UI (composer, thread, message stream, attachments, start screen). Configured via `ChatKitOptions` (api, theme, composer, startScreen, threads, etc.), not via child components. This is the "chat shell" surface.
2. **The `Widgets` namespace** - server-streamed declarative UI nodes rendered inside assistant messages: layout (Box, Row, Col, Spacer, Divider), content (Label, Caption, Title, Text, Icon, Image, Markdown, Table), data (ListView, ListViewItem), feedback (Badge, Button, Card), form controls (Input, Textarea, Checkbox, RadioGroup, Select, DatePicker, Form).

Kit so far has ported from surface (2). Objective 1 also asks for the visible chat surface (1) primitives so the app's chat screens are Kit-composed.

### ChatKit ThemeOption (objective 3 source of truth)

```
ThemeOption = {
  colorScheme?: 'light' | 'dark';
  color?: {
    grayscale?: { hue: 0-360; tint: 0-9; shade: -4..4 };
    accent?: { primary: string; level: 0 | 1 | 2 | 3 };
    surface?: { background: string; foreground: string };
  };
  radius?: 'pill' | 'round' | 'soft' | 'sharp';   // default 'pill'
  density?: 'compact' | 'normal' | 'spacious';     // default 'normal'
  typography?: {
    baseSize?: 14 | 15 | 16 | 17 | 18;
    fontFamily?: string;
    fontFamilyMono?: string;
    fontSources?: FontObject[];
  };
}
```

---

## (a) ChatKit component inventory + Kit gap map

ChatKit widget surface = **28** components across both surfaces. Kit currently ships **13** of them.

### Already in Kit (13) - present, mostly faithful

| ChatKit widget | Kit file | Divergence |
| --- | --- | --- |
| Box | `apps/app/components/layout/Box.tsx` (contract in `kit/src/layout.ts`) | Renderer lives in app, not Kit. Contract is shared. See note below. |
| Row | same (`Box.tsx` re-export) | as above |
| Col | same (`Box.tsx` re-export) | as above |
| Divider | `kit/src/divider.tsx` | faithful (`spacing/color/size/flush`) |
| Caption | `kit/src/caption.tsx` | faithful (`value/size/weight/textAlign/color/truncate/maxLines`) |
| Title | `kit/src/title.tsx` | partial - has `level/size/color`; ChatKit Title is a text node, close enough |
| Text | `kit/src/text.tsx` | diverges - Kit uses `variant`; ChatKit Text node uses `value/size/weight/color/textAlign/italic/truncate`. Reconcile in stage 1. |
| Icon | `kit/src/icon.tsx` | faithful (HeroIcon path data) |
| ListView | `kit/src/list-view.tsx` | faithful (`limit/status`) |
| ListViewItem | `kit/src/list-view.tsx` | faithful (`gap/align`, `onPress` for `onClickAction`) |
| Badge | `kit/src/badge.tsx` | faithful (`label/color/variant/pill/size`) |
| Button | `kit/src/button.tsx` + `button.styles.ts` | diverges - Kit variants `primary/secondary/ghost/danger`; ChatKit `variant/color/size/pill/iconStart/iconEnd`. Reconcile in stage 1. |
| Card | `kit/src/card.tsx` | faithful (`size/padding/background/status/collapsed/asForm/confirm/cancel`) |
| Select | `kit/src/select.tsx` | faithful (`options/name/placeholder/variant/size/pill/block/clearable/disabled`) |

Note on Box/Row/Col: the prop contract + style mapper already live in Kit (`kit/src/layout.ts`, `boxStyleEntries`), but the actual RN renderer is in `apps/app/components/layout/Box.tsx`. To make Kit the single import source we should add a thin RN `kit/src/box.tsx` that wraps `boxStyleEntries` (the app's `Box.tsx` then re-exports from Kit). Counted as "present" but flagged for relocation in stage 1.

### Missing from Kit (15) - to port

Widget-namespace content/form nodes (5):

| ChatKit widget | Target Kit file | Props to mirror | Notes |
| --- | --- | --- | --- |
| Label | `kit/src/label.tsx` | `value/size/weight/color` | tiny; could fold into Text, but ChatKit keeps it distinct (form field labels) |
| Image | `kit/src/image.tsx` | `src/alt/size/radius/fit` | wrap RN `Image`; provides the Kit `Image` escape from objective 2 |
| Markdown | `kit/src/markdown.tsx` | `value` | needs a RN markdown renderer; render to Kit Text/Title/ListView nodes |
| Table | `kit/src/table.tsx` | `columns/rows` | low priority (assistant data tables) |
| Spacer | `kit/src/spacer.tsx` | `size/minSize` | trivial flex spacer |

Form-control nodes (4):

| ChatKit widget | Target Kit file | Props | Notes |
| --- | --- | --- | --- |
| Input | `kit/src/input.tsx` | `value/placeholder/variant/size/pill/block/disabled` | wraps RN `TextInput`; Kit escape for objective 2 (23 TextInput files) |
| Textarea | `kit/src/textarea.tsx` | `value/rows/placeholder/...` | multiline `TextInput` |
| Checkbox | `kit/src/checkbox.tsx` | `checked/onChange/label/disabled` | |
| RadioGroup | `kit/src/radio-group.tsx` | `options/value/onChange` | |

Chat-shell surface nodes (6) - the visible chat UI, the heart of objective 1:

| ChatKit surface piece | Target Kit file | Props to mirror | Notes |
| --- | --- | --- | --- |
| Composer | `kit/src/composer.tsx` | `value/onChange/onSend/placeholder/attachments/disabled/suggestions` | the message input bar; biggest piece |
| MessageBubble | `kit/src/message-bubble.tsx` | `role/children/timestamp/status/avatar` | user vs assistant bubble |
| MessageList | `kit/src/message-list.tsx` | `children/onEndReached/typing` | scrolling stream wrapper (FlatList) |
| ThreadList | `kit/src/thread-list.tsx` | `threads/activeId/onSelect/onNew` | conversation list (maps to current channel list) |
| TypingIndicator | `kit/src/typing-indicator.tsx` | `label?` | animated dots |
| SuggestedPrompts | `kit/src/suggested-prompts.tsx` | `prompts/onSelect` | quick-action chips above composer |
| Attachment / AttachmentList | `kit/src/attachment.tsx` | `file/onRemove/preview` | composer + message attachments |

(Avatar already exists as data helpers in `kit/src/avatar.ts`; the RN renderer is in `apps/app`. Treat like Box: relocate a thin `kit/src/avatar.tsx` renderer in stage 2.)

Gap headline: **15 widgets missing** (5 content/form, 4 form-control, ~6-7 chat-shell), plus 2 (Box/Row/Col, Avatar) whose renderer should move into Kit.

---

## (b) Kit-only enforcement lint plan + migration size

Current state (`apps/app/eslint.config.mjs`): `no-restricted-imports` already bans `View` from `react-native` (steer to Box/Row/Col), with `components/layout/**` exempt. All `View` holdouts already migrated.

Remaining raw-primitive exposure in `apps/app` (`*.tsx`):

| Primitive | Files | Kit replacement | Has Kit equivalent today? |
| --- | --- | --- | --- |
| View | 12 | Box/Row/Col | yes (already restricted; 12 are layout-exempt or eslint-disabled call sites) |
| Text | 72 | `@metro-labs/kit/text` Text | yes |
| Pressable | 72 | Kit Button (`ghost` variant) or a new Kit `Pressable` | partial - Button covers most; bare Pressable needs a Kit `Pressable` wrapper |
| ScrollView | 24 | new Kit `Scroll` (thin wrapper) | no - add |
| Image | 13 | new Kit `Image` | no - add (stage 1 above) |
| TextInput | 23 | Kit `Input`/`Textarea` | no - add (stage 1 above) |
| FlatList | 12 | Kit `MessageList` / a generic Kit `List` | partial |

Distinct files importing any RN primitive: **90 of 291** tsx/ts files.

Rough migration size to reach Kit-only:
- Text: ~72 files (mechanical: swap import + map `<Text>` to Kit `<Text dark={...}>`). Largest bucket.
- Pressable: ~72 files, overlaps heavily with Text (most rows use both). Net distinct touch ~90 files.
- TextInput (23), ScrollView (24), Image (13), FlatList (12): need the Kit wrappers to exist first.

Net: **~90 files** to migrate, but heavily front-loaded by adding ~5 missing Kit wrappers (Image, Input, Textarea, Scroll, Pressable) so the swaps become mechanical.

### Allowed escape hatches

- `components/layout/**` and any new `kit/src/*` renderers (they must import RN primitives).
- Targeted `// eslint-disable-next-line no-restricted-imports` at call sites that genuinely need a raw primitive (ref measurement / `onLayout`, MaskedView children, gesture-handler internals, Animated.View, overlays). Same convention already in use for View.
- `ScrollView`/`Pressable` from `react-native-gesture-handler` (different module, not restricted) where gesture behavior is required.

### Staged rollout (warn -> error, per primitive)

The rule is `error` today for View. Extend incrementally so the tree stays green:
1. Add new restricted names as `warn` first (Text, Pressable, Image, ScrollView, TextInput, FlatList) once the Kit wrappers exist.
2. Migrate per primitive, flip that name to `error` when its file count hits 0.
3. Order: Image -> Input/Textarea -> Scroll -> Pressable -> Text -> FlatList (cheapest-first, leave the 72-file Text bucket for a dedicated PR).

Optionally scope by directory (`app/(tabs)/**` first) if a single PR per primitive is too large.

---

## (c) Token alignment mapping table (objective 3)

Our system today:
- Kit `kit/src/tokens.ts`: `semanticColors` (7 keys: `bgColor/borderColor/textColor/linkColor/primaryColor/dangerColor/successColor`), `colors` scale, radius defaults (`BUTTON_RADIUS_DEFAULT=999`, `BLOCK_RADIUS_DEFAULT=12`), `fontFamily`.
- App `apps/app/lib/theme.ts` `usePalette()` -> `Palette { bg, border, text, link, primary, danger, success }` (7 keys, override-layered, scheme-aware). `TokenKey` in `colorOverrides.ts` = `bg|border|text|link|primary|danger|success`.

ChatKit token -> our token:

| ChatKit token | Our token (today) | Action |
| --- | --- | --- |
| `colorScheme` ('light'/'dark') | `ThemePreference` + `useEffectiveColorScheme` | keep; already aligned (we add 'system') |
| `color.surface.background` | `bgColor` / `Palette.bg` | RENAME concept -> add `surface.background` alias; keep `bg` |
| `color.surface.foreground` | `textColor` / `Palette.text` | map `text` -> `surface.foreground` |
| `color.accent.primary` | `linkColor` / `Palette.link` (brand teal) | map `link` -> `accent`. NOTE: our `primary` is the button-fill (white/black), NOT ChatKit's accent. ChatKit `accent` == our `link`. Document this clearly to avoid the mix-up. |
| `color.accent.level` (0-3) | none | ADD optional `accentLevel` (drives hover/pressed intensity) |
| `color.grayscale.{hue,tint,shade}` | `border` + the gray scale in `colors` | ADD a grayscale derivation, or keep our fixed `border`/sub grays and skip |
| `radius` ('pill'/'round'/'soft'/'sharp') | `BUTTON_RADIUS_DEFAULT` + `BLOCK_RADIUS_DEFAULT` (px) | ADD a named-radius mapping: pill=999, round=16, soft=12, sharp=0; keep px overrides as the fine-grained layer |
| `density` ('compact'/'normal'/'spacious') | none | ADD `density` token driving Button/Card/ListView padding |
| `typography.baseSize` (14-18) | Text default 15 | ADD `baseSize` token; Text/Title sizes derive from it |
| `typography.fontFamily` | `fontFamily.sans` (Calibre-Medium) | keep; expose as `typography.fontFamily` |
| `typography.fontFamilyMono` | `fontFamily.mono` (Menlo) | keep; rename export to match |
| (no ChatKit equivalent) | `dangerColor`/`successColor` | keep as Metro extensions (status colors) |

Naming decision: keep our short keys (`bg/text/link/...`) as the app-facing palette (60+ consumers), and add a ChatKit-shaped **theme object** in Kit (`kitTheme(scheme)` returning `{ colorScheme, color: { surface, accent }, radius, density, typography }`) that derives from the same `semanticColors`. Source of truth stays `kit/src/tokens.ts`; app re-exports via `lib/theme.ts`. This aligns naming without a risky 60-file rename of `usePalette`.

Add `density` + `baseSize` + named-`radius` as new tokens in `tokens.ts` with px-derivation tables.

---

## (d) Proposed PR sequence (small, reviewable, off `main`)

Each PR branches from `main` (not served-main), squash-merged by Less. Built against the served branch for hot-reload during dev.

1. **PR1 - tokens: ChatKit-shaped theme object.** Add `density`, `baseSize`, named-`radius` map, and a `kitTheme(scheme)` deriver to `kit/src/tokens.ts`. App `lib/theme.ts` re-exports. No visual change (defaults reproduce today's values). (objective 3)
2. **PR2 - Kit primitive wrappers.** Add `kit/src/image.tsx`, `input.tsx`, `textarea.tsx`, `scroll.tsx`, `pressable.tsx`, `spacer.tsx`, `label.tsx`; relocate Box/Row/Col + Avatar renderers into Kit (app re-exports). Pure additions. (objectives 1 + 2 foundation)
3. **PR3 - lint warn pass.** Extend `no-restricted-imports` to `warn` for Text/Pressable/Image/ScrollView/TextInput/FlatList; add `kit/src/**` to the exempt globs. No migration yet - just surfaces the count. (objective 2)
4. **PR4 - migrate cheap primitives -> error.** Image, Input/Textarea, Scroll. Flip each to `error` as its count hits 0. (objective 2)
5. **PR5 - migrate Pressable.** Swap to Kit Button (ghost) / Kit Pressable; flip to `error`. (objective 2)
6. **PR6 - migrate Text (dedicated, large).** ~72 files; mechanical import swap + `dark` prop. Flip to `error`. (objective 2)
7. **PR7 - chat-shell widgets part 1.** `message-bubble.tsx`, `message-list.tsx`, `typing-indicator.tsx`. Wire into the existing chat screen behind the same visuals. (objective 1)
8. **PR8 - chat-shell widgets part 2.** `composer.tsx`, `suggested-prompts.tsx`, `attachment.tsx`. (objective 1)
9. **PR9 - thread-list + remaining widget nodes.** `thread-list.tsx` (maps to channel list), `markdown.tsx`, `table.tsx`, `checkbox.tsx`, `radio-group.tsx`. (objective 1)
10. **PR10 - reconcile divergent props.** Align Text and Button prop names to ChatKit (`value/size/weight/textAlign` on Text; `iconStart/iconEnd/color` on Button) with back-compat aliases; then deprecate the old props. (objective 1)

PR1-PR3 are non-breaking and can land first/fast. PR6 (Text) and PR7-PR9 (chat shell) are the heavy ones. Respect the 200-line-per-file cap (split composer/message-list internals like Button already splits styles).

Constraints honored: no native deps added (all RN-built-in primitives + existing `react-native-svg`); a markdown renderer (PR9) is the only candidate new JS dep - flag for approval before adding. Never bump `packages/metro/package.json`.
