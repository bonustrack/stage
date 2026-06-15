#!/usr/bin/env bun
/**
 * Metro Channel - a Claude Code Channel MCP server.
 *
 * Bridges Metro's inbound chat stream into a running Claude Code session as
 * channel push events, exposes a `reply` tool for outbound, and relays
 * tool-approval permission prompts out via Metro so they can be answered
 * from a phone.
 *
 * Inbound source : Metro monitor SSE  GET /api/tail   (METRO_MONITOR_TOKEN gated)
 * Outbound sink  : Metro call  POST /api/call/<train>/send
 *
 * Spec: https://code.claude.com/docs/en/channels-reference
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

// --- Config (all via env) ---------------------------------------------------
const BASE = (process.env.METRO_BASE_URL ?? 'http://127.0.0.1:8420').replace(/\/$/, '')
const TOKEN = process.env.METRO_MONITOR_TOKEN ?? ''
// Comma-separated sender URIs or bare inbox/user ids that are allowed to drive
// the session. Default: Less's primary tony-account XMTP inbox. A `*` disables
// gating (NOT recommended - this is a prompt-injection surface).
const ALLOWLIST = (process.env.METRO_CHANNEL_ALLOWLIST ??
  'bee7314f7127ef53b4e3bf5256e54b0a1acdc3698d064fb1029bd8f83ecc1186')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
// Stations to surface. Chat platforms only - EXCLUDE webhook (flood/crash risk).
const STATIONS = new Set((process.env.METRO_CHANNEL_STATIONS ?? 'xmtp,telegram,discord')
  .split(',').map(s => s.trim()).filter(Boolean))
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
      'station="..." message_id="...">. To respond, call the `reply` tool with the `line` ' +
      'attribute verbatim and your text; it sends back over the same conversation. ' +
      'Tool-approval prompts are relayed to the same chat - answer "yes <id>"/"no <id>" there.',
  },
)

// --- Outbound: reply tool -> POST /api/call/<train>/send --------------------
async function metroSend(line: string, text: string, replyTo?: string) {
  // train is the station: metro://<train>/...
  const train = line.split('/')[2]
  const args: Record<string, string> = { line, text }
  if (replyTo) args.replyTo = replyTo
  const r = await fetch(`${BASE}/api/call/${train}/send`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ args }),
  })
  if (!r.ok) throw new Error(`metro send ${train} ${r.status}: ${(await r.text()).slice(0, 200)}`)
}

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'reply',
    description: 'Send a message back to a Metro conversation. Pass the `line` from the inbound <channel> tag.',
    inputSchema: {
      type: 'object',
      properties: {
        line: { type: 'string', description: 'The metro:// line to reply on (from the inbound tag)' },
        text: { type: 'string', description: 'The message to send' },
        reply_to: { type: 'string', description: 'Optional message_id to reply to' },
      },
      required: ['line', 'text'],
    },
  }],
}))

mcp.setRequestHandler(CallToolRequestSchema, async req => {
  if (req.params.name === 'reply') {
    const { line, text, reply_to } = req.params.arguments as
      { line: string; text: string; reply_to?: string }
    await metroSend(line, text, reply_to)
    return { content: [{ type: 'text', text: 'sent' }] }
  }
  throw new Error(`unknown tool: ${req.params.name}`)
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
log('connected. base=', BASE, 'allowlist=', ALLOWLIST.length, 'stations=', [...STATIONS].join(','))

// --- Inbound: subscribe to Metro SSE ----------------------------------------
const senderAllowed = (from: string) => {
  if (ALLOWLIST.includes('*')) return true
  const f = (from ?? '').toLowerCase()
  // match full URI or trailing id segment against the allowlist
  const id = f.split('/').pop() ?? f
  return ALLOWLIST.some(a => a === f || a === id)
}

// verdict format: "yes abcde" / "no abcde" (5 letters, no 'l'); /i for autocorrect
const PERMISSION_REPLY_RE = /^\s*(y|yes|n|no)\s+([a-km-z]{5})\s*$/i

// Short, human-friendly id for the reacted-to message in the note.
const shortId = (id: string) => (id.length > 10 ? `${id.slice(0, 6)}…` : id)

// --- Inbound media -----------------------------------------------------------
// Lines on which an allowed sender has recently spoken. The daemon fetches +
// decrypts inbound attachments asynchronously and emits a follow-up
// `attachmentSaved` event carrying the absolute on-disk path - but that event
// has no real sender `from` (it originates from the daemon itself), so it can't
// pass the per-event allowlist. We gate it instead on its line: only surface
// media whose conversation an allowed sender is already driving.
const allowedLines = new Set<string>()

// Media payload as projected by the xmtp train (history-types: attachmentSaved).
type SavedMedia = {
  contentType?: string
  attachmentPath?: string
  localPath?: string
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

// Surface a saved inbound attachment to the session. The Channels notification
// content is plain text, so we hand the session the absolute local path + mime:
// Claude can then `Read` it (images render visually; other files open by path).
async function surfaceMedia(line: string, p: SavedMedia) {
  const path = p.attachmentPath ?? p.localPath
  if (!path) return
  const kind = mediaKind(p.mime, p.name)
  const name = p.name ?? path.split('/').pop() ?? 'attachment'
  const content =
    `[${kind} attachment received: ${name}${p.mime ? ` (${p.mime})` : ''}]\n` +
    `Saved locally at: ${path}\n` +
    `Use the Read tool on that absolute path to view/inspect it.`
  await mcp.notification({
    method: 'notifications/claude/channel',
    params: {
      content,
      meta: {
        line,
        from: 'metro://xmtp/attachment',
        station: 'xmtp',
        kind,
        mime: p.mime ?? '',
        name,
        local_path: path,
      },
    },
  })
}

async function handleEvent(ev: Record<string, unknown>) {
  // Daemon-side follow-up: an inbound attachment was fetched/decrypted and
  // written to disk. Surface it (gated on a line an allowed sender drives)
  // before the normal sender/allowlist checks, since it has no real `from`.
  const payload = ev.payload as SavedMedia | undefined
  if (payload?.contentType === 'attachmentSaved') {
    const line = String(ev.line ?? '')
    if (line && allowedLines.has(line)) await surfaceMedia(line, payload)
    return
  }

  // Forward chat messages and emoji reactions; drop edits/deletes/system/etc.
  const evType = ev.event ? (ev.event as { type?: string }).type : 'msg'
  if (evType !== 'msg' && evType !== 'react') return
  const isReact = evType === 'react'
  const station = String(ev.station ?? '')
  if (station === 'webhook' || !STATIONS.has(station)) return
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

  if (isReact) {
    // react event schema (HistoryEntry.event): { type:'react', emoji?, targetId? }
    // confirmed in packages/metro/src/history-types.ts:10 and the station emitters
    // (xmtp/emit.ts:60, discord/format.ts:79, telegram/format.ts:80).
    const re = ev.event as { emoji?: string; targetId?: string }
    const emoji = re.emoji ?? ''
    const target = re.targetId ?? ''
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
      const res = await fetch(
        `${BASE}/api/tail?since=tail&mode=all&station=${[...STATIONS].join(',')}`,
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
