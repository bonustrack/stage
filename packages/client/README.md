# @metro-labs/client

Framework-agnostic shared logic for the Metro clients (`apps/ui` Vue web +
`apps/app` React Native). **Pure TypeScript** — no Vue, no React, no
react-native, no browser-only globals beyond `fetch`.

This was previously the loose `apps/_shared/*` directory, imported via relative
paths (`../../_shared/...`) on mobile and a `@shared` Vite/tsconfig alias on
web. It's now a real workspace package so both apps import it the same way.

## Modules

| Subpath | What |
| --- | --- |
| `@metro-labs/client/types` | `HistoryEntry` — the message/event envelope both feeds render |
| `@metro-labs/client/profile/snapshot` | Snapshot hub endpoints, EIP-712 schema, profile read/write, `avatarRenderUrl`, `getCacheHash`, `PROFILE_FIELD_LIMITS` |
| `@metro-labs/client/xmtp/humanize` | `previewOfXmtpContent`, `humanizeGroupUpdated`, `shortContentType` |
| `@metro-labs/client/embed/detect` | `youtubeIdOf`, `mapCoordsOf`, `osmTileXY`, `osmTileUrl` |
| `@metro-labs/client/stamp/resolve` | `resolveDomain`, `lookupName`, `isAddressLike`, `isDomainLike`, `resolveSearchInputToAddress` |

The package root (`@metro-labs/client`) re-exports everything.

## No build step

Exports point at `.ts` source — both consumers bundle TypeScript directly
(Vite for web, Metro/Expo for mobile).
