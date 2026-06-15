# api

> Daemon-backed HTTP service behind api.metro.box.

[![lines of code](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.codetabs.com%2Fv1%2Floc%2F%3Fgithub%3Dbonustrack%2Fstage&query=%24%5B%3F(%40.language%3D%3D%27Total%27)%5D.linesOfCode&label=lines%20of%20code&color=blue)](https://github.com/bonustrack/stage)

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
