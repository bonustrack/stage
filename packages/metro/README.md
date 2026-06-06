# @metro-labs/metro

> Event-interception wire: supervise train subprocesses, multiplex their JSON event streams, and route outbound actions back in.

[![lines of code](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.codetabs.com%2Fv1%2Floc%2F%3Fgithub%3Dbonustrack%2Fmetro&query=%24%5B%3F(%40.language%3D%3D%27Total%27)%5D.linesOfCode&label=lines%20of%20code&color=blue)](https://github.com/bonustrack/metro)

## Overview

`metro` is the core of the [Metro](https://github.com/bonustrack/metro) monorepo: a small, pure-transport daemon and CLI. It supervises per-platform "train" subprocesses living in `~/.metro/trains/`, multiplexes the JSON events they emit onto a single stdout stream, and forwards outbound action calls back into the matching train's stdin.

The wire knows nothing about Telegram, Discord, or XMTP. Platform behaviour is written as train scripts (by the user or an agent) on top of the transport this package provides, which keeps the core stable while integrations evolve freely.

## Install

```sh
npm install -g @metro-labs/metro
# or, from a clone of the monorepo:
bun install
```

## Usage

Run the daemon and watch the multiplexed event stream:

```sh
metro
```

Send an outbound action to a train via the CLI:

```sh
metro send "metro://xmtp/<account>/<conversation>" "hello"
metro react "metro://xmtp/<account>/<conversation>" <messageId> 👍
metro call xmtp newGroup '{"addresses":["0x..."],"name":"my group"}'
```

Define a train with the helper:

```ts
import { defineTrain } from '@metro-labs/metro/define-train';

export default defineTrain({
  station: 'example',
  async start({ emit }) {
    emit({ line: 'metro://example/demo', from: 'someone', text: 'hi' });
  },
  actions: {
    async send({ line, text }) {
      // deliver `text` to `line` on your platform
    },
  },
});
```

## Project structure

```
src/
  cli/            # the `metro` command (send, react, monitor, webhook, tunnel)
  trains/         # train supervisor + the train<->daemon protocol
  stations/       # built-in station normalizers (discord, telegram, xmtp)
  broker/         # claims + history streaming between daemon and clients
  codex-rc/       # codex bridge (protocol, client)
  dispatcher/     # outbound action routing
  schema.ts       # the event + action envelope contract
  define-train.ts # public helper for authoring trains
docs/             # protocol + usage docs (shipped with the package)
examples/         # example train scripts
```

## Scripts

| Script              | Description                                  |
| ------------------- | -------------------------------------------- |
| `bun run build`     | Compile `src/` to `dist/` with `tsc`.        |
| `bun run typecheck` | Type-check without emitting.                 |
| `bun run lint`      | Lint `src/` and `examples/`.                 |
| `bun run lint:fix`  | Lint and auto-fix.                           |
| `bun test`          | Run the test suite in an isolated state dir. |

## Links

- Monorepo: [bonustrack/metro](https://github.com/bonustrack/metro)
- Consumer: [`apps/api`](../../apps/api) shells the `metro` CLI to create daemon-owned groups
