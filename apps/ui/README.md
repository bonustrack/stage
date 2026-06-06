# ui

> Vue 3 web client for Metro: channels, conversations, and profiles in the browser.

[![lines of code](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/bonustrack/metro/main/.github/badges/loc-ui.json)](https://github.com/bonustrack/metro)
[![Vue](https://img.shields.io/badge/Vue-3-42b883?logo=vuedotjs&logoColor=white)](https://vuejs.org)
[![Vite](https://img.shields.io/badge/Vite-6-646cff?logo=vite&logoColor=white)](https://vitejs.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

## Overview

`ui` is the web companion to the Metro mobile app. It is a Vue 3 + Vite single-page app that talks to XMTP directly via the browser SDK and renders the same channels, conversations, and Snapshot profiles as [`apps/app`](../app), so the two stay visually and functionally parallel.

It shares all platform-neutral logic with the mobile client through [`@stage-labs/client`](../../packages/client) and its visual language through [`@metro-labs/kit`](../../packages/kit). The web-specific code is the Vue components, pages, router, and the composable hooks in `src/lib`.

## Setup

```sh
bun install            # from the repo root
```

## Usage

```sh
cd apps/ui
bun run dev            # Vite dev server with HMR
bun run build          # type-check + production build to dist/
bun run preview        # serve the production build locally
```

## Project structure

```
src/
  main.ts        # app entry
  App.vue        # root component
  router.ts      # vue-router routes
  pages/         # Channels, Contacts, GroupDetail, Profile, Settings, ...
  components/    # Composer, ChannelRow, HeroIcon, embeds, layout, ...
  lib/           # composables + XMTP glue (useChannels, useXmtpConversation, xmtp*, ...)
  style.css      # Tailwind entry
```

## Scripts

| Script             | Description                                  |
| ------------------ | -------------------------------------------- |
| `bun run dev`      | Start the Vite dev server with HMR.          |
| `bun run build`    | Type-check (`vue-tsc`) then build to `dist/`. |
| `bun run preview`  | Preview the production build.                 |
| `bun run typecheck`| Type-check without emitting.                  |
| `bun run lint`     | Lint `src/`.                                 |

## Links

- Shared logic: [`@stage-labs/client`](../../packages/client)
- Design tokens: [`@metro-labs/kit`](../../packages/kit)
- Mobile counterpart: [`apps/app`](../app)
