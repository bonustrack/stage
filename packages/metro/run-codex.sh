#!/usr/bin/env bash
set -euo pipefail

MODEL="${CODEX_MODEL:-gpt-5.5}"

if ! command -v codex >/dev/null 2>&1; then
  bun install -g @openai/codex
fi

if [ ! -f "$HOME/.codex/auth.json" ]; then
  echo "Signing in with your ChatGPT account..."
  codex login
fi

exec codex --model "$MODEL" "$@"
