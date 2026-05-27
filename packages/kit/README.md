# @metro-labs/kit

Shared design-system primitives for the Metro clients.

## Why this is data, not components

`apps/ui` is **Vue 3** and `apps/app` is **React Native**. There are no literal
cross-framework shared components — a `.vue` SFC cannot render inside React
Native, and an RN `View` cannot mount in the DOM. So "shared UI" here means the
**framework-agnostic data** that the per-framework components render against,
plus a documented contract for keeping the two implementations visually in sync.

## What's in here

| Module | Exports | Consumed by |
| --- | --- | --- |
| `tokens` | `colors` (the `metro.*` palette), `color()`, `fontFamily`, `spacing`, `radius` | `apps/ui/tailwind.config.ts` (palette source of truth), `apps/app/**` StyleSheet colours |
| `icons` | `HERO_ICON_PATHS` (union of both shells' icons), `HeroIconName`, `HERO_ICON_DEFAULTS` | `apps/ui/src/components/HeroIcon.vue`, `apps/app/components/HeroIcon.tsx` |
| `stations` | `STATIONS`, `StationKey`, `StationIconDef`, `getStationIcon()`, `stationLabel()` | station icon renderers in both apps |
| `theme` | `ThemePreference`, `THEME_STORAGE_KEY`, `THEME_PREFERENCES`, `isThemePreference()` | `apps/ui/src/lib/theme.ts`, `apps/app/lib/theme.ts` |

Import either from the root (`@metro-labs/kit`) or a subpath
(`@metro-labs/kit/icons`).

## Component-naming convention

Components that exist in **both** shells share a name and a public prop shape so
the codebases stay legible side-by-side:

- `HeroIcon` — `apps/ui/src/components/HeroIcon.vue` ≙ `apps/app/components/HeroIcon.tsx`.
  Props: `{ name: HeroIconName; size?: number; color?: string; focused?: boolean }`
  (Vue omits `color`/`focused` today — `currentColor` is inherited from CSS).
- `MessengerBubble`, `ChannelRow`, `EditProfileModal`, `GroupAvatarEditor`, … —
  same names, framework-native implementations.

## Shareable vs framework-specific

**Shareable (lives here or in `@metro-labs/client`):**
- Colour / spacing / radius tokens, font stacks
- SVG path data (HeroIcons, station glyphs)
- Pure types & prop-shape contracts
- Pure logic with no UI: profile/Snapshot, XMTP humanisation, embed detection,
  Stamp resolution, activity bucketing → these live in `@metro-labs/client`.

**Framework-specific (stays in each app):**
- Anything that renders: `.vue` SFCs, `.tsx` components, the `<svg>`/`<Svg>`
  element choice
- Reactivity & storage: Vue `ref`/`computed` + `localStorage` vs React
  hooks + `expo-secure-store`
- Platform APIs: `react-native-svg`, `expo-*`, `window`/`document`,
  `react-native-markdown-display` vs `markdown-it`

## No build step

Exports point at `.ts` source. Both consumers bundle TypeScript directly
(Vite + `vue-tsc` for web, Metro + `babel-preset-expo` for mobile), so there's
no `dist/` to keep in sync.
