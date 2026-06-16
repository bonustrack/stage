#!/usr/bin/env bun
/**
 * Metro Channel - a Claude Code Channel MCP server.
 *
 * Bridges Metro's inbound chat stream into a running Claude Code session as
 * channel push events, exposes a `reply` tool for outbound (text + media), and
 * relays tool-approval permission prompts out via Metro so they can be answered
 * from a phone.
 *
 * Inbound source : Metro monitor SSE  GET /api/tail   (METRO_MONITOR_TOKEN gated)
 * Outbound sink  : Metro call  POST /api/call/<train>/<action>
 *
 * Spec: https://code.claude.com/docs/en/channels-reference
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { readFile, stat } from 'node:fs/promises'
import { readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// Read a single KEY=value from ~/.config/metro/.env. This is a fallback for env
// vars because Claude Code's env injection can race the ~/.claude.json rewrite
// at launch, transiently leaving METRO_MONITOR_TOKEN unset in process.env.
const envFileVar = (key: string): string => {
  try {
    const text = readFileSync(join(homedir(), '.config/metro/.env'), 'utf8')
    for (const raw of text.split('\n')) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq < 0) continue
      if (line.slice(0, eq).trim() !== key) continue
      let v = line.slice(eq + 1).trim()
      if (v.length >= 2 && ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'")))) {
        v = v.slice(1, -1)
      }
      return v
    }
  } catch { /* missing file = ignore */ }
  return ''
}

// --- Config (all via env, with ~/.config/metro/.env fallback) ----------------
const BASE = ((process.env.METRO_BASE_URL || envFileVar('METRO_BASE_URL')) || 'http://127.0.0.1:8420').replace(/\/$/, '')
const TOKEN = process.env.METRO_MONITOR_TOKEN || envFileVar('METRO_MONITOR_TOKEN')
// Comma-separated sender URIs or bare inbox/user ids that are allowed to drive
// the session. Default: Less's primary tony-account XMTP inbox. A `*` disables
// gating (NOT recommended - this is a prompt-injection surface).
const ALLOWLIST_DEFAULT = 'bee7314f7127ef53b4e3bf5256e54b0a1acdc3698d064fb1029bd8f83ecc1186'
const STATIONS_DEFAULT = 'xmtp,telegram,discord'
const parseAllowlist = (raw: string): string[] =>
  raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
const parseStations = (raw: string): Set<string> =>
  new Set(raw.split(',').map(s => s.trim()).filter(Boolean))

// --- Runtime config override -------------------------------------------------
// IMPORTANT: a running process's `process.env` is FIXED at spawn. Editing
// ~/.claude.json (where Claude Code injects these vars from) does NOT update an
// already-running server - so env/defaults below are only re-evaluated at launch.
// For the CURRENT change to ALLOWLIST/STATIONS you must still relaunch ONCE.
// AFTERWARDS, to change the allowlist/stations of a running server WITHOUT a
// relaunch, write ~/.config/metro/metro-channel.json, e.g.
//   { "allowlist": "*", "stations": "xmtp,telegram,discord" }
// Keys are optional; a missing key/file falls back to env then the defaults.
// The file is re-read only when its mtime changes (cheap stat per event).
const OVERRIDE_PATH = join(homedir(), '.config/metro/metro-channel.json')
let overrideMtime = -1
let overrideAllowlist: string[] | null = null
let overrideStations: Set<string> | null = null

const refreshOverride = (): void => {
  let mtime: number
  try {
    mtime = statSync(OVERRIDE_PATH).mtimeMs
  } catch {
    // file absent/inaccessible -> no override, fall back to env/defaults
    if (overrideMtime !== -1) { overrideMtime = -1; overrideAllowlist = null; overrideStations = null }
    return
  }
  if (mtime === overrideMtime) return
  overrideMtime = mtime
  overrideAllowlist = null
  overrideStations = null
  try {
    const cfg = JSON.parse(readFileSync(OVERRIDE_PATH, 'utf8')) as { allowlist?: string; stations?: string }
    if (typeof cfg.allowlist === 'string') overrideAllowlist = parseAllowlist(cfg.allowlist)
    if (typeof cfg.stations === 'string') overrideStations = parseStations(cfg.stations)
  } catch (e) {
    log('override file parse failed, ignoring', e)
  }
}

// Resolve effective config: override file (if present) wins, else env, else default.
const getAllowlist = (): string[] => {
  refreshOverride()
  if (overrideAllowlist) return overrideAllowlist
  return parseAllowlist(process.env.METRO_CHANNEL_ALLOWLIST ?? ALLOWLIST_DEFAULT)
}
const getStations = (): Set<string> => {
  refreshOverride()
  if (overrideStations) return overrideStations
  return parseStations(process.env.METRO_CHANNEL_STATIONS ?? STATIONS_DEFAULT)
}
const log = (...a: unknown[]): void => console.error('[metro-channel]', ...a)

if (!TOKEN) { log('FATAL: METRO_MONITOR_TOKEN unset'); process.exit(2) }

// --- MCP server (two-way channel + permission relay) ------------------------
const mcp = new Server(
  { name: 'metro', version: '0.1.0' },
  {
    capabilities: {
      experimental: { 'claude/channel': {}, 'claude/channel/permission': {} },
      tools: {},
    },
    instructions:
      'Messages from Metro chat arrive as <channel source="metro" line="..." from="..." ' +
      'station="..." message_id="...">. To respond, use the messaging tools, always passing the ' +
      '`line` attribute verbatim (the station is derived from it): `send` (text and/or media via ' +
      '`attachments`, optional `reply_to`), `reply` (quote a `message_id` with `text`), `react`/' +
      '`unreact` (emoji on a `message_id`), `edit`/`delete` (a `message_id`), and `read` (recent ' +
      'history). Station support varies: webhook lines accept no outbound; xmtp has no edit/delete; ' +
      'telegram has no read - the tool returns the daemon\'s reason if unsupported. Inbound ' +
      'attachments are surfaced as a note with an absolute `local_path` - Read that path to view ' +
      'the file. Tool-approval prompts are relayed to the same chat - answer "yes <id>"/"no <id>".',
  },
)

// --- Outbound: reply tool -> POST /api/call/<train>/<action> ----------------
// Raised when the daemon answers non-2xx (e.g. "unsupported verb 'edit' on
// xmtp"). The verb tools catch this and surface `.detail` as the tool result so
// the model sees WHY it failed, with isError semantics, rather than an opaque
// throw. `detail` is the status + body snippet from the daemon.
class MetroCallError extends Error {
  detail: string
  constructor(detail: string) { super(detail); this.name = 'MetroCallError'; this.detail = detail }
}

// POST to the daemon call endpoint. Returns the parsed JSON body (or raw text)
// on success; throws MetroCallError carrying the daemon's status + body on
// failure so callers can relay the reason verbatim.
async function metroCall(train: string, action: string, args: Record<string, unknown>): Promise<unknown> {
  const r = await fetch(`${BASE}/api/call/${train}/${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ args }),
  })
  const body = await r.text()
  if (!r.ok) throw new MetroCallError(`metro ${action} ${train} ${r.status}: ${body.slice(0, 400)}`)
  try { return body ? JSON.parse(body) : null } catch { return body }
}

const trainOf = (line: string): string => line.split('/')[2] ?? ''

async function metroSend(line: string, text: string, replyTo?: string) {
  const args: Record<string, string> = { line, text }
  if (replyTo) args.replyTo = replyTo
  await metroCall(trainOf(line), 'send', args)
}

// The monitor request body is capped at ~256KiB; base64 inflates by ~4/3, so a
// raw file over ~190KiB won't fit once encoded. Used to pre-check xmtp
// sendAttachment (which must base64 the bytes through this path).
const XMTP_ATTACH_MAX_BYTES = 190 * 1024

// Best-effort mime from a file extension (for sendAttachment, which needs one).
const guessMime = (path: string): string => {
  const ext = (path.split('.').pop() ?? '').toLowerCase()
  const map: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', heic: 'image/heic', mp4: 'video/mp4', mov: 'video/quicktime',
    webm: 'video/webm', m4v: 'video/x-m4v', m4a: 'audio/mp4', mp3: 'audio/mpeg',
    ogg: 'audio/ogg', wav: 'audio/wav', pdf: 'application/pdf',
  }
  return map[ext] ?? 'application/octet-stream'
}
const isImageMime = (mime: string) => mime.toLowerCase().startsWith('image/')
const isImageExt = (path: string) => /\.(png|jpe?g|gif|webp|heic|bmp|svg)$/i.test(path)

// Images -> sendImage {line, path}: the daemon reads the file itself (no base64
// round-trip). Confirmed in packages/metro/src/stations/xmtp/actions.ts:103-121.
async function metroSendImage(line: string, path: string) {
  await metroCall(trainOf(line), 'sendImage', { line, path })
}
// Non-images -> sendAttachment {line, name, mime, dataB64}: read + base64 here.
// Confirmed in packages/metro/src/stations/xmtp/actions.ts:92-101.
async function metroSendAttachment(line: string, path: string, mime?: string, name?: string) {
  const buf = await readFile(path)
  if (buf.byteLength > XMTP_ATTACH_MAX_BYTES) {
    throw new MetroCallError(
      `attachment '${path}' is ${(buf.byteLength / 1024).toFixed(0)} KiB; xmtp non-image files ` +
      `over ~190 KiB (256 KiB once base64-encoded) cannot be sent via this MCP path. ` +
      `Send it as an image, host it elsewhere, or use the metro CLI directly.`,
    )
  }
  await metroCall(trainOf(line), 'sendAttachment', {
    line, name: name ?? path.split('/').pop() ?? 'attachment',
    mime: mime ?? guessMime(path), dataB64: buf.toString('base64'),
  })
}

// Canonical attachment descriptor as accepted by the `send` action for
// telegram/discord (matches packages/metro/src/messaging.ts Attachment +
// cli/messaging.ts toAttachments: {kind,url:<path>,name}). The daemon's
// normalize layer turns these into the station-native multipart inputs.
type CanonicalAttachment = { path?: string; url?: string; mime?: string; name?: string }
const toCanonical = (a: CanonicalAttachment) => {
  const src = a.path ?? a.url ?? ''
  const mime = a.mime ?? (src ? guessMime(src) : '')
  return {
    kind: isImageMime(mime) || isImageExt(src) ? 'image' : 'file',
    url: src,
    name: a.name ?? src.split('/').pop() ?? undefined,
    ...(a.mime ? { mime: a.mime } : {}),
  }
}

// XMTP ignores canonical `attachments` on `send`, so dispatch one native action
// per attachment: images -> sendImage (path), other files -> sendAttachment
// (base64). Returns the list of kinds dispatched for the confirmation string.
async function xmtpSendAttachments(line: string, atts: CanonicalAttachment[]): Promise<string[]> {
  const sent: string[] = []
  for (const a of atts) {
    const src = a.path ?? a.url ?? ''
    if (!src) continue
    const mime = a.mime ?? guessMime(src)
    if (isImageMime(mime) || isImageExt(src)) { await metroSendImage(line, src); sent.push('image') }
    else { await metroSendAttachment(line, src, a.mime, a.name); sent.push('file') }
  }
  return sent
}

// Shared JSON-schema fragment: every verb takes the metro line.
const lineProp = { type: 'string', description: 'The metro:// line (from the inbound <channel> tag). The station is derived from it.' } as const
const msgIdProp = { type: 'string', description: 'The target message_id.' } as const

const attachmentItem = {
  type: 'object',
  description: 'A file to attach. Provide `path` (preferred, absolute local path) or `url`.',
  properties: {
    path: { type: 'string', description: 'Absolute local path to the file (the daemon reads it).' },
    url: { type: 'string', description: 'http(s) URL (alternative to path).' },
    mime: { type: 'string', description: 'MIME type (guessed from extension if omitted).' },
    name: { type: 'string', description: 'Filename to present (defaults to basename).' },
  },
} as const

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'reply',
      description:
        'Reply to a specific message in a Metro conversation (text quotes the target). ' +
        'Args: line, message_id, text. The station is derived from the line. ' +
        'Not supported on webhook lines (no outbound). On discord/telegram the reply quotes ' +
        'the target message; attachments are not supported on reply (use `send` for media).',
      inputSchema: {
        type: 'object',
        properties: { line: lineProp, message_id: msgIdProp, text: { type: 'string', description: 'The reply text.' } },
        required: ['line', 'message_id', 'text'],
      },
    },
    {
      name: 'send',
      description:
        'Send a message (and/or media) to a Metro conversation. Args: line, text?, reply_to?, ' +
        'attachments?. The station is derived from the line. Not supported on webhook lines ' +
        '(no outbound). For telegram/discord, attachments are passed as local paths the daemon ' +
        'reads. For xmtp, each attachment is dispatched natively: images via sendImage, other ' +
        'files via sendAttachment (base64; xmtp non-image files over ~190 KiB are rejected with ' +
        'a clear error). At least one of text/attachments is required.',
      inputSchema: {
        type: 'object',
        properties: {
          line: lineProp,
          text: { type: 'string', description: 'The message text (optional if sending only media).' },
          reply_to: { type: 'string', description: 'Optional message_id to quote/reply to.' },
          attachments: { type: 'array', description: 'Optional files to attach.', items: attachmentItem },
        },
        required: ['line'],
      },
    },
    {
      name: 'react',
      description:
        'Add an emoji reaction to a message. Args: line, message_id, emoji. Station derived from ' +
        'the line. Not supported on webhook lines.',
      inputSchema: {
        type: 'object',
        properties: { line: lineProp, message_id: msgIdProp, emoji: { type: 'string', description: 'The emoji to react with.' } },
        required: ['line', 'message_id', 'emoji'],
      },
    },
    {
      name: 'unreact',
      description:
        'Remove an emoji reaction from a message. Args: line, message_id, emoji. Station derived ' +
        'from the line. Not supported on webhook lines.',
      inputSchema: {
        type: 'object',
        properties: { line: lineProp, message_id: msgIdProp, emoji: { type: 'string', description: 'The emoji reaction to remove.' } },
        required: ['line', 'message_id', 'emoji'],
      },
    },
    {
      name: 'edit',
      description:
        'Edit the text of a message you sent. Args: line, message_id, text. Station derived from ' +
        'the line. Not supported on webhook lines. Not supported on xmtp (the daemon returns ' +
        "\"unsupported verb 'edit' on xmtp\"); discord/telegram support it.",
      inputSchema: {
        type: 'object',
        properties: { line: lineProp, message_id: msgIdProp, text: { type: 'string', description: 'The new message text.' } },
        required: ['line', 'message_id', 'text'],
      },
    },
    {
      name: 'delete',
      description:
        'Delete a message you sent. Args: line, message_id. Station derived from the line. Not ' +
        'supported on webhook lines. Not supported on xmtp (the daemon returns "unsupported ' +
        'verb \'delete\' on xmtp"); discord/telegram support it.',
      inputSchema: {
        type: 'object',
        properties: { line: lineProp, message_id: msgIdProp },
        required: ['line', 'message_id'],
      },
    },
    {
      name: 'read',
      description:
        'Read recent message history for a conversation. Args: line, limit?, before?, since?. ' +
        'Station derived from the line. Returns the raw history JSON (shapes differ per station). ' +
        'xmtp maps to a query, discord to a fetch. Not supported on telegram (the daemon returns ' +
        'an unsupported-verb error). Not supported on webhook lines.',
      inputSchema: {
        type: 'object',
        properties: {
          line: lineProp,
          limit: { type: 'number', description: 'Max messages to return.' },
          before: { type: 'string', description: 'Return messages before this message_id.' },
          since: { type: 'string', description: 'Return messages since this timestamp.' },
        },
        required: ['line'],
      },
    },
  ],
}))

// Tool-result helpers: short text confirmation, JSON payload, and an isError
// result carrying the daemon's reason (so the model sees WHY, not an opaque throw).
const ok = (text: string) => ({ content: [{ type: 'text', text }] })
const okJson = (v: unknown) => ({ content: [{ type: 'text', text: JSON.stringify(v, null, 2) }] })
const errResult = (text: string) => ({ content: [{ type: 'text', text }], isError: true })

// webhook lines accept no outbound verbs; reject early with a clear message.
const WEBHOOK_REJECT = 'webhook lines do not support outbound messaging (send/reply/react/unreact/edit/delete/read).'

mcp.setRequestHandler(CallToolRequestSchema, async req => {
  const name = req.params.name
  const a = (req.params.arguments ?? {}) as Record<string, unknown>
  const line = String(a.line ?? '')
  if (!line) return errResult(`${name} requires \`line\``)
  const train = trainOf(line)
  if (train === 'webhook') return errResult(WEBHOOK_REJECT)

  try {
    switch (name) {
      case 'send': {
        const text = a.text as string | undefined
        const replyTo = a.reply_to as string | undefined
        const atts = (a.attachments as CanonicalAttachment[] | undefined)?.filter(x => x && (x.path || x.url)) ?? []
        const sent: string[] = []
        if (train === 'xmtp') {
          // xmtp `send` ignores canonical attachments -> dispatch natively.
          if (text) { await metroSend(line, text, replyTo); sent.push('text') }
          sent.push(...await xmtpSendAttachments(line, atts))
        } else {
          // telegram/discord: canonical attachments ride the `send` action; the
          // daemon normalize layer turns them into native multipart inputs.
          if (!text && !atts.length) return errResult('send requires `text` or `attachments`')
          const args: Record<string, unknown> = { line }
          if (text) args.text = text
          if (replyTo) args.replyTo = replyTo
          if (atts.length) args.attachments = atts.map(toCanonical)
          await metroCall(train, 'send', args)
          if (text) sent.push('text')
          if (atts.length) sent.push(`${atts.length} attachment(s)`)
        }
        if (!sent.length) return errResult('send requires `text` or `attachments`')
        return ok(`sent: ${sent.join(', ')}`)
      }
      case 'reply': {
        const messageId = String(a.message_id ?? '')
        const text = String(a.text ?? '')
        if (!messageId || !text) return errResult('reply requires `message_id` and `text`')
        await metroCall(train, 'reply', { line, replyTo: messageId, text })
        return ok('replied')
      }
      case 'react': {
        const messageId = String(a.message_id ?? '')
        const emoji = String(a.emoji ?? '')
        if (!messageId || !emoji) return errResult('react requires `message_id` and `emoji`')
        await metroCall(train, 'react', { line, messageId, emoji })
        return ok('reacted')
      }
      case 'unreact': {
        const messageId = String(a.message_id ?? '')
        const emoji = String(a.emoji ?? '')
        if (!messageId || !emoji) return errResult('unreact requires `message_id` and `emoji`')
        await metroCall(train, 'unreact', { line, messageId, emoji })
        return ok('reaction removed')
      }
      case 'edit': {
        const messageId = String(a.message_id ?? '')
        const text = String(a.text ?? '')
        if (!messageId || !text) return errResult('edit requires `message_id` and `text`')
        await metroCall(train, 'edit', { line, messageId, text })
        return ok('edited')
      }
      case 'delete': {
        const messageId = String(a.message_id ?? '')
        if (!messageId) return errResult('delete requires `message_id`')
        await metroCall(train, 'delete', { line, messageId })
        return ok('deleted')
      }
      case 'read': {
        const args: Record<string, unknown> = { line }
        if (typeof a.limit === 'number') args.limit = a.limit
        if (a.before) args.before = String(a.before)
        if (a.since) args.since = String(a.since)
        const result = await metroCall(train, 'read', args)
        return okJson(result)
      }
      default:
        return errResult(`unknown tool: ${name}`)
    }
  } catch (e) {
    // Surface the daemon's reason (e.g. "unsupported verb 'edit' on xmtp",
    // telegram read unsupported, or the xmtp attachment size cap) as the tool
    // result with isError semantics so the model can read and explain it.
    if (e instanceof MetroCallError) return errResult(e.detail)
    return errResult(`metro ${name} failed: ${String(e)}`)
  }
})

// --- Permission relay -------------------------------------------------------
// Map request_id -> the line to send the verdict prompt to (last-seen inbound).
let lastLine: string | undefined
const pending = new Map<string, string>()

const PermissionRequestSchema = z.object({
  method: z.literal('notifications/claude/channel/permission_request'),
  params: z.object({
    request_id: z.string(),
    tool_name: z.string(),
    description: z.string(),
    input_preview: z.string(),
  }),
})

type PermissionRequest = z.infer<typeof PermissionRequestSchema>
// Cast sidesteps a deep-recursive generic in the SDK's setNotificationHandler
// type; runtime validation is still done by the zod schema above.
mcp.setNotificationHandler(PermissionRequestSchema as never, async (n: PermissionRequest) => {
  const { params } = n
  const line = lastLine
  if (!line) { log('permission_request but no known line to relay to', params.request_id); return }
  pending.set(params.request_id, line)
  const body = `Claude wants to run ${params.tool_name}: ${params.description}\n` +
    (params.input_preview ? `\n${params.input_preview}\n` : '') +
    `\nReply "yes ${params.request_id}" or "no ${params.request_id}"`
  try { await metroSend(line, body) } catch (e) { log('relay send failed', e) }
})

await mcp.connect(new StdioServerTransport())
log('connected. base=', BASE, 'allowlist=', getAllowlist().length, 'stations=', [...getStations()].join(','))

// --- Inbound: subscribe to Metro SSE ----------------------------------------
const senderAllowed = (from: string) => {
  const allowlist = getAllowlist()
  if (allowlist.includes('*')) return true
  const f = (from ?? '').toLowerCase()
  // match full URI or trailing id segment against the allowlist
  const id = f.split('/').pop() ?? f
  return allowlist.some(a => a === f || a === id)
}

// verdict format: "yes abcde" / "no abcde" (5 letters, no 'l'); /i for autocorrect
const PERMISSION_REPLY_RE = /^\s*(y|yes|n|no)\s+([a-km-z]{5})\s*$/i

// Short, human-friendly id for the reacted-to message in the note.
const shortId = (id: string) => (id.length > 10 ? `${id.slice(0, 6)}…` : id)

// --- Inbound media -----------------------------------------------------------
// Inbound attachments arrive as TWO events: (1) the msg event carries
// `payload.attachments[]` (for XMTP the urls are ENCRYPTED bytes, unusable
// directly); (2) the daemon fetches/decrypts each blob asynchronously and emits
// a follow-up `attachmentSaved` event (one per index) carrying the absolute
// on-disk path. That follow-up has no real sender `from` (it originates from the
// daemon, e.g. SELF_URI), so it can't pass the per-event allowlist.
//
// We correlate the two: buffer the (allowlisted) source msg keyed by its
// top-level event `id` (== attachmentSaved.attachmentFor) so the saved-file
// surfacing quotes the real sender + caption. `allowedLines` is a fallback gate
// (a line an allowed sender already drives) for any orphan attachmentSaved.
const allowedLines = new Set<string>()

const ATTACH_TIMEOUT_MS = 15_000
// Gate base64/Read inlining at 4MB to stay clear of the ~5MB channels/API cap.
const MAX_INLINE_BYTES = 4 * 1024 * 1024

type PendingAtt = { kind?: string; name?: string }
type PendingMsg = {
  line: string
  from: string
  station: string
  text: string
  messageId: string
  lineName: string
  attachments: PendingAtt[]
  saved: Set<number>
  timer: ReturnType<typeof setTimeout>
}
const pendingAttachments = new Map<string, PendingMsg>()

// Media payload as projected by the xmtp/telegram/discord trains (attachmentSaved).
type SavedMedia = {
  contentType?: string
  attachmentFor?: string
  attachmentPath?: string
  localPath?: string
  url?: string
  mime?: string
  name?: string
  index?: number
}

const mediaKind = (mime?: string, name?: string): string => {
  const m = (mime ?? '').toLowerCase()
  if (m.startsWith('image/')) return 'image'
  if (m.startsWith('video/')) return 'video'
  if (m.startsWith('audio/')) return 'audio'
  if (/\.(png|jpe?g|gif|webp|heic)$/i.test(name ?? '')) return 'image'
  if (/\.(mp4|mov|webm|m4v)$/i.test(name ?? '')) return 'video'
  if (/\.(m4a|mp3|ogg|wav)$/i.test(name ?? '')) return 'audio'
  return 'file'
}

// Surface a saved inbound attachment to the session.
//
// CONTENT SHAPE DECISION: the Channels notification `content` field is typed as
// `string` (channels-reference, "Notification format": content | string | "The
// event body. Delivered as the body of the <channel> tag."). It does NOT accept
// a multimodal content-block array, so an {type:'image',source:{base64}} block
// is not deliverable. We therefore take the documented fallback: a text note +
// the absolute on-disk path (the daemon already decrypted the bytes there). The
// session reads images visually and opens other files via the Read tool on that
// path. We still size-gate at 4MB and steer Claude away from inlining huge files.
async function surfaceMedia(ctx: { line: string; from: string; station: string }, p: SavedMedia) {
  const path = p.attachmentPath ?? p.localPath
  if (!path) return
  const kind = mediaKind(p.mime, p.name)
  const name = p.name ?? path.split('/').pop() ?? 'attachment'
  let size = 0
  try { size = (await stat(path)).size } catch { /* not yet on disk / unreadable */ }
  const tooBig = size > MAX_INLINE_BYTES
  const sizeNote = size ? ` (${(size / 1024 / 1024).toFixed(2)} MB)` : ''
  const content =
    `[${kind} attachment received: ${name}${p.mime ? `, ${p.mime}` : ''}${sizeNote}]\n` +
    `Saved locally at: ${path}\n` +
    (p.url ? `Public URL: ${p.url}\n` : '') +
    (tooBig
      ? 'Large file - inspect on disk only as needed (do not inline).'
      : 'Use the Read tool on that absolute path to view/inspect it.')
  await mcp.notification({
    method: 'notifications/claude/channel',
    params: {
      content,
      meta: {
        line: ctx.line,
        from: ctx.from,
        station: ctx.station,
        kind,
        mime: p.mime ?? '',
        name,
        local_path: path,
      },
    },
  })
}

// Flush a buffered msg whose attachments never produced an attachmentSaved
// (fetch/decrypt failed or timed out): text-only fallback naming the file(s).
async function flushPendingFallback(id: string) {
  const e = pendingAttachments.get(id)
  if (!e) return
  pendingAttachments.delete(id)
  const missing = e.attachments.filter((_, i) => !e.saved.has(i))
  if (!missing.length) return
  const names = missing.map(a => a.name ?? a.kind ?? 'attachment').join(', ')
  await mcp.notification({
    method: 'notifications/claude/channel',
    params: {
      content:
        (e.text ? `${e.text}\n` : '') +
        `[attachment(s) could not be fetched in time: ${names}]`,
      meta: {
        line: e.line, from: e.from, station: e.station,
        message_id: e.messageId, line_name: e.lineName,
      },
    },
  })
}

async function handleEvent(ev: Record<string, unknown>) {
  // Daemon-side follow-up: an inbound attachment was fetched/decrypted and
  // written to disk. Handle BEFORE the normal sender/allowlist guard, because
  // this event's `from` is the daemon self-uri (not the real sender) and would
  // be dropped. Gate instead via the correlated source msg (allowlisted) or, as
  // a fallback, the line an allowed sender already drives.
  const payload = ev.payload as SavedMedia | undefined
  if (payload?.contentType === 'attachmentSaved') {
    const line = String(ev.line ?? '')
    const forId = String(payload.attachmentFor ?? '')
    const buf = forId ? pendingAttachments.get(forId) : undefined
    if (buf) {
      const idx = typeof payload.index === 'number' ? payload.index : 0
      buf.saved.add(idx)
      await surfaceMedia({ line: buf.line, from: buf.from, station: buf.station }, payload)
      if (buf.saved.size >= buf.attachments.length) {
        clearTimeout(buf.timer)
        pendingAttachments.delete(forId)
      }
    } else if (line && allowedLines.has(line)) {
      await surfaceMedia(
        { line, from: 'metro://attachment', station: String(ev.station ?? 'xmtp') },
        payload,
      )
    }
    return
  }

  // Forward chat messages and emoji reactions; drop edits/deletes/system/etc.
  const evType = ev.event ? (ev.event as { type?: string }).type : 'msg'
  if (evType !== 'msg' && evType !== 'react') return
  const isReact = evType === 'react'
  const station = String(ev.station ?? '')
  if (station === 'webhook' || !getStations().has(station)) return
  const from = String(ev.from ?? '')
  // outbound echoes have a local `from` (metro://claude|user|...); only act on real inbound
  if (from.startsWith('metro://claude') || from === 'metro://user' || !from.startsWith('metro://')) return
  if (!senderAllowed(from)) { log('drop: sender not allowed', from); return }

  const line = String(ev.line ?? '')
  const text = String(ev.text ?? '')
  lastLine = line
  // Remember this conversation so the daemon's follow-up attachmentSaved event
  // (which carries no real sender) can be gated/surfaced on the same line.
  if (line) allowedLines.add(line)

  // If this (allowlisted) msg carries attachments, buffer its context keyed by
  // the top-level event id so the follow-up attachmentSaved events can correlate
  // per index and quote the real sender + caption. 15s self-destruct fallback.
  const atts = (ev.payload as { attachments?: PendingAtt[] } | undefined)?.attachments
  if (Array.isArray(atts) && atts.length) {
    const id = String(ev.id ?? '')
    if (id) {
      const existing = pendingAttachments.get(id)
      if (existing) clearTimeout(existing.timer)
      pendingAttachments.set(id, {
        line, from, station, text,
        messageId: String(ev.messageId ?? ''),
        lineName: String(ev.lineName ?? ''),
        attachments: atts.map(a => ({ kind: a?.kind, name: a?.name })),
        saved: new Set<number>(),
        timer: setTimeout(() => { void flushPendingFallback(id) }, ATTACH_TIMEOUT_MS),
      })
    }
    // Don't also forward the placeholder text ("[image: metro-pending-...]") as a
    // normal chat turn - the surfaced file (or fallback) carries the content.
    return
  }

  if (isReact) {
    // react event schema (HistoryEntry.event): { type:'react', emoji?, targetId? }.
    // Per-station shape differs (verified against live history.jsonl):
    //  - xmtp/telegram: emoji is a plain string; targetId is absent.
    //  - discord: emoji is a discord.js object {name,reaction,identifier,...};
    //    targetId is absent.
    // The reacted-to message id is always carried top-level as `messageId` (the
    // dispatcher does not fold it into `event.targetId`), so prefer that.
    const re = ev.event as { emoji?: unknown; targetId?: string }
    const rawEmoji = re.emoji
    const emoji = typeof rawEmoji === 'string'
      ? rawEmoji
      : String((rawEmoji as { name?: string; reaction?: string } | undefined)?.name
        ?? (rawEmoji as { reaction?: string } | undefined)?.reaction ?? '')
    const target = re.targetId ?? String(ev.messageId ?? '')
    // Only xmtp distinguishes removals (payload.removed / "(removed)" in text).
    const removed = (ev.payload as { removed?: boolean } | undefined)?.removed === true ||
      / \(removed\)\]?$/.test(text)
    const content = removed
      ? `${emoji || 'reaction'} removed from message ${shortId(target)}`.trim()
      : `${emoji || 'reacted'} reacted to message ${shortId(target)}`.trim()
    await mcp.notification({
      method: 'notifications/claude/channel',
      params: {
        content,
        meta: {
          line,
          from,
          station,
          message_id: String(ev.messageId ?? ''),
          line_name: String(ev.lineName ?? ''),
          reaction: emoji,
          target_id: target,
        },
      },
    })
    return
  }

  // intercept permission verdicts before forwarding as chat (msg text only)
  const m = PERMISSION_REPLY_RE.exec(text)
  if (m && pending.size) {
    const id = m[2].toLowerCase()
    if (pending.has(id)) {
      pending.delete(id)
      await mcp.notification({
        method: 'notifications/claude/channel/permission',
        params: { request_id: id, behavior: m[1].toLowerCase().startsWith('y') ? 'allow' : 'deny' },
      })
      return
    }
  }

  await mcp.notification({
    method: 'notifications/claude/channel',
    params: {
      content: text,
      meta: {
        line,
        from,
        station,
        message_id: String(ev.messageId ?? ''),
        line_name: String(ev.lineName ?? ''),
      },
    },
  })
}

// SSE reader with auto-reconnect. since=tail -> only new events.
async function subscribe() {
  for (;;) {
    try {
      // Subscribe WITHOUT a station filter: the SSE filter is fixed at connect
      // time, but the effective station set can change at runtime via the
      // override file. We pull all stations and let getStations() (in
      // handleEvent) be the authoritative, dynamic gate. webhook is still
      // hard-dropped in handleEvent (flood/crash risk).
      const res = await fetch(
        `${BASE}/api/tail?since=tail&mode=all`,
        { headers: { authorization: `Bearer ${TOKEN}`, accept: 'text/event-stream' } },
      )
      if (!res.ok || !res.body) throw new Error(`tail ${res.status}`)
      log('subscribed to', `${BASE}/api/tail`)
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        let nl: number
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trimEnd()
          buf = buf.slice(nl + 1)
          if (!line.startsWith('data:')) continue // skip comments/keepalives
          const json = line.slice(5).trim()
          if (!json) continue
          try { await handleEvent(JSON.parse(json)) } catch (e) { log('event err', e) }
        }
      }
      log('stream ended, reconnecting')
    } catch (e) {
      log('subscribe error, retry in 3s', String(e))
    }
    await new Promise(r => setTimeout(r, 3000))
  }
}

void subscribe()
