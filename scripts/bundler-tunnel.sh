#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-8081}"

exec cloudflared tunnel run --url "http://localhost:${PORT}" stage-bundler
