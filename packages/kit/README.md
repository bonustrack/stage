# @stage-labs/kit

> Shared design-system primitives for the Stage clients: tokens, icon data, and theme contracts.

## Overview

`@stage-labs/kit` is the single source of truth for how Stage looks. It ships the colour and spacing tokens, HeroIcon path data, station icon definitions, avatar helpers, the theme-preference contract, and one React Native component family (rendering on web via react-native-web) consumed by the universal app ([`apps/stage`](../../apps/stage)). Screens and chat message content compose the components directly in JSX.

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
import { colors, resolveColorToken } from '@stage-labs/kit/tokens';
import { resolveIconName } from '@stage-labs/kit/icons';
import { resolveBadgeStyle } from '@stage-labs/kit/badge';
```

```tsx
// React Native components (peer deps: react, react-native, react-native-svg, ...)
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
```

## Project structure

```
src/
  tokens.ts          # colour + spacing tokens, colour helpers (Scheme, resolveColor, ...)
  theme.ts           # theme-preference contract + resolution
  theme-derive.ts    # custom-palette deriver
  icons.ts           # HeroIcon names + resolveIconName
  heroicons.data.ts  # HeroIcon path data
  avatar.ts          # avatar helpers
  layout.ts          # Box layout core (spacing, borders, surfaces)
  badge.ts           # badge style core
  text.styles.ts / button.styles.ts / control.styles.ts  # shared style cores
  react-native/      # THE component family (Button, Text, Dialog, ...), renders on web via RNW
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
