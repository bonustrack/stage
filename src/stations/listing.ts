/** Inventory of known stations + their config status, formatted for `metro stations`. */

import { CAPABILITIES as claudeCaps } from './claude/index.js';
import { CAPABILITIES as codexCaps } from './codex/index.js';
import { CAPABILITIES as discordCaps } from './discord/index.js';
import { CAPABILITIES as githubCaps } from './github/index.js';
import { CAPABILITIES as telegramCaps } from './telegram/index.js';
import type { Capabilities } from './types.js';

export type StationRow = {
  name: string; kind: 'agent' | 'chat';
  configured: boolean | null; detail: string;
  capabilities: Capabilities;
};

const env = (k: string): boolean => !!process.env[k];

export const listStations = (): StationRow[] => [
  { name: 'claude', kind: 'agent', configured: null, detail: 'requires `claude` on PATH', capabilities: claudeCaps },
  { name: 'codex', kind: 'agent', configured: null, detail: 'requires `codex` on PATH', capabilities: codexCaps },
  { name: 'discord', kind: 'chat', configured: env('DISCORD_BOT_TOKEN'), detail: 'DISCORD_BOT_TOKEN', capabilities: discordCaps },
  { name: 'telegram', kind: 'chat', configured: env('TELEGRAM_BOT_TOKEN'), detail: 'TELEGRAM_BOT_TOKEN', capabilities: telegramCaps },
  { name: 'github', kind: 'chat', configured: env('METRO_TOKEN') && env('GITHUB_BOT_USERNAME') && env('GITHUB_TOKEN'),
    detail: 'METRO_TOKEN + GITHUB_BOT_USERNAME + GITHUB_TOKEN', capabilities: githubCaps },
];

export const fmtCapabilities = (c: Capabilities): string =>
  `in: ${c.in.join('+') || '–'} · out: ${c.out.join('+') || '–'} · features: ${c.features.join(', ') || '–'}`;
