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
  metro [tail]                                Inbound stream (bare \`metro\` is an alias for tail).
  metro setup […]                             Manage tokens and the agent skill (see below).
  metro doctor                                Health check across tokens, gateways, and skills.
  metro reply    --to=<addr> [--text=<t>]     Quote-reply, threading under the original. Clears 👀.
  metro react    --to=<addr> --emoji=<e>      Set or clear ('') a reaction.
  metro edit     --to=<addr> [--text=<t>]     Edit a message the bot previously sent.
  metro download --to=<addr> [--out=<dir>]    Download image attachments to disk.
  metro fetch    --to=<addr> [--limit=N]      Recent-message lookback (Discord only).
  metro update                                Upgrade in place (npm/bun/pnpm auto-detected).

setup verbs:
  metro setup                                 Status: tokens, skills, what's next.
  metro setup telegram <token>                Save TELEGRAM_BOT_TOKEN.
  metro setup discord  <token>                Save DISCORD_BOT_TOKEN.
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

// ---------------- arg parser & --json helper -------------------------------

function parseArgs(argv: string[]): { positional: string[]; flags: Record<string, string | boolean> } {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
        continue;
      }
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

function isJson(flags: Record<string, string | boolean>): boolean {
  return flags.json === true;
}

function emitResult(flags: Record<string, string | boolean>, human: string, structured: unknown): void {
  process.stdout.write(isJson(flags) ? JSON.stringify(structured) + '\n' : human + '\n');
}

// ---------------- shared helpers -------------------------------------------

function requirePlatform(platform: Platform): void {
  const cfg = configuredPlatforms();
  if (!cfg[platform]) {
    const err = new Error(`platform '${platform}' is not configured (missing token)`);
    (err as Error & { code?: number }).code = 2;
    throw err;
  }
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

async function readStdinText(): Promise<string> {
  if (process.stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

async function resolveText(flags: Record<string, string | boolean>): Promise<string> {
  const t = flags.text;
  if (typeof t === 'string') return t;
  const stdin = (await readStdinText()).replace(/\n$/, '');
  if (!stdin) throw new Error('--text is required (or pipe text on stdin)');
  return stdin;
}

type SendOpts = { parseMode?: 'HTML' | 'MarkdownV2'; disableLinkPreview?: boolean; buttons?: { text: string; url: string }[][] };

function readTelegramOpts(flags: Record<string, string | boolean>): SendOpts {
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

// ---------------- setup ----------------------------------------------------

async function cmdSetup(positional: string[], flags: Record<string, string | boolean>): Promise<void> {
  const [sub, value] = positional;
  const tokenKeys: Record<'telegram' | 'discord', string> = {
    telegram: 'TELEGRAM_BOT_TOKEN',
    discord: 'DISCORD_BOT_TOKEN',
  };

  if (!sub) {
    return cmdSetupStatus(flags);
  }

  if (sub === 'telegram' || sub === 'discord') {
    if (!value) throw new Error(`metro setup ${sub} <token> — token is required`);
    const env = readDotenv(CONFIG_ENV_FILE);
    env[tokenKeys[sub]] = value.trim();
    writeDotenv(CONFIG_ENV_FILE, env);
    emitResult(flags, `saved ${tokenKeys[sub]} to ${CONFIG_ENV_FILE} (chmod 0600)`, {
      ok: true,
      saved: tokenKeys[sub],
      path: CONFIG_ENV_FILE,
    });
    return;
  }

  if (sub === 'clear') {
    const target = value ?? 'all';
    const env = readDotenv(CONFIG_ENV_FILE);
    if (target === 'all') {
      delete env.TELEGRAM_BOT_TOKEN;
      delete env.DISCORD_BOT_TOKEN;
    } else if (target === 'telegram' || target === 'discord') {
      delete env[tokenKeys[target]];
    } else {
      throw new Error(`metro setup clear <telegram|discord|all> — got '${target}'`);
    }
    writeDotenv(CONFIG_ENV_FILE, env);
    const human = `cleared ${target === 'all' ? 'all metro tokens' : tokenKeys[target as 'telegram' | 'discord']} from ${CONFIG_ENV_FILE}`;
    emitResult(flags, human, { ok: true, cleared: target, path: CONFIG_ENV_FILE });
    return;
  }

  if (sub === 'skill') {
    return cmdSetupSkill(flags);
  }

  throw new Error(`unknown setup subcommand '${sub}' (try: telegram, discord, clear, skill)`);
}

async function cmdSetupStatus(flags: Record<string, string | boolean>): Promise<void> {
  loadMetroEnv();
  const tg = process.env.TELEGRAM_BOT_TOKEN ?? '';
  const dc = process.env.DISCORD_BOT_TOKEN ?? '';
  const skills: Record<SkillRuntime, { user: boolean; project: boolean }> = {
    'claude-code': { user: skillExistsAt(skillDir('claude-code', 'user')), project: skillExistsAt(skillDir('claude-code', 'project')) },
    codex: { user: skillExistsAt(skillDir('codex', 'user')), project: skillExistsAt(skillDir('codex', 'project')) },
  };

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

  const fmtSkill = (s: { user: boolean; project: boolean }): string => {
    if (s.user && s.project) return 'installed (user + project)';
    if (s.user) return 'installed (user)';
    if (s.project) return 'installed (project)';
    return 'not installed';
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
  } else if (!skills['claude-code'].user && !skills['claude-code'].project && !skills.codex.user && !skills.codex.project) {
    process.stdout.write('Next: `metro setup skill` to auto-onboard your agent. Then `metro doctor`, then `metro`.\n');
  } else {
    process.stdout.write('Run `metro` to start the inbound stream, or `metro doctor` to verify.\n');
  }
}

function skillExistsAt(dir: string): boolean {
  return existsSync(join(dir, 'SKILL.md'));
}

async function cmdSetupSkill(flags: Record<string, string | boolean>): Promise<void> {
  const scope: 'user' | 'project' = flags.project ? 'project' : 'user';
  if (flags.clear) {
    const removed: string[] = [];
    for (const runtime of SKILL_RUNTIMES) {
      const dir = skillDir(runtime, scope);
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
        removed.push(dir);
      }
    }
    emitResult(flags, removed.length ? `removed:\n  ${removed.join('\n  ')}` : '(no skills installed at this scope)', {
      ok: true,
      cleared: removed,
    });
    return;
  }

  if (!existsSync(BUNDLED_SKILL)) {
    throw new Error(`bundled SKILL.md missing at ${BUNDLED_SKILL} (broken install?)`);
  }
  const written: string[] = [];
  for (const runtime of SKILL_RUNTIMES) {
    const dir = skillDir(runtime, scope);
    mkdirSync(dir, { recursive: true });
    const dest = join(dir, 'SKILL.md');
    copyFileSync(BUNDLED_SKILL, dest);
    written.push(dest);
  }
  emitResult(
    flags,
    `wrote skill (${scope}) to:\n  ${written.join('\n  ')}\n\nThe agent will pick it up on its next session start.`,
    { ok: true, scope, paths: written },
  );
}

// ---------------- doctor ---------------------------------------------------

type DoctorCheck = { name: string; ok: boolean | null; detail: string };

async function cmdDoctor(flags: Record<string, string | boolean>): Promise<void> {
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
  if (cfg.telegram) {
    try {
      const me = await telegram.getMe();
      checks.push({ name: 'telegram', ok: true, detail: `getMe → @${me.username}` });
    } catch (err) {
      checks.push({ name: 'telegram', ok: false, detail: errMsg(err) });
    }
  } else {
    checks.push({ name: 'telegram', ok: null, detail: 'not configured' });
  }
  if (cfg.discord) {
    try {
      const me = await discord.getMe();
      checks.push({ name: 'discord', ok: true, detail: `getMe → ${me.username}` });
    } catch (err) {
      checks.push({ name: 'discord', ok: false, detail: errMsg(err) });
    }
  } else {
    checks.push({ name: 'discord', ok: null, detail: 'not configured' });
  }

  // tail process state
  checks.push(tailStateCheck());

  // skill install
  for (const runtime of SKILL_RUNTIMES) {
    const user = skillExistsAt(skillDir(runtime, 'user'));
    const project = skillExistsAt(skillDir(runtime, 'project'));
    checks.push({
      name: `skill: ${runtime}`,
      ok: user || project ? true : null,
      detail: user || project
        ? [user && 'user', project && 'project'].filter(Boolean).join(' + ')
        : `not installed — run \`metro setup skill${runtime === 'codex' ? '  # writes both runtimes' : ''}\``,
    });
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

  if (checks.some(c => c.ok === false)) {
    const err = new Error('one or more checks failed');
    (err as Error & { code?: number }).code = 3;
    throw err;
  }
}

function tailStateCheck(): DoctorCheck {
  const lockFile = join(STATE_DIR, '.tail-lock');
  if (!existsSync(lockFile)) return { name: 'tail', ok: null, detail: 'not running' };
  try {
    const pid = Number(readFileSync(lockFile, 'utf8').trim());
    if (!Number.isInteger(pid) || pid <= 0) return { name: 'tail', ok: false, detail: 'stale lockfile' };
    process.kill(pid, 0);
    return { name: 'tail', ok: true, detail: `running (pid ${pid})` };
  } catch {
    return { name: 'tail', ok: false, detail: 'stale lockfile (process gone)' };
  }
}

// ---------------- update ---------------------------------------------------

async function cmdUpdate(flags: Record<string, string | boolean>): Promise<void> {
  // While metro is in prerelease, the @beta dist-tag is what we publish.
  // After GA, swap to 'latest' (or auto-pick from current version's prerelease tag).
  const tag = pkg.version.includes('-') ? 'beta' : 'latest';
  const res = await fetch('https://registry.npmjs.org/@stage-labs/metro', {
    signal: AbortSignal.timeout(15_000),
  });
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
  let argv: string[];
  if (argv1.includes('/.bun/') || argv1.includes('\\bun\\')) argv = ['bun', 'add', '-g', spec];
  else if (argv1.includes('/pnpm/') || argv1.includes('\\pnpm\\')) argv = ['pnpm', 'add', '-g', spec];
  else argv = ['npm', 'install', '-g', spec];

  if (isJson(flags)) {
    process.stdout.write(JSON.stringify({ ok: true, current: pkg.version, latest, command: argv.join(' '), upgraded: 'pending' }) + '\n');
  } else {
    process.stdout.write(`metro ${pkg.version} → ${latest}\n$ ${argv.join(' ')}\n`);
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(argv[0], argv.slice(1), { stdio: isJson(flags) ? 'ignore' : 'inherit' });
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`${argv[0]} exited with code ${code}`))));
    child.on('error', reject);
  });
}

// ---------------- inbound action commands ----------------------------------

async function cmdReply(flags: Record<string, string | boolean>): Promise<void> {
  const addr = parseAddress(String(flags.to), true);
  requirePlatform(addr.platform);
  const text = await resolveText(flags);
  let sentMessageId: string;
  if (addr.platform === 'telegram') {
    const messageId = tgMessageId(addr);
    const body = buildSendBody(addr.chat, text, readTelegramOpts(flags));
    body.reply_parameters = { message_id: messageId, allow_sending_without_reply: true };
    const sent = await tg<{ message_id: number }>('sendMessage', body);
    sentMessageId = String(sent.message_id);
    signalReplyComplete('telegram', addr.chat);
    await tg('setMessageReaction', { chat_id: addr.chat, message_id: messageId, reaction: [] }).catch(err =>
      log.warn({ err: errMsg(err) }, 'telegram clear-reaction failed'),
    );
  } else {
    sentMessageId = await discord.replyToMessage(addr.chat, addr.messageId!, text);
    signalReplyComplete('discord', addr.chat);
    await discord
      .setReaction(addr.chat, addr.messageId!, '')
      .catch(err => log.warn({ err: errMsg(err) }, 'discord clear-reaction failed'));
  }
  emitResult(flags, 'sent', {
    ok: true,
    platform: addr.platform,
    to: String(flags.to),
    sent_message_id: sentMessageId,
  });
}

async function cmdReact(flags: Record<string, string | boolean>): Promise<void> {
  const addr = parseAddress(String(flags.to), true);
  requirePlatform(addr.platform);
  const emoji = typeof flags.emoji === 'string' ? flags.emoji : '';
  if (addr.platform === 'telegram') {
    const messageId = tgMessageId(addr);
    const reaction = emoji ? [{ type: 'emoji', emoji }] : [];
    await tg('setMessageReaction', { chat_id: addr.chat, message_id: messageId, reaction });
  } else {
    await discord.setReaction(addr.chat, addr.messageId!, emoji);
  }
  emitResult(flags, emoji ? 'reacted' : 'cleared', {
    ok: true,
    to: String(flags.to),
    emoji,
    action: emoji ? 'reacted' : 'cleared',
  });
}

async function cmdEdit(flags: Record<string, string | boolean>): Promise<void> {
  const addr = parseAddress(String(flags.to), true);
  requirePlatform(addr.platform);
  const text = await resolveText(flags);
  if (addr.platform === 'telegram') {
    const messageId = tgMessageId(addr);
    const body = buildSendBody(addr.chat, text, readTelegramOpts(flags));
    body.message_id = messageId;
    await tg('editMessageText', body);
  } else {
    await discord.editMessage(addr.chat, addr.messageId!, text);
  }
  emitResult(flags, 'edited', { ok: true, to: String(flags.to) });
}

async function cmdDownload(flags: Record<string, string | boolean>): Promise<void> {
  const addr = parseAddress(String(flags.to), true);
  requirePlatform(addr.platform);
  const outDir = typeof flags.out === 'string' ? flags.out : join(STATE_DIR, 'attachments');
  mkdirSync(outDir, { recursive: true });

  let images: Array<{ data: string; mime: string }> = [];
  if (addr.platform === 'telegram') {
    const messageId = tgMessageId(addr);
    const cached = telegram.getCachedAttachments(addr.chat, messageId);
    images = await Promise.all(cached.map(a => telegram.downloadAttachment(a.file_id, a.mime)));
  } else {
    images = await discord.fetchAttachments(addr.chat, addr.messageId!);
  }
  if (images.length === 0) {
    if (isJson(flags)) {
      process.stdout.write(JSON.stringify({ ok: true, images: [] }) + '\n');
    } else {
      process.stderr.write('no image attachments found\n');
    }
    return;
  }

  const safeChat = addr.chat.replace(/[^\w-]/g, '_');
  const safeMsg = (addr.messageId ?? '').replace(/[^\w-]/g, '_');
  const out: Array<{ path: string; mime: string }> = [];
  for (let i = 0; i < images.length; i++) {
    const ext = EXT_FROM_MIME[images[i].mime] ?? 'bin';
    const path = join(outDir, `${addr.platform}_${safeChat}_${safeMsg}_${i}.${ext}`);
    writeFileSync(path, Buffer.from(images[i].data, 'base64'));
    out.push({ path, mime: images[i].mime });
  }
  if (isJson(flags)) {
    process.stdout.write(JSON.stringify({ ok: true, images: out }) + '\n');
  } else {
    process.stdout.write(out.map(o => o.path).join('\n') + '\n');
  }
}

async function cmdFetch(flags: Record<string, string | boolean>): Promise<void> {
  const addr = parseAddress(String(flags.to), false);
  requirePlatform(addr.platform);
  if (addr.platform !== 'discord') {
    throw new Error('metro fetch is Discord-only — Telegram has no recent-messages API for bots');
  }
  const limit = Number(flags.limit ?? 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('--limit must be an integer 1–100');
  const msgs = await discord.fetchRecentMessages(addr.chat, limit);
  if (isJson(flags)) {
    process.stdout.write(JSON.stringify(msgs) + '\n');
  } else {
    const text = msgs
      .map(m => `[message_id=${m.message_id} ${m.timestamp}] ${m.author}: ${m.text}`)
      .join('\n');
    process.stdout.write((text || '(channel is empty)') + '\n');
  }
}

// ---------------- main dispatcher ------------------------------------------

async function main(): Promise<void> {
  const cmd = process.argv[2];
  if (cmd === '--version' || cmd === '-v') {
    process.stdout.write(`${pkg.version}\n`);
    return;
  }
  if (cmd === '--help' || cmd === '-h') {
    process.stdout.write(USAGE);
    return;
  }

  // Bare `metro` is an alias for `metro tail` — the inbound stream is the
  // primary action; one-shot subcommands are the secondary surface.
  if (!cmd || cmd === 'tail') {
    await import('./tail.js');
    return;
  }

  const { positional, flags } = parseArgs(process.argv.slice(3));
  try {
    if (cmd === 'setup') return await cmdSetup(positional, flags);
    if (cmd === 'doctor') return await cmdDoctor(flags);
    if (cmd === 'update') return await cmdUpdate(flags);

    loadMetroEnv();
    if (cmd === 'reply') return await cmdReply(flags);
    if (cmd === 'react') return await cmdReact(flags);
    if (cmd === 'edit') return await cmdEdit(flags);
    if (cmd === 'download') return await cmdDownload(flags);
    if (cmd === 'fetch') return await cmdFetch(flags);
    process.stderr.write(`unknown command '${cmd}'\n\n${USAGE}`);
    process.exit(1);
  } catch (err) {
    const code = (err as Error & { code?: number }).code;
    if (isJson(flags)) {
      process.stdout.write(JSON.stringify({ ok: false, error: errMsg(err), code: code ?? 1 }) + '\n');
    } else {
      process.stderr.write(`error: ${errMsg(err)}\n`);
    }
    process.exit(typeof code === 'number' ? code : 1);
  }
}

await main();
