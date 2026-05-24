# Channels

Generic multi-party conversation primitive in Metro core. Higher layers (the Snapshot integration, the butler bot, anything else) build on top by creating channels with the right default memberships — Metro itself stays domain-agnostic.

## Line scheme

```
metro://messenger/channel/<id>
```

`<id>` is a 12-char base62 slug minted at creation. The line is opaque to clients; everything is keyed by it.

The existing `metro://messenger/owner` line stays as a back-compat single-user channel for Less's solo use.

## Membership

A sidecar file `~/.cache/metro/members.json`:

```json
{
  "metro://messenger/channel/aB3cD4eF5gH6": {
    "members": ["metro://user/eth/0xAlice…", "metro://user/eth/0xBob…", "metro://agent/snapshot"],
    "permissions": { "metro://user/eth/0xAlice…": "admin" }
  }
}
```

- `members[]` — URIs that can read + write on the channel.
- `permissions{}` — overrides; default permission for a listed member is `write`. `admin` can add/remove members. Members not listed in `permissions` get `write`. Members listed with `"read"` are read-only.
- A line absent from this file behaves like today's single-user lines (no membership filter applied — back-compat).

## Identity-aware tail / state

`/api/tail` and `/api/state` accept a JWT in `Authorization: Bearer <jwt>`. The JWT's `sub` is a Metro URI. When set, the endpoint:

1. Decodes the URI.
2. For every entry, checks `members.json` for the entry's `line`. If the line has membership and the URI isn't in it → skip.
3. Lines with no membership entry behave as before (admin-token still works for those).

The existing `METRO_MONITOR_TOKEN` keeps full access for the daemon's own admin surfaces (CLI tail, monitor dashboard).

## Auth: SIWE → JWT

```
POST /api/auth/siwe
  body:  { message, signature }
  reply: { jwt, sub: "metro://user/eth/0x…" }
```

- `message` is the standard EIP-4361 SIWE message; daemon verifies signature against the recovered address.
- JWT is HS256, 24h TTL, signed with `METRO_JWT_SECRET` (random 32-byte env, generated at first boot).
- `sub` is the wallet's metro URI. No other claims.

Mobile / web stores the JWT in secure storage; refreshes via re-signing when expired.

## Channel CRUD

```
POST /api/channels
  body:  { members: ["metro://user/eth/0x…", ...] }
  reply: { line: "metro://messenger/channel/<id>" }
  authz: caller must be in members[]
```

```
GET /api/channels
  reply: { channels: [{ line, members, last_message_ts }, ...] }
  authz: only lines where the JWT's sub is a member
```

```
POST /api/channels/<id>/members
  body:  { add: [...], remove: [...] }
  authz: admin only
```

## TEAM_WALLETS env

```
TEAM_WALLETS=0xAlice…,0xBob…,0xCarol…
```

Metro exposes a tiny helper `readTeamWallets(): string[]` that returns these. The Snapshot integration layer uses it when creating "support" channels (members = user + agent + team). Metro core never reads it for any decision logic — it's just config exposed for app code.

## Surfaces

| Surface              | What it shows                                            |
|----------------------|----------------------------------------------------------|
| snapshot.org widget  | One channel — opened on-demand, embedded in snapshot.org |
| metro.box web        | Channel list + per-channel view                          |
| Mobile app           | Channel list + per-channel view (existing messenger UX)  |
| CLI tail             | All channels (admin token)                               |

All four surfaces hit the same daemon endpoints; the membership filter is the only thing that varies what each client sees.

## Agent worker

Long-lived process (`packages/metro/src/agents/snapshot.ts`) that:

1. Authenticates to the daemon as `metro://agent/snapshot` (well-known URI; admin token-scoped).
2. Tails all `metro://messenger/channel/*` lines it's a member of.
3. For each inbound entry from a non-agent member, decides whether to reply:
   - **Solo channel** (only user + agent): always reply, grounded in docs.
   - **Multi-party channel** (user + agent + humans): wait N minutes (env `AGENT_REPLY_DELAY_S`, default 600); if a human replies first, stay silent; else reply.
4. Grounding: retrieves top-k chunks from a sqlite-backed embedding index of `docs.snapshot.org`. Refreshed weekly via cron.

## Phasing

All three phases ship before any user-facing surface goes live:

1. **Core**: channels primitive, membership, SIWE/JWT, channel CRUD, TEAM_WALLETS plumbing.
2. **Clients**: snapshot.org widget, metro.box channel list, mobile channel list.
3. **Agent**: docs scrape + index, agent worker, reply timing logic.

Each phase merges as its own PR for review.

## Out of scope (for now)

- Per-message reactions on group channels (today's reaction system already works; just verify it scales with multi-party).
- Read receipts (separator already shows unread cutoff per-user; per-message read-by-N is a future enhancement).
- Federation / cross-daemon channels.
- Public/browsable channels (Less chose private-only).
- Per-space team lists (chose one global TEAM_WALLETS env instead).
