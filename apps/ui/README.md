# ui

> Vue 3 web client for Stage: channels, conversations, and profiles in the browser.

[![lines of code](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.codetabs.com%2Fv1%2Floc%2F%3Fgithub%3Dbonustrack%2Fstage&query=%24%5B%3F(%40.language%3D%3D%27Total%27)%5D.linesOfCode&label=lines%20of%20code&color=blue)](https://github.com/bonustrack/stage)

## Overview

`ui` is the web companion to the Stage mobile app. It is a Vue 3 + Vite single-page app that talks to XMTP directly via the browser SDK and renders the same channels, conversations, and Snapshot profiles as [`apps/app`](../app), so the two stay visually and functionally parallel.

It shares all platform-neutral logic with the mobile client through [`@stage-labs/client`](../../packages/client) and its visual language through [`@stage-labs/kit`](../../packages/kit). The web-specific code is the Vue components, views, router, and the composable hooks in `src/lib`.

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
  views/         # Channels, Contacts, GroupDetail, Profile, Settings, ...
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

`apps/ui` must build its UI from [`@stage-labs/kit/vue/*`](../../packages/kit) components (`Row`, `Col`, `Scroll`, `Icon`, `Button`, `Title`, `Text`, form controls, …) rather than raw HTML elements. This is enforced by the `uiKitOnly` ESLint rule in [`eslint.config.mjs`](../../eslint.config.mjs), and the kit theme is wired up at the root via `provideKitTheme`.

Raw `<div>` is banned: use the precise kit layout primitive — `<Row>` for flex rows (`flex` / `flex-row`), `<Col>` for flex columns and plain block stacks (`flex flex-col` and bare block `<div>`), and `<Scroll>` for overflow/scroll containers. `Row`/`Col`/`Scroll` are globally registered via the apps/ui Vite tag resolver (no per-file import). Never use `<Box direction="…">`.

A small number of native form controls have **no kit equivalent** and are rendered as bare elements via `<component :is="'input' | 'textarea'">` to satisfy the rule honestly. Each site carries a `<!-- kit-exception: … -->` HTML comment explaining why. The sanctioned exceptions are:

- **Native file inputs** — kit `Input` has no `'file'` inputType, so `<input type="file">` is used directly in [`src/components/Composer.vue`](src/components/Composer.vue) (image picker) and [`src/components/GroupAvatarEditor.vue`](src/components/GroupAvatarEditor.vue) (avatar picker).
- **Auto-grow composer textarea** — [`src/components/Composer.vue`](src/components/Composer.vue) needs a direct DOM `textarea` ref for `scrollHeight` measurement, and kit `Textarea` forces its own boxed inline style that would override the transparent composer surface.
- **Inline-edit controls** — [`src/components/InlineEditableText.vue`](src/components/InlineEditableText.vue) renders bare `input`/`textarea` because kit `Input`/`Textarea` apply their own inline-style box (bg/border/padding/font) that would override the Metro-surface themed styling these controls rely on.
- **Ref-measured scroll viewport** — [`src/views/XmtpConversation.vue`](src/views/XmtpConversation.vue) keeps a native `<div>` (via `<component :is="'div'">`) for the conversation scroll container: it is `ref`-measured by `useXmtpConversation` (reads `scrollTop`/`scrollHeight` for auto-scroll), needs `absolute inset-0` + `no-scrollbar`, and kit `Scroll` forces its own inline `display:flex`/overflow styles and does not forward a ref to its inner node.

## Links

- Shared logic: [`@stage-labs/client`](../../packages/client)
- Design tokens: [`@stage-labs/kit`](../../packages/kit)
- Mobile counterpart: [`apps/app`](../app)
