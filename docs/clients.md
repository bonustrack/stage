# Clients

## Mobile App

Location: `apps/app`

Stack:

- Expo SDK 54
- React Native
- Expo Router
- XMTP React Native SDK
- WalletConnect / Reown appkit

Common commands:

```sh
bun --cwd apps/app start
bun --cwd apps/app typecheck
bun --cwd apps/app lint
```

For device iteration, prefer a development build when native modules are involved.
Do not switch the bundler to a branch with new native dependencies before the
matching APK/dev client is installed.

## Web App

Location: `apps/ui`

Stack:

- Vue 3
- Vite
- Tailwind
- XMTP browser SDK

Common commands:

```sh
bun --cwd apps/ui dev
bun --cwd apps/ui build
bun --cwd apps/ui preview
```

## Shared Packages

`@metro-labs/client` contains pure shared logic:

- Snapshot profile helpers
- XMTP content humanization
- Embed detection
- Stamp resolution
- Shared event types

`@metro-labs/kit` contains pure visual data:

- Color tokens and font stacks
- Hero icon paths
- Avatar-URL helpers (Stamp avatar/token URLs)
- Theme preference contract

Keep these packages framework-neutral. Web and mobile render their own components.

## Monitor Connection

Both clients use daemon monitor endpoints:

- `GET /api/state`
- `GET /api/tail`
- `POST /api/call/<train>/<action>`

They need:

- Daemon URL
- `METRO_MONITOR_TOKEN`
- Optional self URI for claim-aware filtering

See [Monitor endpoints](../packages/metro/docs/monitor.md).

## XMTP History Note

XMTP V3 fresh installations do not automatically hydrate old message bodies from
another installation's local database. New messages are the reliable sync test.
Full historical import requires history sync/export support and should be treated
as a separate feature from Metro feed isolation.
