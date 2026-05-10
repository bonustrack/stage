#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pkg from '../package.json' with { type: 'json' };
import * as discord from './channels/discord.js';
import * as telegram from './channels/telegram.js';
import { buildSendBody, tg } from './channels/telegram.js';
import { CONFIG_DIR, CONFIG_ENV_FILE, configuredPlatforms, loadMetroEnv, STATE_DIR } from './config.js';
import { errMsg, log } from './log.js';

const USAGE = `metro — Telegram + Discord bridge for your agent

Usage:
  metro [tail]
      Long-running inbound stream (the default — bare \`metro\` is an alias
      for \`metro tail\`). Polls Telegram and connects to Discord's gateway,
      then prints one JSON line per inbound message on stdout:
        {"platform":"telegram"|"discord","to":"<platform>:<chat>/<msg>","text":"…"}
      Run in the background; the agent monitors stdout and acts on each line.

  metro reply    --to=<addr> [--text=<t>] [--parse-mode=HTML|MarkdownV2]
                 [--no-link-preview] [--buttons-json=<json>]
      Quote-reply, threading under the original. Clears the 👀 auto-ack.
      Reads --text from stdin if the flag is omitted (heredoc-friendly).

  metro react    --to=<addr> --emoji=<e>
      Set or clear ('') a reaction. Telegram bot whitelist:
        👍 ❤️ 🔥 🥰 👏 😁 🤔 🎉 🙏 👌 💯 🤣 …

  metro edit     --to=<addr> [--text=<t>]
      Edit a message the bot previously sent. Telegram-only flags as on reply.

  metro download --to=<addr> [--out=<dir>]
      Download image attachments. Writes to <dir> (default
      \`$METRO_STATE_DIR/attachments\`) and prints one absolute path per line.

  metro fetch    --to=<addr> [--limit=N]
      Recent-message lookback. Discord only — pass channel-only
      \`discord:<channel_id>\`. 1 ≤ N ≤ 100, default 10.

  metro setup [telegram|discord <token> | clear [telegram|discord|all]]
      No args: print which tokens are configured (masked) and where the
      .env lives. With \`telegram <token>\` or \`discord <token>\`: write the
      token to \`$METRO_CONFIG_DIR/.env\` (chmod 0600). With \`clear …\`:
      remove tokens from that file.

  metro update
      Check the npm registry for a newer release and run the matching
      global-install command (npm / bun / pnpm — auto-detected from the
      binary's install path).

Address format:
  telegram:<chat_id>/<message_id>      e.g. telegram:-100123456789/4567
  discord:<channel_id>/<message_id>    e.g. discord:1234567890/9876543210
  discord:<channel_id>                 fetch only (no message id)

Common flags:
  --version, -v       print the metro version and exit
  --help, -h          print this help and exit

Tokens (env or ./.env): TELEGRAM_BOT_TOKEN, DISCORD_BOT_TOKEN.
Configure at least one.
`;

function readDotenv(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_]\w*)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

function writeDotenv(path: string, env: Record<string, string>): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  const body = Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
  writeFileSync(path, body);
  chmodSync(path, 0o600);
}

function maskToken(token: string): string {
  if (!token) return '';
  if (token.length <= 8) return '••••';
  return `${token.slice(0, 6)}…${token.slice(-2)}`;
}

async function cmdSetup(positional: string[]): Promise<void> {
  const [sub, value] = positional;
  const tokenKeys: Record<'telegram' | 'discord', string> = {
    telegram: 'TELEGRAM_BOT_TOKEN',
    discord: 'DISCORD_BOT_TOKEN',
  };

  if (!sub) {
    loadMetroEnv();
    const tg = process.env.TELEGRAM_BOT_TOKEN ?? '';
    const dc = process.env.DISCORD_BOT_TOKEN ?? '';
    process.stdout.write(
      `metro ${pkg.version}\n\n` +
        `config:  ${CONFIG_ENV_FILE}${existsSync(CONFIG_ENV_FILE) ? '' : ' (not yet written)'}\n\n` +
        `  TELEGRAM_BOT_TOKEN  ${tg ? `set (${maskToken(tg)})` : 'not set'}\n` +
        `  DISCORD_BOT_TOKEN   ${dc ? `set (${maskToken(dc)})` : 'not set'}\n\n`,
    );
    if (!tg && !dc) {
      process.stdout.write(
        'Save a token with one of:\n' +
          '  metro setup telegram <token>     # from https://t.me/BotFather\n' +
          '  metro setup discord <token>      # from https://discord.com/developers/applications\n',
      );
    } else {
      process.stdout.write('Run `metro` to start the inbound stream.\n');
    }
    return;
  }

  if (sub === 'telegram' || sub === 'discord') {
    if (!value) throw new Error(`metro setup ${sub} <token> — token is required`);
    const env = readDotenv(CONFIG_ENV_FILE);
    env[tokenKeys[sub]] = value.trim();
    writeDotenv(CONFIG_ENV_FILE, env);
    process.stdout.write(`saved ${tokenKeys[sub]} to ${CONFIG_ENV_FILE} (chmod 0600)\n`);
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
    process.stdout.write(`cleared ${target === 'all' ? 'all metro tokens' : tokenKeys[target as 'telegram' | 'discord']} from ${CONFIG_ENV_FILE}\n`);
    return;
  }

  throw new Error(`unknown setup subcommand '${sub}' (try: telegram, discord, clear)`);
}

async function cmdUpdate(): Promise<void> {
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
    process.stdout.write(`already on ${pkg.version} (latest ${tag})\n`);
    return;
  }

  // Detect installer from the resolved binary path. argv[1] points at
  // dist/cli.js inside the install root, so the path tells us which
  // package manager owns this metro.
  const argv1 = process.argv[1] ?? '';
  const spec = `@stage-labs/metro@${tag}`;
  let argv: string[];
  if (argv1.includes('/.bun/') || argv1.includes('\\bun\\')) argv = ['bun', 'add', '-g', spec];
  else if (argv1.includes('/pnpm/') || argv1.includes('\\pnpm\\')) argv = ['pnpm', 'add', '-g', spec];
  else argv = ['npm', 'install', '-g', spec];

  process.stdout.write(`metro ${pkg.version} → ${latest}\n$ ${argv.join(' ')}\n`);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(argv[0], argv.slice(1), { stdio: 'inherit' });
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`${argv[0]} exited with code ${code}`))));
    child.on('error', reject);
  });
}

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

type Platform = 'telegram' | 'discord';
type Address = { platform: Platform; chat: string; messageId?: string };

function parseAddress(to: string, requireMessage: boolean): Address {
  const colon = to.indexOf(':');
  if (colon === -1) {
    throw new Error(`invalid --to (expected '<platform>:<chat>[/<message_id>]'): ${to}`);
  }
  const platform = to.slice(0, colon);
  if (platform !== 'telegram' && platform !== 'discord') {
    throw new Error(`unknown platform '${platform}' in --to (expected 'telegram' or 'discord')`);
  }
  const rest = to.slice(colon + 1);
  const slash = rest.indexOf('/');
  const chat = slash === -1 ? rest : rest.slice(0, slash);
  const messageId = slash === -1 ? undefined : rest.slice(slash + 1);
  if (!chat) throw new Error(`empty chat/channel id in --to: ${to}`);
  if (requireMessage && !messageId) throw new Error(`--to must include /<message_id>: ${to}`);
  return { platform, chat, messageId };
}

function requirePlatform(platform: Platform): void {
  const cfg = configuredPlatforms();
  if (!cfg[platform]) throw new Error(`platform '${platform}' is not configured (missing token)`);
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

const EXT_FROM_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

async function cmdReply(flags: Record<string, string | boolean>): Promise<void> {
  const addr = parseAddress(String(flags.to), true);
  requirePlatform(addr.platform);
  const text = await resolveText(flags);
  if (addr.platform === 'telegram') {
    const messageId = tgMessageId(addr);
    const body = buildSendBody(addr.chat, text, readTelegramOpts(flags));
    body.reply_parameters = { message_id: messageId, allow_sending_without_reply: true };
    await tg('sendMessage', body);
    signalReplyComplete('telegram', addr.chat);
    await tg('setMessageReaction', { chat_id: addr.chat, message_id: messageId, reaction: [] }).catch(err =>
      log.warn({ err: errMsg(err) }, 'telegram clear-reaction failed'),
    );
  } else {
    await discord.replyToMessage(addr.chat, addr.messageId!, text);
    signalReplyComplete('discord', addr.chat);
    await discord
      .setReaction(addr.chat, addr.messageId!, '')
      .catch(err => log.warn({ err: errMsg(err) }, 'discord clear-reaction failed'));
  }
  process.stdout.write('sent\n');
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
  process.stdout.write(emoji ? 'reacted\n' : 'cleared\n');
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
  process.stdout.write('edited\n');
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
    process.stderr.write('no image attachments found\n');
    return;
  }

  const safeChat = addr.chat.replace(/[^\w-]/g, '_');
  const safeMsg = (addr.messageId ?? '').replace(/[^\w-]/g, '_');
  const paths: string[] = [];
  for (let i = 0; i < images.length; i++) {
    const ext = EXT_FROM_MIME[images[i].mime] ?? 'bin';
    const path = join(outDir, `${addr.platform}_${safeChat}_${safeMsg}_${i}.${ext}`);
    writeFileSync(path, Buffer.from(images[i].data, 'base64'));
    paths.push(path);
  }
  process.stdout.write(paths.join('\n') + '\n');
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
  const text = msgs
    .map(m => `[message_id=${m.message_id} ${m.timestamp}] ${m.author}: ${m.text}`)
    .join('\n');
  process.stdout.write((text || '(channel is empty)') + '\n');
}

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
    // setup is special: it manages tokens, so it doesn't need them loaded.
    if (cmd === 'setup') return await cmdSetup(positional);
    if (cmd === 'update') return await cmdUpdate();

    loadMetroEnv();
    if (cmd === 'reply') return await cmdReply(flags);
    if (cmd === 'react') return await cmdReact(flags);
    if (cmd === 'edit') return await cmdEdit(flags);
    if (cmd === 'download') return await cmdDownload(flags);
    if (cmd === 'fetch') return await cmdFetch(flags);
    process.stderr.write(`unknown command '${cmd}'\n\n${USAGE}`);
    process.exit(1);
  } catch (err) {
    process.stderr.write(`error: ${errMsg(err)}\n`);
    process.exit(1);
  }
}

await main();
