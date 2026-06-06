# api

> Daemon-backed HTTP service behind api.metro.box.

[![lines of code](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/bonustrack/metro/main/.github/badges/loc-api.json)](https://github.com/bonustrack/metro)
[![Bun](https://img.shields.io/badge/runtime-Bun-000000?logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

## Overview

A small standalone Bun HTTP server that exposes the Metro daemon to the public web at `api.metro.box`. It currently powers the website's "Ask a question" button: rather than the visitor creating an XMTP group, the API shells `metro call xmtp newGroup` so the **daemon** creates and owns the group as super-admin, and the requesting user joins as a plain member.

It is kept out of `~/.metro/trains/` on purpose, so the metro daemon does not supervise or restart it and bounce the other trains.

## Setup

```sh
bun install            # from the repo root
```

The server shells the global `metro` CLI, so the daemon must be running and `metro` must be on `PATH`.

## Usage

Run the server (listens on `METRO_API_PORT`, default `8500`):

```sh
cd apps/api && bun run start
```

Endpoints:

| Method | Path            | Description                                                       |
| ------ | --------------- | ---------------------------------------------------------------- |
| `GET`  | `/health`       | Liveness check, returns `ok`.                                    |
| `POST` | `/ask-question` | Body `{ address }`; creates a daemon-owned XMTP group, returns `{ conversationId, line }`. |

## Project structure

```
src/
  index.ts   # the entire HTTP server: routing, CORS, daemon group creation
```

## Scripts

| Script            | Description                       |
| ----------------- | --------------------------------- |
| `bun run start`   | Run the HTTP server (`src/index.ts`). |

## Links

- Shells the [`@metro-labs/metro`](../../packages/metro) CLI to create daemon-owned groups
- Serves the web client [`apps/ui`](../ui)
