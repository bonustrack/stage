/** Inventory of known stations + their config status, formatted for `metro stations`. */

import pkg from '../../package.json' with { type: 'json' };
import { ClaudeStation } from './claude/index.js';
import { CodexStation } from './codex/index.js';
import { DiscordStation } from './discord/index.js';
import { GitHubStation } from './github/index.js';
import { TelegramStation } from './telegram/index.js';
import type { Capabilities, Station } from './types.js';

export type StationRow = {
  name: string; kind: 'agent' | 'chat';
  configured: boolean | null; detail: string;
  capabilities: Capabilities;
};

const row = (s: Station, kind: 'agent' | 'chat', detail: string, configured: boolean | null): StationRow =>
  ({ name: s.name, kind, configured, detail, capabilities: s.capabilities });

export function listStations(): StationRow[] {
  return [
    row(new ClaudeStation(), 'agent', 'requires `claude` on PATH', null),
    row(new CodexStation(pkg.version), 'agent', 'requires `codex` on PATH', null),
    row(new DiscordStation(), 'chat', 'DISCORD_BOT_TOKEN', !!process.env.DISCORD_BOT_TOKEN),
    row(new TelegramStation(), 'chat', 'TELEGRAM_BOT_TOKEN', !!process.env.TELEGRAM_BOT_TOKEN),
    row(new GitHubStation(), 'chat', 'GITHUB_WEBHOOK_SECRET + GITHUB_BOT_USERNAME (+ GITHUB_TOKEN to post)',
      !!(process.env.GITHUB_WEBHOOK_SECRET && process.env.GITHUB_BOT_USERNAME)),
  ];
}

export const fmtCapabilities = (c: Capabilities): string =>
  `in: ${c.in.join('+') || '–'} · out: ${c.out.join('+') || '–'} · features: ${c.features.join(', ') || '–'}`;
