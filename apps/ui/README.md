# ui

> Vue 3 web client for Stage: channels, conversations, and profiles in the browser.

[![lines of code](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.codetabs.com%2Fv1%2Floc%2F%3Fgithub%3Dbonustrack%2Fstage&query=%24%5B%3F(%40.language%3D%3D%27Total%27)%5D.linesOfCode&label=lines%20of%20code&color=blue)](https://github.com/bonustrack/stage)

## Overview

`ui` is the web companion to the Stage mobile app. It is a Vue 3 + Vite single-page app that talks to XMTP directly via the browser SDK and renders the same channels, conversations, and Snapshot profiles as [`apps/app`](../app), so the two stay visually and functionally parallel.

It shares all platform-neutral logic with the mobile client through [`@stage-labs/client`](../../packages/client) and its visual language through [`@stage-labs/kit`](../../packages/kit). The web-specific code is the Vue components, pages, router, and the composable hooks in `src/lib`.

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

## Kit-only enforcement & exceptions

`apps/ui` must build its UI from [`@stage-labs/kit/vue/*`](../../packages/kit) components (`Layout`, `Icon`, `Button`, `Title`, `Text`, form controls, …) rather than raw HTML elements. This is enforced by the `uiKitOnly` ESLint rule in [`eslint.config.mjs`](../../eslint.config.mjs), and the kit theme is wired up at the root via `provideKitTheme`.

A small number of native form controls have **no kit equivalent** and are rendered as bare elements via `<component :is="'input' | 'textarea'">` to satisfy the rule honestly. Each site carries a `<!-- kit-exception: … -->` HTML comment explaining why. The sanctioned exceptions are:

- **Native file inputs** — kit `Input` has no `'file'` inputType, so `<input type="file">` is used directly in [`src/components/Composer.vue`](src/components/Composer.vue) (image picker) and [`src/components/GroupAvatarEditor.vue`](src/components/GroupAvatarEditor.vue) (avatar picker).
- **Auto-grow composer textarea** — [`src/components/Composer.vue`](src/components/Composer.vue) needs a direct DOM `textarea` ref for `scrollHeight` measurement, and kit `Textarea` forces its own boxed inline style that would override the transparent composer surface.
- **Inline-edit controls** — [`src/components/InlineEditableText.vue`](src/components/InlineEditableText.vue) renders bare `input`/`textarea` because kit `Input`/`Textarea` apply their own inline-style box (bg/border/padding/font) that would override the Metro-surface themed styling these controls rely on.

## Links

- Shared logic: [`@stage-labs/client`](../../packages/client)
- Design tokens: [`@stage-labs/kit`](../../packages/kit)
- Mobile counterpart: [`apps/app`](../app)
