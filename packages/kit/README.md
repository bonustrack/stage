# @stage-labs/kit

> Shared design-system primitives for the Stage clients: tokens, icon data, and theme contracts.

## Overview

`@stage-labs/kit` is the single source of truth for how Stage looks. It ships the colour and spacing tokens, HeroIcon path data, station icon definitions, avatar helpers, the theme-preference contract, one React Native component family (rendering on web via react-native-web), and the JSON `KitRenderer`/`ViewHost` (45 node types, registry-enforced) consumed by the universal app ([`apps/stage`](../../apps/stage)).

Style logic lives in framework-free core modules (`text.styles.ts`, `button.styles.ts`, `control.styles.ts`, `layout.ts`); components target React Native via peer dependencies and render on every platform, web included.

## Install

The package is consumed inside the monorepo via `workspace:*`; no separate install is needed.

```sh
bun install            # from the repo root
```

```jsonc
// in a consuming workspace's package.json
"dependencies": { "@stage-labs/kit": "workspace:*" }
```

## Usage

```ts
import { colors, spacing } from '@stage-labs/kit/tokens';
import { resolveTheme } from '@stage-labs/kit/theme';
import { stationIcons } from '@stage-labs/kit/icons';
```

```tsx
// React Native primitive components (peer deps: react, react-native, react-native-svg)
import { Button } from '@stage-labs/kit/button';
import { Text } from '@stage-labs/kit/text';
```

## Project structure

```
src/
  tokens.ts          # colour + spacing tokens
  theme.ts           # theme-preference contract + resolution
  icons.ts           # station icon definitions
  heroicons.data.ts  # HeroIcon path data
  avatar.ts          # avatar helpers
  layout.ts          # layout constants
  button.tsx         # RN primitives: button (+ button.styles)
  text.tsx / title.tsx / icon.tsx
  index.ts           # root barrel
```

## Scripts

| Script              | Description                  |
| ------------------- | --------------------------- |
| `bun run typecheck` | Type-check without emitting. |
| `bun run lint`      | Lint `src/`.                |

## Links

- Consumed by [`apps/stage`](../../apps/stage)
- Shared logic lives in [`@stage-labs/client`](../client)
