# ui

Vue 3 web companion for the Metro daemon. Consumes the same monitor endpoints
(`GET /api/state`, `GET /api/tail`, `POST /api/call/<train>/<action>`) as
`app`, so the two are visually + functionally parallel.

## Develop

```sh
bun --cwd apps/ui dev      # vite on http://localhost:5173
bun --cwd apps/ui build    # static bundle in dist/
bun --cwd apps/ui preview  # serve the production build locally
```

The dev server has no proxy — Settings prompts you for the daemon URL +
bearer token on first load and stores them in `localStorage`. Point them at a
local `monitor.metro.box` Cloudflare tunnel or the daemon's loopback port if
CORS suits your setup.

## Pages

- `/` — Channel list / activity entry point.
- `/xmtp/:convId` — XMTP conversation.
- `/group/:id` — XMTP group detail.
- `/contacts` — Contacts.
- `/profile` — Local profile.
- `/user/:address` — Peer profile.
- `/settings` — Daemon URL, bearer token, self URI. `localStorage`-backed.

## Theme

Tailwind config mirrors the React Native palette in `apps/app/` (same
`#0f1115`/`#161a22`/`#5aa9ff`/etc) so the two clients look indistinguishable
in light + dark mode. System theme is the default; switch by toggling the
`dark` class on `<html>`.

## Shared assets

Shared tokens and icon definitions live in `@metro-labs/kit`; pure client logic
lives in `@metro-labs/client`.
