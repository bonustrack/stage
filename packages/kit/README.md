# @metro-labs/kit

> Shared design-system primitives for the Metro clients: tokens, icon data, and theme contracts.

[![lines of code](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.codetabs.com%2Fv1%2Floc%2F%3Fgithub%3Dbonustrack%2Fmetro&query=%24%5B%3F(%40.language%3D%3D%27Total%27)%5D.linesOfCode&label=lines%20of%20code&color=blue)](https://github.com/bonustrack/metro)

## Overview

`@metro-labs/kit` is the single source of truth for how Metro looks. It ships the colour and spacing tokens, HeroIcon path data, station icon definitions, avatar helpers, and the theme-preference contract shared by the Vue web app ([`apps/ui`](../../apps/ui)) and the React Native app ([`apps/app`](../../apps/app)).

Most of the package is framework-agnostic data so both clients stay visually identical from one place. The few primitive components it exports (`button`, `text`, `title`, `icon`) target React / React Native via peer dependencies; the web renderers stay in `apps/ui`.

## Install

The package is consumed inside the monorepo via `workspace:*`; no separate install is needed.

```sh
bun install            # from the repo root
```

```jsonc
// in a consuming workspace's package.json
"dependencies": { "@metro-labs/kit": "workspace:*" }
```

## Usage

```ts
import { colors, spacing } from '@metro-labs/kit/tokens';
import { resolveTheme } from '@metro-labs/kit/theme';
import { stationIcons } from '@metro-labs/kit/icons';
```

```tsx
// React Native primitive components (peer deps: react, react-native, react-native-svg)
import { Button } from '@metro-labs/kit/button';
import { Text } from '@metro-labs/kit/text';
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

- Consumed by [`apps/ui`](../../apps/ui) and [`apps/app`](../../apps/app)
- Shared logic lives in [`@stage-labs/client`](../client)
