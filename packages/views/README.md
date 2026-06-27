# @stage-labs/views

Shared **Kit-JSON view builders** for the two Stage clients — the Vue web app
(`apps/ui`) and the Expo/React Native mobile app (`apps/app`).

A builder is a pure, typed function that takes plain params and returns a Kit
`WidgetNode` tree. The same node tree is then handed to the Kit renderer in
either app (`@stage-labs/kit/react-native/kit-renderer` or
`@stage-labs/kit/vue/kit-renderer`), which walks the JSON and produces native RN
components or Vue components. This is how `apps/ui/src/views/*` and
`apps/app/app/*` stay visually + functionally parallel (the **parity
invariant**): the screen structure lives once here, as data, instead of being
hand-reimplemented in each framework.

Like `@stage-labs/client` and `@stage-labs/kit`, this package ships **raw `.ts`
source with no build step** — `main`/`module`/`types` all point at
`src/index.ts` and consumers (Vite/Metro) transpile TS directly. A new file is
invisible to consumers until it is re-exported from `src/index.ts`.

For the node schema (every node `type`, its fields, color/size/radius tokens,
and how `Color`/`background` are resolved) see the Kit package:
`packages/kit/README.md` and the node interfaces in
`packages/kit/src/kit/nodes.ts` / `node-fields.ts`.

## The builder pattern

```ts
export interface FooParams {
  title: string;
  onPressType?: string;
}

export function foo(params: FooParams): RowNode {
  return {
    type: 'Row',
    align: 'center',
    children: [{ type: 'Text', value: params.title }],
  };
}
```

Rules of thumb:

- **Pure + typed.** No side effects, no I/O, no framework imports. Input is
  plain params; output is a Kit node (`WidgetNode` or a concrete node type like
  `RowNode`/`ColNode`/`ListViewItemNode`).
- **One builder per file**, named after the file (`channelRow.ts` ->
  `channelRow`). Internal helpers stay unexported in the same file.
- **Compose with primitives.** `src/primitives.ts` provides thin constructors
  (`row`, `col`, `card`, `text`, `title`, `caption`, `markdown`, `badge`,
  `image`, `icon`, `button`, `basicRoot`). `src/node.ts` provides `compact`
  (drops `undefined`/`null` fields) and `compactList` (filters a children
  array) so optional nodes can be expressed inline.
- **Size caps apply** (max 400 lines/file, 100 lines/function, complexity 10) —
  split helpers early.
- **No comments.** The repo's `comments/no-comments` ESLint rule bans all
  non-directive comments in `.ts`, so builder documentation lives in this README
  (see the catalogue below), not in JSDoc. Express intent in names/types.

## Action dispatch / registry convention

Builders are pure data and cannot call back into app code directly. Interaction
is routed through **action types**: string constants declared in
`src/actions.ts` (e.g. `CHANNEL_PRESS = 'chat.channel.press'`,
`MEMBER_REMOVE = 'accounts.member.remove'`). A builder attaches an
`onClickAction: { type, payload }` (or `onChangeAction`/`onSubmitAction`) to a
node; the action type is usually overridable via a param (defaulting to the
shared constant) so a caller can re-scope it.

The consuming component supplies a `WidgetActionRegistry` mapping each action
`type` to a handler. The Kit renderer invokes the matching handler (with the
node's `payload`) when the user interacts. This keeps the node tree
serializable and framework-neutral while the app owns the behavior.

## How builders are consumed

Both apps follow the same shape: build the node from app state, then render it
with a registry. Wrap a root node with the app's list/basic root helper as
needed.

Vue (`apps/ui`):

```ts
import KitRenderer from '@stage-labs/kit/vue/kit-renderer';
import type { WidgetActionRegistry } from '@stage-labs/kit/kit';
import { memberRow, MEMBER_PRESS, MEMBER_REMOVE } from '@stage-labs/views';

const registry: WidgetActionRegistry = {
  [MEMBER_PRESS]: () => emit('open'),
  [MEMBER_REMOVE]: () => emit('remove'),
};
const node = computed(() => listRoot(memberRow({ /* params */ })));
// <KitRenderer :node="node" :registry="registry" />
```

React Native (`apps/app`):

```tsx
import { KitRenderer } from '@stage-labs/kit/react-native/kit-renderer';
import type { WidgetActionRegistry } from '@stage-labs/kit/kit';
import { memberRow, MEMBER_PRESS } from '@stage-labs/views';

const registry: WidgetActionRegistry = { [MEMBER_PRESS]: openMember };
// <KitRenderer node={node} registry={registry} />
```

## Colors / tokens convention

Builders must not hardcode hex colors that should adapt to light/dark. Use the
named tokens in `src/colors.ts` instead. The Kit `color`/`background` fields
accept a `Color = string | ThemeColor`, where a `ThemeColor` is
`{ dark, light }` resolved per scheme by the renderer (`resolveColor` in
`packages/kit/src/kit/resolve.ts`), or a semantic token name (`'primary'`,
`'secondary'`, `'danger'`, `'success'`, ...) resolved by `resolveColorToken`.

Centralized tokens (`src/colors.ts`):

- `DANGER_COLOR`, `SUCCESS_COLOR`, `changeColor(change)` — status colors; pick
  via `changeColor('-1.2%')` for signed numeric strings.
- `HIGHLIGHT_BG` — search-match highlight background.
- `VOICE_ACCENT`, `VOICE_ON_ACCENT` — voice-note bubble accent + on-accent.
- `ON_PRIMARY_COLOR` — foreground for content on a `primary` surface (inverse of
  primary; e.g. the check icon on a selected suggestion).
- `MEMBER_OWNER_FG`, `MEMBER_OWNER_BG` — owner badge teal.
- `SURFACE_COLOR`, `BORDER_COLOR`, `FG_COLOR`, `HEAD_COLOR`, `BG_COLOR` — kit
  surface/border/text tokens re-exported as `ThemeColor` pairs.

Some colors are **intentionally theme-independent** and stay fixed (named
constants make the intent explicit, e.g. `QR_FIXED_FOREGROUND` /
`QR_FIXED_BACKGROUND` in `receiveView.ts` — a QR must be black-on-white to scan
— and `VIDEO_LETTERBOX_FIXED` in `videoMessage.ts`). Do not convert those to
theme tokens.

## Adding a new builder

1. Create `src/<area>/<name>.ts` with a `<Name>Params` interface and a single
   `export function <name>(params): <NodeType>`.
2. Compose from primitives + `compact`/`compactList`; use `src/colors.ts`
   tokens, never raw hex (unless intentionally fixed, then name the constant).
3. Route interactivity through an action constant in `src/actions.ts` (reuse an
   existing one when the semantics match) plus an overridable `*Type` param.
4. Re-export it from `src/index.ts` (and add a subpath in `package.json`
   `exports` only if a deep import is needed).
5. Wire it in both apps' components with a matching `WidgetActionRegistry`,
   mirroring the screen on the other platform (parity invariant; tag web work
   that mirrors mobile `(mobile parity)`).
6. Add a one-line entry to the catalogue below.
7. Run the gate from the repo root: `bun run lint`, `bun run typecheck`,
   `bun run knip`, `bun run madge`, `bun run test`.

## Builder catalogue

Primitives (`src/primitives.ts`): `basicRoot`, `row`, `col`, `card`, `text`,
`title`, `caption`, `markdown`, `badge`, `image`, `icon`, `button` — thin typed
constructors for the corresponding Kit nodes.

Chat (`src/chat/*`):

- `channelRow` — conversation list row (avatar, title with optional highlighted
  segments, preview, timestamp, unread badge, label chips). `interactive: false`
  returns the bare body Row instead of a pressable ListViewItem.
- `messageBubble` — chat message bubble; body is text / markdown / highlighted
  segments, plus optional author and meta; `align` is sender vs receiver side.
- `voiceMessage` — voice-note bubble with waveform AudioPlayer (voice accent
  tokens).
- `videoMessage` — inline video player bubble (fixed letterbox background).
- `mediaCard` — media attachment card with optional caption + press action.
- `highlightText` / `highlightSegments` — render text with case-insensitive
  query matches highlighted / split text into matched-vs-unmatched segments.
- `previewLinkCard` — URL link-preview card.
- `pollCard` — poll question, option bars/percentages and vote actions.
- `reactionsRow` / `emojiReactionRow` — reaction summary / quick emoji picker.
- `conversationHeader` — conversation top header.
- `composerBar` / `composerInput` — message composer toolbar / input.
- `filterChips` / `labelBar` — selectable filter chips / label bar.
- `menuSheet` / `overflowMenu` — action sheet / overflow menu.
- `emptyState` / `sectionHeader` — empty-state block / list section header.

Accounts (`src/accounts/*`): `accountRow`, `contactRow`, `suggestionRow`
(selectable, `checkBackground` defaults to `primary`), `memberRow` (member with
optional owner/admin badge + remove), `memberAddForm`, `memberChip`,
`memberTextField`, `topnavIdentity` (shared top-nav avatar + name).

Profile (`src/profile/*`): `profileHeader`, `infoRow`, `profileActionsRow`,
`profileAddressRow`.

Wallet (`src/wallet/*`): `balanceHeader`, `tokenRow` / `tokenRowBody`,
`tokenDetailCard`, `nftGrid`, `noticeCard`, `priceChart`, `addressCard` /
`addressCopyRow` / `addressShareAction`, `receiveView` (address QR, fixed
black-on-white), `sendForm` / `sendFields` / `sendReviewList`, `stepper`,
`walletActions`, `walletTabs`.

Activity (`src/activity/*`): `txRow` — transaction history row.

Proposals (`src/proposals/*`): `proposalCard`, `banner`.

Group (`src/group/*`): `groupFieldEditor`, `labelRow`.

Onboarding (`src/onboarding/*`): `onboardingStep`.

Settings (`src/settings/*`): `settingsSection`, `settingsNavRow`,
`settingsToggleRow`, `settingsValueRow`, `settingsButtonRow`, `settingsThemeRow`,
`settingsSectionTitle`, `settingsListRow`, `settingsRowSelectedIcon`.
