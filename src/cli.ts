#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from '../package.json' with { type: 'json' };
import * as discord from './channels/discord.js';
import * as telegram from './channels/telegram.js';
import { buildSendBody, tg } from './channels/telegram.js';
import { type Address, type Platform, parseAddress } from './lib/address.js';
import { readDotenv, writeDotenv } from './lib/dotenv.js';
import { errMsg, log } from './log.js';
import {
  CONFIG_ENV_FILE,
  configuredPlatforms,
  loadMetroEnv,
  type SkillRuntime,
  STATE_DIR,
  skillDir,
} from './paths.js';

// ---------------- USAGE ----------------------------------------------------

const USAGE = `metro — Telegram + Discord bridge for your agent

Usage:
  metro                                       Inbound stream (long-running; run in the background).
  metro setup […]                             Manage tokens and the agent skill (see below).
  metro doctor                                Health check across tokens, gateways, and skills.
  metro reply    --to=<addr> [--text=<t>]     Quote-reply, threading under the original. Clears 👀.
  metro react    --to=<addr> --emoji=<e>      Set or clear ('') a reaction.
  metro edit     --to=<addr> [--text=<t>]     Edit a message the bot previously sent.
  metro send     --to=<addr> [--text=<t>]     Send a proactive message (no reply context).
                                                <addr> is channel-only: <platform>:<chat_id> (no /message_id).
  metro download --to=<addr> [--out=<dir>]    Download image attachments to disk.
  metro fetch    --to=<addr> [--limit=N]      Recent-message lookback (Discord only).
  metro update                                Upgrade in place (npm/bun/pnpm auto-detected).

setup verbs:
  metro setup                                 Status: tokens, skills, what's next.
  metro setup telegram <token>                Save TELEGRAM_BOT_TOKEN (validated via getMe; --no-validate skips).
  metro setup discord  <token>                Save DISCORD_BOT_TOKEN (validated via getMe; --no-validate skips).
  metro setup clear [telegram|discord|all]    Remove tokens.
  metro setup skill [--project] [--clear]     Install (or remove) the agent skill.

Address format:
  telegram:<chat_id>/<message_id>      e.g. telegram:-100123456789/4567
  discord:<channel_id>/<message_id>    e.g. discord:1234567890/9876543210
  discord:<channel_id>                 fetch only (no message id)

Common flags:
  --json              machine-parseable output (single JSON line/array)
  --version, -v       print the metro version
  --help, -h          print this help

reply / edit Telegram extras:
  --parse-mode=HTML|MarkdownV2  --no-link-preview  --buttons-json='[[{"text":"…","url":"…"}]]'

Exit codes:
  0  success
  1  usage error (bad flags, unknown subcommand)
  2  configuration error (no tokens — run \`metro setup\`)
  3  upstream error (rate limit, auth, network — retry once, then surface)
`;

// ---------------- shared types & helpers -----------------------------------

type Flags = Record<string, string | boolean>;
type ExitErr = Error & { code?: number };

function exitErr(message: string, code: number): ExitErr {
  return Object.assign(new Error(message), { code });
}

function parseArgs(argv: string[]): { positional: string[]; flags: Flags } {
  const positional: string[] = [];
  const flags: Flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { positional.push(a); continue; }
    const eq = a.indexOf('=');
    if (eq !== -1) { flags[a.slice(2, eq)] = a.slice(eq + 1); continue; }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { flags[key] = next; i++; }
    else flags[key] = true;
  }
  return { positional, flags };
}

const isJson = (flags: Flags): boolean => flags.json === true;

function emitResult(flags: Flags, human: string, structured: unknown): void {
  process.stdout.write(isJson(flags) ? JSON.stringify(structured) + '\n' : human + '\n');
}

function resolveAddr(flags: Flags, requireMessage: boolean): Address {
  const addr = parseAddress(String(flags.to), requireMessage);
  if (!configuredPlatforms()[addr.platform]) {
    throw exitErr(`platform '${addr.platform}' is not configured (missing token)`, 2);
  }
  return addr;
}

function tgMessageId(addr: Address): number {
  const n = Number(addr.messageId);
  if (!Number.isInteger(n)) throw new Error(`telegram message_id must be an integer: ${addr.messageId}`);
  return n;
}

// Tell tail.ts to stop refreshing the typing indicator (the agent has replied).
function signalReplyComplete(platform: Platform, chat: string): void {
  const dir = join(STATE_DIR, '.typing-stop');
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${platform}_${chat}`), '');
  } catch (err) {
    log.warn({ err: errMsg(err) }, 'typing stop-signal write failed');
  }
}

async function clearReaction(addr: Address): Promise<void> {
  if (addr.platform === 'telegram') {
    await tg('setMessageReaction', { chat_id: addr.chat, message_id: tgMessageId(addr), reaction: [] });
  } else {
    await discord.setReaction(addr.chat, addr.messageId!, '');
  }
}

async function readStdinText(): Promise<string> {
  if (process.stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

async function resolveText(flags: Flags): Promise<string> {
  if (typeof flags.text === 'string') return flags.text;
  const stdin = (await readStdinText()).replace(/\n$/, '');
  if (!stdin) throw new Error('--text is required (or pipe text on stdin)');
  return stdin;
}

type SendOpts = { parseMode?: 'HTML' | 'MarkdownV2'; disableLinkPreview?: boolean; buttons?: { text: string; url: string }[][] };

function readTelegramOpts(flags: Flags): SendOpts {
  const opts: SendOpts = {};
  if (flags['parse-mode']) {
    const v = String(flags['parse-mode']);
    if (v !== 'HTML' && v !== 'MarkdownV2') throw new Error("--parse-mode must be 'HTML' or 'MarkdownV2'");
    opts.parseMode = v;
  }
  if (flags['no-link-preview']) opts.disableLinkPreview = true;
  if (flags['buttons-json']) opts.buttons = JSON.parse(String(flags['buttons-json']));
  return opts;
}

function maskToken(token: string): string {
  if (!token) return '';
  if (token.length <= 8) return '••••';
  return `${token.slice(0, 6)}…${token.slice(-2)}`;
}

const EXT_FROM_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

// Path to the SKILL.md bundled with the npm package. dist/cli.js → ../skills/metro/SKILL.md.
const BUNDLED_SKILL = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'metro', 'SKILL.md');
const SKILL_RUNTIMES: SkillRuntime[] = ['claude-code', 'codex'];
const SKILL_SCOPES = ['user', 'project'] as const;
type SkillScope = typeof SKILL_SCOPES[number];
const skillFile = (runtime: SkillRuntime, scope: SkillScope): string => join(skillDir(runtime, scope), 'SKILL.md');

// ---------------- setup ----------------------------------------------------

const TOKEN_KEYS = { telegram: 'TELEGRAM_BOT_TOKEN', discord: 'DISCORD_BOT_TOKEN' } as const;

async function cmdSetup(positional: string[], flags: Flags): Promise<void> {
  const [sub, value] = positional;

  if (!sub) return cmdSetupStatus(flags);

  if (sub === 'telegram' || sub === 'discord') {
    if (!value) throw new Error(`metro setup ${sub} <token> — token is required`);
    const trimmed = value.trim();
    let identity: string | undefined;
    if (!flags['no-validate']) {
      // Validate against the platform before persisting — catches typos /
      // wrong-token-from-portal / rotated tokens at the earliest moment.
      process.env[TOKEN_KEYS[sub]] = trimmed;
      try {
        identity = sub === 'telegram'
          ? `@${(await telegram.getMe()).username}`
          : (await discord.getMe()).username;
      } catch (err) {
        delete process.env[TOKEN_KEYS[sub]];
        throw exitErr(`token rejected by ${sub}: ${errMsg(err)} (re-run with --no-validate to save anyway)`, 3);
      }
    }
    const env = readDotenv(CONFIG_ENV_FILE);
    env[TOKEN_KEYS[sub]] = trimmed;
    writeDotenv(CONFIG_ENV_FILE, env);
    const human = identity
      ? `saved ${TOKEN_KEYS[sub]} (verified as ${identity}) to ${CONFIG_ENV_FILE} (chmod 0600)`
      : `saved ${TOKEN_KEYS[sub]} to ${CONFIG_ENV_FILE} (chmod 0600)`;
    emitResult(flags, human, { ok: true, saved: TOKEN_KEYS[sub], path: CONFIG_ENV_FILE, verified_as: identity ?? null });
    return;
  }

  if (sub === 'clear') {
    const target = value ?? 'all';
    const env = readDotenv(CONFIG_ENV_FILE);
    if (target === 'all') {
      delete env.TELEGRAM_BOT_TOKEN;
      delete env.DISCORD_BOT_TOKEN;
    } else if (target === 'telegram' || target === 'discord') {
      delete env[TOKEN_KEYS[target]];
    } else {
      throw new Error(`metro setup clear <telegram|discord|all> — got '${target}'`);
    }
    writeDotenv(CONFIG_ENV_FILE, env);
    const human = `cleared ${target === 'all' ? 'all metro tokens' : TOKEN_KEYS[target as 'telegram' | 'discord']} from ${CONFIG_ENV_FILE}`;
    emitResult(flags, human, { ok: true, cleared: target, path: CONFIG_ENV_FILE });
    return;
  }

  if (sub === 'skill') return cmdSetupSkill(flags);

  throw new Error(`unknown setup subcommand '${sub}' (try: telegram, discord, clear, skill)`);
}

type SkillState = Record<SkillRuntime, Record<SkillScope, boolean>>;

function readSkillState(): SkillState {
  return Object.fromEntries(
    SKILL_RUNTIMES.map(r => [r, Object.fromEntries(SKILL_SCOPES.map(s => [s, existsSync(skillFile(r, s))]))]),
  ) as SkillState;
}

async function cmdSetupStatus(flags: Flags): Promise<void> {
  loadMetroEnv();
  const tg = process.env.TELEGRAM_BOT_TOKEN ?? '';
  const dc = process.env.DISCORD_BOT_TOKEN ?? '';
  const skills = readSkillState();
  const anySkill = SKILL_RUNTIMES.some(r => SKILL_SCOPES.some(s => skills[r][s]));

  if (isJson(flags)) {
    process.stdout.write(JSON.stringify({
      version: pkg.version,
      config_env_file: CONFIG_ENV_FILE,
      tokens: {
        telegram: { set: !!tg, masked: maskToken(tg) },
        discord: { set: !!dc, masked: maskToken(dc) },
      },
      skills,
    }) + '\n');
    return;
  }

  const fmtSkill = (s: Record<SkillScope, boolean>): string => {
    const set = SKILL_SCOPES.filter(k => s[k]);
    return set.length ? `installed (${set.join(' + ')})` : 'not installed';
  };

  process.stdout.write(
    `metro ${pkg.version}\n\n` +
      `config:  ${CONFIG_ENV_FILE}${existsSync(CONFIG_ENV_FILE) ? '' : ' (not yet written)'}\n\n` +
      `  TELEGRAM_BOT_TOKEN  ${tg ? `set (${maskToken(tg)})` : 'not set'}\n` +
      `  DISCORD_BOT_TOKEN   ${dc ? `set (${maskToken(dc)})` : 'not set'}\n\n` +
      'Skills:\n' +
      `  claude-code  ${fmtSkill(skills['claude-code'])}\n` +
      `  codex        ${fmtSkill(skills.codex)}\n\n`,
  );

  if (!tg && !dc) {
    process.stdout.write(
      'Get started:\n' +
        '  1. metro setup telegram <token>     # https://t.me/BotFather\n' +
        '     metro setup discord  <token>    # https://discord.com/developers/applications\n' +
        '  2. metro setup skill                # auto-onboard your agent (writes to both runtimes)\n' +
        '  3. metro doctor                     # verify everything works\n' +
        '  4. metro                            # start the inbound stream\n',
    );
  } else if (!anySkill) {
    process.stdout.write('Next: `metro setup skill` to auto-onboard your agent. Then `metro doctor`, then `metro`.\n');
  } else {
    process.stdout.write('Run `metro` to start the inbound stream, or `metro doctor` to verify.\n');
  }
}

async function cmdSetupSkill(flags: Flags): Promise<void> {
  const scope: SkillScope = flags.project ? 'project' : 'user';
  if (flags.clear) {
    const removed: string[] = [];
    for (const runtime of SKILL_RUNTIMES) {
      const dir = skillDir(runtime, scope);
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
        removed.push(dir);
      }
    }
    emitResult(flags, removed.length ? `removed:\n  ${removed.join('\n  ')}` : '(no skills installed at this scope)', { ok: true, cleared: removed });
    return;
  }
  if (!existsSync(BUNDLED_SKILL)) throw new Error(`bundled SKILL.md missing at ${BUNDLED_SKILL} (broken install?)`);
  const written = SKILL_RUNTIMES.map(r => {
    const dest = skillFile(r, scope);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(BUNDLED_SKILL, dest);
    return dest;
  });
  emitResult(
    flags,
    `wrote skill (${scope}) to:\n  ${written.join('\n  ')}\n\nThe agent will pick it up on its next session start.`,
    { ok: true, scope, paths: written },
  );
}

// ---------------- doctor ---------------------------------------------------

type DoctorCheck = { name: string; ok: boolean | null; detail: string };

async function cmdDoctor(flags: Flags): Promise<void> {
  loadMetroEnv();
  const checks: DoctorCheck[] = [];

  // tokens
  const cfg = configuredPlatforms();
  checks.push({
    name: 'tokens',
    ok: cfg.telegram || cfg.discord,
    detail: cfg.telegram || cfg.discord
      ? `loaded from ${existsSync(CONFIG_ENV_FILE) ? CONFIG_ENV_FILE : 'process env'}`
      : 'no platform configured — run `metro setup telegram|discord <token>`',
  });

  // gateway / API healthcheck per configured platform
  for (const [platform, getMe] of [['telegram', telegram.getMe], ['discord', discord.getMe]] as const) {
    if (!cfg[platform]) {
      checks.push({ name: platform, ok: null, detail: 'not configured' });
      continue;
    }
    try {
      const me = await getMe();
      checks.push({ name: platform, ok: true, detail: `getMe → ${platform === 'telegram' ? '@' : ''}${me.username}` });
    } catch (err) {
      checks.push({ name: platform, ok: false, detail: errMsg(err) });
    }
  }

  // tail process state. A stale lockfile (process gone) is informational —
  // the next `metro` start auto-reclaims it, so we don't fail the doctor on it.
  const lockFile = join(STATE_DIR, '.tail-lock');
  if (!existsSync(lockFile)) {
    checks.push({ name: 'stream', ok: null, detail: 'not running' });
  } else {
    try {
      const pid = Number(readFileSync(lockFile, 'utf8').trim());
      if (!Number.isInteger(pid) || pid <= 0) throw new Error('invalid pid');
      process.kill(pid, 0);
      checks.push({ name: 'stream', ok: true, detail: `running (pid ${pid})` });
    } catch {
      checks.push({ name: 'stream', ok: null, detail: 'stale lockfile (will auto-reclaim on next start)' });
    }
  }

  // skill install + freshness vs bundled
  for (const runtime of SKILL_RUNTIMES) {
    const present = SKILL_SCOPES.filter(s => existsSync(skillFile(runtime, s)));
    if (present.length === 0) {
      checks.push({ name: `skill: ${runtime}`, ok: null, detail: 'not installed — run `metro setup skill` (writes both runtimes)' });
      continue;
    }
    const bundled = existsSync(BUNDLED_SKILL) ? readFileSync(BUNDLED_SKILL) : null;
    const stale = bundled
      ? present.filter(s => !readFileSync(skillFile(runtime, s)).equals(bundled))
      : [];
    checks.push(
      stale.length === 0
        ? { name: `skill: ${runtime}`, ok: true, detail: present.join(' + ') }
        : { name: `skill: ${runtime}`, ok: false, detail: `stale at ${stale.join(' + ')} — re-run \`metro setup skill${stale.includes('project') ? ' --project' : ''}\`` },
    );
  }

  if (isJson(flags)) {
    process.stdout.write(JSON.stringify({ checks }) + '\n');
  } else {
    process.stdout.write('metro doctor\n\n');
    for (const c of checks) {
      const icon = c.ok === true ? '✓' : c.ok === false ? '✗' : '–';
      process.stdout.write(`  ${icon} ${c.name.padEnd(20)} ${c.detail}\n`);
    }
    process.stdout.write('\n');
  }

  if (checks.some(c => c.ok === false)) throw exitErr('one or more checks failed', 3);
}

// ---------------- update ---------------------------------------------------

async function cmdUpdate(flags: Flags): Promise<void> {
  // While metro is in prerelease, the @beta dist-tag is what we publish.
  // After GA, swap to 'latest' (or auto-pick from current version's prerelease tag).
  const tag = pkg.version.includes('-') ? 'beta' : 'latest';
  const res = await fetch('https://registry.npmjs.org/@stage-labs/metro', { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`npm registry: ${res.status}`);
  const data = (await res.json()) as { 'dist-tags'?: Record<string, string> };
  const latest = data['dist-tags']?.[tag];
  if (!latest) throw new Error(`no '${tag}' dist-tag for @stage-labs/metro`);
  if (latest === pkg.version) {
    emitResult(flags, `already on ${pkg.version} (latest ${tag})`, { ok: true, current: pkg.version, latest, upgraded: false });
    return;
  }

  const argv1 = process.argv[1] ?? '';
  const spec = `@stage-labs/metro@${tag}`;
  const argv = argv1.includes('/.bun/') || argv1.includes('\\bun\\') ? ['bun', 'add', '-g', spec]
    : argv1.includes('/pnpm/') || argv1.includes('\\pnpm\\') ? ['pnpm', 'add', '-g', spec]
    : ['npm', 'install', '-g', spec];

  if (isJson(flags)) {
    process.stdout.write(JSON.stringify({ ok: true, current: pkg.version, latest, command: argv.join(' '), upgraded: 'pending' }) + '\n');
  } else {
    process.stdout.write(`metro ${pkg.version} → ${latest}\n$ ${argv.join(' ')}\n`);
  }

  // Snapshot which skill destinations are installed BEFORE the package
  // manager replaces our binary — after the spawn, BUNDLED_SKILL on disk
  // points at the new content (npm install -g overwrites in place), so a
  // fresh copyFileSync picks it up automatically.
  const refreshTargets = SKILL_RUNTIMES.flatMap(r =>
    SKILL_SCOPES.filter(s => existsSync(skillFile(r, s))).map(s => skillFile(r, s)),
  );

  await new Promise<void>((resolve, reject) => {
    const child = spawn(argv[0], argv.slice(1), { stdio: isJson(flags) ? 'ignore' : 'inherit' });
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`${argv[0]} exited with code ${code}`))));
    child.on('error', reject);
  });

  // Refresh installed skills from the (now-updated) bundled SKILL.md.
  if (existsSync(BUNDLED_SKILL)) {
    for (const dest of refreshTargets) {
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(BUNDLED_SKILL, dest);
    }
    if (refreshTargets.length > 0 && !isJson(flags)) {
      process.stdout.write(`\nrefreshed installed skills:\n  ${refreshTargets.join('\n  ')}\n`);
    }
  }
}

// ---------------- inbound action commands ----------------------------------

async function cmdSend(flags: Flags): Promise<void> {
  const addr = resolveAddr(flags, false);
  const text = await resolveText(flags);
  const sentMessageId = addr.platform === 'telegram'
    ? String((await tg<{ message_id: number }>('sendMessage', buildSendBody(addr.chat, text, readTelegramOpts(flags)))).message_id)
    : await discord.sendMessage(addr.chat, text);
  emitResult(flags, 'sent', { ok: true, platform: addr.platform, to: String(flags.to), sent_message_id: sentMessageId });
}

async function cmdReply(flags: Flags): Promise<void> {
  const addr = resolveAddr(flags, true);
  const text = await resolveText(flags);
  let sentMessageId: string;
  if (addr.platform === 'telegram') {
    const body = buildSendBody(addr.chat, text, readTelegramOpts(flags));
    body.reply_parameters = { message_id: tgMessageId(addr), allow_sending_without_reply: true };
    sentMessageId = String((await tg<{ message_id: number }>('sendMessage', body)).message_id);
  } else {
    sentMessageId = await discord.replyToMessage(addr.chat, addr.messageId!, text);
  }
  signalReplyComplete(addr.platform, addr.chat);
  await clearReaction(addr).catch(err => log.warn({ err: errMsg(err) }, 'clear-reaction failed'));
  emitResult(flags, 'sent', { ok: true, platform: addr.platform, to: String(flags.to), sent_message_id: sentMessageId });
}

async function cmdReact(flags: Flags): Promise<void> {
  const addr = resolveAddr(flags, true);
  const emoji = typeof flags.emoji === 'string' ? flags.emoji : '';
  if (addr.platform === 'telegram') {
    await tg('setMessageReaction', { chat_id: addr.chat, message_id: tgMessageId(addr), reaction: emoji ? [{ type: 'emoji', emoji }] : [] });
  } else {
    await discord.setReaction(addr.chat, addr.messageId!, emoji);
  }
  emitResult(flags, emoji ? 'reacted' : 'cleared', { ok: true, to: String(flags.to), emoji, action: emoji ? 'reacted' : 'cleared' });
}

async function cmdEdit(flags: Flags): Promise<void> {
  const addr = resolveAddr(flags, true);
  const text = await resolveText(flags);
  if (addr.platform === 'telegram') {
    const body = buildSendBody(addr.chat, text, readTelegramOpts(flags));
    body.message_id = tgMessageId(addr);
    await tg('editMessageText', body);
  } else {
    await discord.editMessage(addr.chat, addr.messageId!, text);
  }
  emitResult(flags, 'edited', { ok: true, to: String(flags.to) });
}

async function cmdDownload(flags: Flags): Promise<void> {
  const addr = resolveAddr(flags, true);
  const outDir = typeof flags.out === 'string' ? flags.out : join(STATE_DIR, 'attachments');
  mkdirSync(outDir, { recursive: true });

  const images = addr.platform === 'telegram'
    ? await Promise.all(telegram.getCachedAttachments(addr.chat, tgMessageId(addr)).map(a => telegram.downloadAttachment(a.file_id, a.mime)))
    : await discord.fetchAttachments(addr.chat, addr.messageId!);

  if (images.length === 0) {
    if (isJson(flags)) process.stdout.write(JSON.stringify({ ok: true, images: [] }) + '\n');
    else process.stderr.write('no image attachments found\n');
    return;
  }

  const safeChat = addr.chat.replace(/[^\w-]/g, '_');
  const safeMsg = (addr.messageId ?? '').replace(/[^\w-]/g, '_');
  const out = images.map((img, i) => {
    const ext = EXT_FROM_MIME[img.mime] ?? 'bin';
    const path = join(outDir, `${addr.platform}_${safeChat}_${safeMsg}_${i}.${ext}`);
    writeFileSync(path, Buffer.from(img.data, 'base64'));
    return { path, mime: img.mime };
  });
  if (isJson(flags)) process.stdout.write(JSON.stringify({ ok: true, images: out }) + '\n');
  else process.stdout.write(out.map(o => o.path).join('\n') + '\n');
}

async function cmdFetch(flags: Flags): Promise<void> {
  const addr = resolveAddr(flags, false);
  if (addr.platform !== 'discord') {
    throw new Error('metro fetch is Discord-only — Telegram has no recent-messages API for bots');
  }
  const limit = Number(flags.limit ?? 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('--limit must be an integer 1–100');
  const msgs = await discord.fetchRecentMessages(addr.chat, limit);
  if (isJson(flags)) {
    process.stdout.write(JSON.stringify(msgs) + '\n');
  } else {
    const text = msgs.map(m => `[message_id=${m.message_id} ${m.timestamp}] ${m.author}: ${m.text}`).join('\n');
    process.stdout.write((text || '(channel is empty)') + '\n');
  }
}

// ---------------- main dispatcher ------------------------------------------

const COMMANDS: Record<string, (positional: string[], flags: Flags) => Promise<void>> = {
  setup: (positional, flags) => cmdSetup(positional, flags),
  doctor: (_, flags) => cmdDoctor(flags),
  update: (_, flags) => cmdUpdate(flags),
  reply: (_, flags) => cmdReply(flags),
  react: (_, flags) => cmdReact(flags),
  edit: (_, flags) => cmdEdit(flags),
  send: (_, flags) => cmdSend(flags),
  download: (_, flags) => cmdDownload(flags),
  fetch: (_, flags) => cmdFetch(flags),
};
const NEEDS_ENV = new Set(['doctor', 'reply', 'react', 'edit', 'send', 'download', 'fetch']);

async function main(): Promise<void> {
  const cmd = process.argv[2];
  if (cmd === '--version' || cmd === '-v') { process.stdout.write(`${pkg.version}\n`); return; }
  if (cmd === '--help' || cmd === '-h') { process.stdout.write(USAGE); return; }

  // Bare `metro` runs the inbound stream — the primary action; one-shot
  // subcommands are the secondary surface (matches claude / redis-server /
  // nginx convention where the daemon's the default).
  if (!cmd) { await import('./tail.js'); return; }

  const handler = COMMANDS[cmd];
  if (!handler) {
    process.stderr.write(`unknown command '${cmd}'\n\n${USAGE}`);
    process.exit(1);
  }

  const { positional, flags } = parseArgs(process.argv.slice(3));
  if (NEEDS_ENV.has(cmd)) loadMetroEnv();
  try {
    await handler(positional, flags);
  } catch (err) {
    const code = (err as ExitErr).code;
    if (isJson(flags)) {
      process.stdout.write(JSON.stringify({ ok: false, error: errMsg(err), code: code ?? 1 }) + '\n');
    } else {
      process.stderr.write(`error: ${errMsg(err)}\n`);
    }
    process.exit(typeof code === 'number' ? code : 1);
  }
}

await main();
