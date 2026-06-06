# Kit components proposal: reduce app complexity via reusable primitives

Issue: https://github.com/bonustrack/metro/issues/280

Status: PROPOSAL ONLY. Nothing here is implemented. This doc ranks the
highest-leverage components to add to `@metro-labs/kit` so apps/app stops
re-implementing the same row/card/sheet/field/header scaffolds inline. Sign-off
required before any implementation.

No em-dashes anywhere in this doc (hyphens only), per Less's preference.

---

## 1. What Kit provides today

Pure-data + a small set of real RN components, all hook-free (caller passes
`dark`), all ChatKit-flavored:

- `tokens.ts` - color scale, 7 semantic tokens + `semanticPalette(scheme)`,
  radius tokens (`BUTTON_RADIUS_DEFAULT`, `BLOCK_RADIUS_DEFAULT`), `fontFamily`.
- `layout.ts` + `apps/app/components/layout/Box.tsx` - the shared `Box`/`Row`/`Col`
  prop contract (`direction`, `gap`, padding/margin shorthands, `align`,
  `justify`, `flex`, `wrap`, `bg`, `radius`) mapped by `boxStyleEntries`.
- `button.tsx` - `Button` (variants primary/secondary/ghost/danger, sizes,
  `pill`, `icon`/`iconRight`, `loading`, `tintBg`/`tintFg`, radius token).
- `text.tsx` - `Text` (variants body/secondary/caption/mono, size tokens, weight).
- `title.tsx` - `Title` (levels 1-3).
- `icon.tsx` - `Icon` (HeroIcon path data, named).

The kit already mirrors ChatKit's leaf nodes (Box/Row/Col, Text, Title, Button,
Icon). What is MISSING is ChatKit's container + compound layer: `Card`
(bounded container with status/confirm/cancel slots), `ListView` + `Row`
(compound list), `Badge`, `Field`/`Form`, `Select`, `Divider`, plus a screen
scaffold. apps/app re-implements all of these inline, dozens of times.

## 2. ChatKit patterns we are adopting

Distilled from OpenAI ChatKit docs (chatkit-widgets, chatkit-themes):

- **Container + node hierarchy.** A `WidgetRoot` (Card or ListView) wraps many
  `WidgetNode` children. We mirror this with compound components:
  `<List>...<List.Item/>...</List>`, `<Card><Card.Status/><Card.Actions/></Card>`.
- **Slots.** ChatKit's Card exposes `status`, `confirm`, `cancel` slots below the
  body. We expose named slot sub-components / render-prop slots rather than a
  pile of optional props.
- **Theme tokens, not literals.** ChatKit drives everything from
  `colorScheme` + `radius` (pill/round/soft/sharp) + `density`
  (compact/normal/spacious) + typography. Our equivalent: the `dark` boolean +
  `usePalette()` tokens + the radius tokens already in `tokens.ts`. New
  components take a `density` prop where padding currently varies by call site.
- **Controlled, typed props.** Single typed prop objects, controlled value +
  onChange (no inline ad-hoc state where it should be lifted).
- **Headless logic vs styled presentation.** Where a component carries real
  behavior (a sheet's gesture/backdrop/safe-area, a field's focus/validation,
  tabs' selection state), split a headless hook (`useSheet`, `useField`,
  `useTabs`) from the styled view, so screens can reuse the logic without the
  chrome. Pure-presentation components (Card, Badge, ListRow) stay styled-only.

## 3. Audit: measured repetition in apps/app

Counts from `grep -r` over `apps/app/components` + `apps/app/app`:

| Signal | Count |
| --- | --- |
| `flexDirection: 'row'` inline | 76 |
| `Pressable` usages | 351 |
| `borderRadius` inline | 141 |
| Inline `<TextInput>` (hand-styled fields) | 37 |
| `Pressable` rows with `pressed ?` bg | 45 |
| `paddingTop: insets.top` screen scaffolds | 24 |
| `paddingBottom: ... insets.bottom` scaffolds | 28 |
| Tiny uppercase section labels (fontSize 12/13 Medium) | 48 |
| `999`-radius pill/chip/badge | 45 |
| `<Modal>` sheets | 6 |
| Distinct inline empty-state blocks | 6+ |

These cluster into a handful of missing primitives. The settings screens alone
(`components/settings/*.tsx` + `SystemHeader.tsx`) are 448 lines, the large
majority of which is repeated scaffold + row markup.

## 4. Ranked proposal (impact = LOC saved x reuse count x complexity reduced)

### #1 - `ListRow` (compound `List` + `List.Item`) [styled, with headless option]

The single biggest win. The icon/label/sub/chevron row and the
avatar/title/subtitle/trailing row are re-implemented in nearly every list:
`settings/SettingsMenu.tsx`, `settings/DisplaySettings.tsx`,
`settings/NotificationsSettings.tsx`, `settings/MessengerSettings.tsx`,
`settings/SecuritySettings.tsx`, `ChannelRow.tsx`, `tabs/SearchScreen.rows.tsx`,
`send.recipient.tsx`, `LeftDrawer.parts.tsx`, `AccountsManager.list.tsx`. Each
hand-rolls a `Pressable` + pressed-bg + `Row` + leading icon/avatar +
title/subtitle `Col` + trailing chevron/check/badge + bottom border.

Replaces: ~45 pressed-row blocks, the bulk of the 48 section labels, the grouped
bordered-card list wrapper. ChatKit `ListView` + items.

Proposed API (compound + slots, ChatKit ListView style):

```ts
// Grouped/inset container. radius + border from block-radius token; renders
// dividers between items; optional section label header.
interface ListProps {
  label?: string;            // uppercase section header (replaces 48 inline labels)
  inset?: boolean;           // bordered rounded "card" group vs flush list
  dark: boolean;
  children: ReactNode;       // <List.Item/>s
}

interface ListItemProps {
  leading?: ReactNode;       // slot: Icon | Avatar
  title: string;
  subtitle?: string;
  trailing?: ReactNode;      // slot: chevron | check | Badge | timestamp
  selected?: boolean;        // renders a check in trailing when no trailing given
  onPress?: () => void;
  onLongPress?: () => void;
  destructive?: boolean;     // danger token for title (Security "Remove account")
  density?: 'compact' | 'normal';
  noBorder?: boolean;
  dark: boolean;
}

function List(p: ListProps): ReactElement;
List.Item = function ListItem(p: ListItemProps): ReactElement;
```

Before (SettingsMenu, per row, ~18 lines x 8 rows):

```tsx
<Pressable onPress={...} style={({pressed})=>({backgroundColor: pressed?divider:'transparent'})}>
  <Box style={{marginHorizontal:16,paddingVertical:16,flexDirection:'row',alignItems:'center',gap:12,borderBottomWidth:1,borderBottomColor:divider}}>
    <Icon name={row.icon} size={22} color={head} />
    <Box style={{flex:1}}>
      <Text style={{color:head,fontSize:18,fontFamily:'Calibre-Medium'}}>{row.label}</Text>
      <Text style={{color:sub,fontSize:13,marginTop:1,fontFamily:'Calibre-Medium'}}>{row.sub}</Text>
    </Box>
    <Icon name="chevronRight" size={18} color={sub} />
  </Box>
</Pressable>
```

After:

```tsx
<List.Item dark={dark} leading={<Icon name={row.icon} size={22} />}
  title={row.label} subtitle={row.sub} onPress={() => router.push(row.href)}
  trailing={<Icon name="chevronRight" size={18} />} />
```

Estimated reduction: ~600-750 LOC across the listed files. Highest reuse count
in the app.

### #2 - `Screen` scaffold + `Header` [styled; `Header` already partly exists as SystemHeader]

Every settings/system/sub-page repeats: `Box flex:1 + bg + paddingTop:insets.top`
then `SystemHeader` then `ScrollView contentContainerStyle paddingBottom:32+insets.bottom`.
24 `insets.top` scaffolds + 28 `insets.bottom` scaffolds. `SystemHeader` is
already a good shared header but lives in apps/app and takes 5 manual color props
(`fg`, `head`, `border`...) that should come from the palette internally.

Replaces: the 24/28 scaffold pairs + 10 `SystemHeader` call sites' prop-drilling.

Proposed API (ChatKit container + safe-area aware):

```ts
interface ScreenProps {
  title?: string;            // renders the Header when set
  onBack?: () => void;       // default router.back via headless useScreenBack()
  right?: ReactNode;         // header trailing slot
  scroll?: boolean;          // wrap children in a padded ScrollView (default true)
  dark: boolean;
  children: ReactNode;
}
function Screen(p: ScreenProps): ReactElement;

// Header alone, palette-driven (promote + simplify SystemHeader):
interface HeaderProps { title: string; onBack?: () => void; right?: ReactNode; dark: boolean; }
function Header(p: HeaderProps): ReactElement;
```

Before: 8-12 lines of scaffold per screen. After: `<Screen title="Display" dark={dark}>...`.

Estimated reduction: ~250-350 LOC; removes 5-color prop drilling at 10 sites.

### #3 - `Field` (`Input` + `Field.Label` + `Field.Error`) [headless `useField` + styled]

37 inline `<TextInput>` blocks, each re-styling bg/radius/padding/font +
placeholder color + a label row + sometimes an error line + sometimes a trailing
icon button. See `send.fields.tsx` (RecipientField/AmountField),
`EditProfileModal.tsx`, `group.editor.tsx`, `SearchScreen.tsx`,
`MessengerComposer` inputs, `send-shielded.form.tsx`.

Proposed API (ChatKit Form/Input style; headless split for focus + validation):

```ts
interface FieldProps {
  label?: string;            // uppercase label slot
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  error?: string | null;     // renders Field.Error in danger token
  trailing?: ReactNode;      // slot: contacts/MAX/clear button
  multiline?: boolean;
  status?: ReactNode;        // slot: "Resolving..." / resolved row
  dark: boolean;
}
function Field(p: FieldProps): ReactElement;

// headless: focus state + (optional) async validation/resolution
function useField(opts?: { validate?: (v: string) => string | null }): {
  value: string; setValue: (v: string) => void; error: string | null; focused: boolean;
  bind: { value: string; onChangeText: (v: string) => void; onFocus(): void; onBlur(): void };
};
```

Estimated reduction: ~300-400 LOC; standardizes input look + the label/error/
status slots that are copy-pasted today.

### #4 - `Card` (container + `Card.Status` / `Card.Actions` slots) [styled]

ChatKit's flagship container: a bounded surface with optional status line and
confirm/cancel actions below. apps/app hand-rolls bordered rounded surfaces in
`ChannelCard.tsx`, `MediaCard.tsx`, `GitHubLinkCard.tsx`,
`MessengerBubble.cards.tsx`, the grouped settings boxes, wallet token cards.
141 inline `borderRadius` uses, many are this card surface.

Proposed API (direct ChatKit Card mapping):

```ts
interface CardProps {
  padding?: number;          // density-aware default
  onPress?: () => void;
  dark: boolean;
  children: ReactNode;
}
function Card(p: CardProps): ReactElement;
Card.Status  = (p: { text: string; tone?: 'default'|'danger'|'success'; dark: boolean }) => ReactElement;
Card.Actions = (p: { confirm?: { label: string; onPress(): void }; cancel?: { label: string; onPress(): void }; dark: boolean }) => ReactElement;
```

Estimated reduction: ~200-300 LOC; gives the confirm/cancel pattern one home.

### #5 - `Badge` / `Chip` [styled]

45 `999`-radius pill blocks: unread counts (ChannelRow), label chips
(ChannelRow `LabelChips`, group.labels), status pills. Each re-implements the
min-width/height/center/pill/color math.

Proposed API:

```ts
interface BadgeProps {
  label: string | number;
  tone?: 'neutral' | 'primary' | 'danger' | 'success';
  variant?: 'solid' | 'soft' | 'outline';   // ChatKit badge styles
  onPress?: () => void;                       // interactive chip (label filter)
  dark: boolean;
}
function Badge(p: BadgeProps): ReactElement;
// Count convenience for unread: <Badge.Count value={n} max={99} dark={dark} />
```

Estimated reduction: ~120-180 LOC; collapses ChannelRow's `LabelChips` (~40 LOC)
+ the unread-badge block + scattered status pills.

### #6 - `Sheet` (bottom-sheet, headless `useSheet` + styled) [headless + styled]

`AppModal` is a good start but 6 components hand-roll `<Modal>` +
GestureHandlerRootView + dim backdrop + safe-area + rounded-top sheet:
`AppModal.tsx`, `EditProfileModal.tsx`, `ImageViewer.tsx`,
`AccountsManager.parts.tsx`, `ProfileScreen.parts.tsx`, `xmtp-conv/parts.tsx`.

Proposed API (promote AppModal into kit, add header slot + headless open state):

```ts
interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;            // header slot with close X
  actions?: ReactNode;       // footer slot (confirm/cancel)
  dark: boolean;
  children: ReactNode;
}
function Sheet(p: SheetProps): ReactElement;

function useSheet(): { visible: boolean; open(): void; close(): void; bind: { visible: boolean; onClose(): void } };
```

Estimated reduction: ~150-250 LOC; one correct backdrop/safe-area/gesture-root
implementation instead of 6.

### #7 - `EmptyState` [styled]

6+ inline "centered Col + Spinner or message" blocks: `HomeScreen.parts.tsx`
(HomeEmpty/HomeSpinner), `WalletScreen.activity.tsx`, `HomeScreen.filter.tsx`,
`AccountsManager.list.tsx`, `send.recipient.tsx`.

Proposed API:

```ts
interface EmptyStateProps {
  icon?: HeroIconName;
  message: string;
  action?: { label: string; onPress(): void };  // ChatKit primary-action slot
  loading?: boolean;          // renders the Spinner instead of the message
  dark: boolean;
}
function EmptyState(p: EmptyStateProps): ReactElement;
```

Estimated reduction: ~80-120 LOC; one consistent empty/loading affordance.

### #8 - `Tabs` (underline segmented, headless `useTabs` + styled) [headless + styled]

The underline tab bar is duplicated: `system/KitTabs.tsx` (TabBar),
`WalletScreen.tsx` (Wallet tabs), and the wallet send stepper. Active-underline
+ selection state re-implemented each time.

Proposed API (ChatKit-ish controlled segmented control):

```ts
interface TabsProps<T extends string> {
  tabs: readonly T[];
  value: T;
  onChange: (t: T) => void;
  dark: boolean;
}
function Tabs<T extends string>(p: TabsProps<T>): ReactElement;
function useTabs<T extends string>(tabs: readonly T[], initial?: T): { value: T; setValue: (t: T) => void };
```

Estimated reduction: ~80-120 LOC.

### #9 - `Divider` + `SectionLabel` [styled, small]

The smallest but most pervasive: a 1px border-token line and the tiny uppercase
section label (48 occurrences). Mostly absorbed by `List`/`Screen` above, but a
standalone `Divider` and `SectionLabel` cover the cases outside lists.

```ts
function Divider(p: { dark: boolean; inset?: number }): ReactElement;
function SectionLabel(p: { children: string; dark: boolean }): ReactElement;
```

Estimated reduction: ~60-100 LOC (net of overlap with #1/#2).

### #10 (optional) - `AvatarLabelRow` headless data layer [headless]

`Avatar` exists in apps/app; the repeated bit is the avatar + resolved-name +
truncated-address presentation (`send.recipient` RecipientRow,
`SearchScreen.rows`, `ConversationIntro`, member pickers). A thin
presentational `IdentityRow` + a headless `useIdentity(address)` (name/avatar/
truncation resolution) would dedupe the resolution glue. Lower priority because
the data resolution is app-specific (XMTP/Snapshot), so likely only the
PRESENTATION moves to kit and the headless hook stays in apps/app.

Estimated reduction: ~60-100 LOC presentational.

## 5. Estimated total impact

| Component | Est. LOC saved | Reuse sites | Headless split |
| --- | --- | --- | --- |
| #1 List / List.Item | 600-750 | ~10 files | optional |
| #2 Screen / Header | 250-350 | ~10 sites | useScreenBack |
| #3 Field / useField | 300-400 | ~12 sites | yes |
| #4 Card + slots | 200-300 | ~6 files | no |
| #5 Badge / Chip | 120-180 | ~8 sites | no |
| #6 Sheet / useSheet | 150-250 | 6 files | yes |
| #7 EmptyState | 80-120 | 6+ sites | no |
| #8 Tabs / useTabs | 80-120 | 3 sites | yes |
| #9 Divider / SectionLabel | 60-100 | many | no |
| #10 IdentityRow (opt) | 60-100 | ~5 sites | partial |
| TOTAL | ~1,900-2,650 | | |

Conservative net app reduction after accounting for new imports and overlap:
roughly 1,500-2,000 lines removed from apps/app, concentrated in the settings,
list, and form surfaces, plus a large drop in inline-style surface area
(`borderRadius`/`flexDirection`/pressed-bg counts) which is where most of the
visual-inconsistency bugs come from.

## 6. Suggested implementation order (post sign-off)

1. `Divider` + `SectionLabel` + `Badge` (leaf, zero behavior, unblock #1).
2. `List` + `List.Item` (biggest win; migrate settings screens first).
3. `Screen` + promote/simplify `Header` (migrate settings + system pages).
4. `Field` + `useField` (migrate send + edit-profile + group editor).
5. `Card` + slots, `EmptyState`, `Tabs` + `useTabs`.
6. Promote `AppModal` to `Sheet` + `useSheet`; migrate the 6 modals.
7. Optional `IdentityRow`.

Each step is its own PR off main, JS-only (no native deps), behavior-identical,
verified against the Kit gallery (`apps/app/components/system/*`) plus tsc + lint.

## 7. Risks / notes

- Kit components stay hook-free re: the app's theme (caller passes `dark` +
  palette), matching the existing Button/Text/Title contract. Headless hooks
  (`useField`, `useSheet`, `useTabs`) are framework-only (React) and carry no
  app-specific data deps.
- No native modules introduced; safe for the served branch + hot-reload.
- Migrations must be behavior-identical and verified per-surface; do them
  incrementally, not as one mega-PR.
- Do NOT bump `packages/metro/package.json`. Kit version bumps are fine
  (private package) but coordinate before tagging.
