/**
 * Reference train — XMTP (decentralized wallet-native messaging).
 *
 * XMTP gives you:
 *   - wallet = identity (every Ethereum address is reachable by default)
 *   - end-to-end encryption (MLS, no plaintext on relay nodes)
 *   - federation: messages land in Coinbase Wallet, Lens, Farcaster, any XMTP client
 *
 * This train relays XMTP conversations into Metro's universal event log so the
 * agent + the team's metro.box inbox can see them alongside Discord/Telegram.
 *
 * Setup:
 *   cd ~/.metro && bun add @xmtp/node-sdk viem \
 *     @xmtp/content-type-reaction @xmtp/content-type-reply @xmtp/content-type-remote-attachment
 *   cp <this-file> ~/.metro/trains/xmtp.ts
 *   echo 'XMTP_PRIVATE_KEY=0x…' >> ~/.metro/.env       # 0x-prefixed 32-byte hex
 *   echo 'XMTP_ENV=production' >> ~/.metro/.env        # or "dev"
 *   metro
 */

import {
  Client, ConsentState, IdentifierKind,
  type Conversation, type DecodedMessage, type Signer,
} from '@xmtp/node-sdk';
import { ContentTypeReaction, ReactionCodec, type Reaction } from '@xmtp/content-type-reaction';
/** node-sdk's native bindings expect numeric enums (0=Unknown 1=Added 2=Removed for action,
 *  0=Unknown 1=Unicode 2=Shortcode 3=Custom for schema) — the string form from the codec
 *  errors with "NumberExpected" through napi. Pull the enums from node-sdk directly. */
import { ReactionAction, ReactionSchema } from '@xmtp/node-sdk';
import { ContentTypeReply, ReplyCodec, type Reply } from '@xmtp/content-type-reply';
import {
  AttachmentCodec, ContentTypeAttachment, RemoteAttachmentCodec,
  type Attachment,
} from '@xmtp/content-type-remote-attachment';
import { privateKeyToAccount } from 'viem/accounts';

const PK = process.env.XMTP_PRIVATE_KEY;
if (!PK) { process.stderr.write('XMTP_PRIVATE_KEY unset (0x-prefixed 32-byte hex)\n'); process.exit(2); }
const XMTP_ENV = (process.env.XMTP_ENV ?? 'production') as 'production' | 'dev' | 'local';

const emit = (e: unknown): void => void process.stdout.write(JSON.stringify(e) + '\n');
const respond = (id: string, body: { result?: unknown; error?: string }): void =>
  void process.stdout.write(JSON.stringify({ op: 'response', id, ...body }) + '\n');
const mintId = (): string => `msg_${Math.random().toString(36).slice(2, 10)}`;
const SELF_URI = process.env.METRO_SELF_URI ?? '';
const lineOf = (convId: string): string => `metro://xmtp/${convId}`;

/** Local whisper.cpp transcription. Opt-in via $METRO_WHISPER_MODEL existing on disk.
 *  Defaults match `packages/metro/src/cli/messenger-transcribe.ts` so a single model
 *  install serves both the legacy messenger upload path + the XMTP inline-audio path. */
const WHISPER_BIN = process.env.METRO_WHISPER_BIN ?? 'whisper-cli';
const WHISPER_MODEL = process.env.METRO_WHISPER_MODEL
  ?? `${process.env.HOME}/.cache/whisper-cpp/ggml-base.bin`;
const FFMPEG_BIN = process.env.METRO_FFMPEG_BIN ?? 'ffmpeg';
async function transcribeAndEmit(audio: Uint8Array, line: string, sourceMsgId: string): Promise<void> {
  const { existsSync, readFileSync, writeFileSync, unlinkSync, mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawn } = await import('node:child_process');
  if (!existsSync(WHISPER_MODEL)) return;
  const dir = mkdtempSync(join(tmpdir(), 'xmtp-tx-'));
  const inFile = join(dir, 'in.m4a'); const wav = join(dir, 'in.wav'); const out = join(dir, 'in');
  const run = (bin: string, args: string[]): Promise<void> => new Promise((res, rej) => {
    const p = spawn(bin, args, { stdio: 'ignore' });
    p.on('error', rej); p.on('exit', c => c === 0 ? res() : rej(new Error(`${bin} ${c}`)));
  });
  try {
    writeFileSync(inFile, audio);
    await run(FFMPEG_BIN, ['-y', '-i', inFile, '-ar', '16000', '-ac', '1', wav]);
    await run(WHISPER_BIN, ['-m', WHISPER_MODEL, '-f', wav, '--output-txt', '-of', out]);
    const text = readFileSync(`${out}.txt`, 'utf8').trim();
    if (!text) return;
    emit({
      kind: 'inbound', id: mintId(), ts: new Date().toISOString(),
      station: 'xmtp', line, from: SELF_URI,
      text: `🎙️ ${text}`,
      payload: { contentType: 'transcript', transcribeFor: sourceMsgId, transcript: text },
    });
  } catch (err) { process.stderr.write(`xmtp transcribe failed: ${(err as Error).message}\n`); }
  finally { for (const f of [inFile, wav, `${out}.txt`]) { try { unlinkSync(f); } catch { /* ignore */ } } }
}

const account = privateKeyToAccount(PK as `0x${string}`);
const signer: Signer = {
  type: 'EOA',
  getIdentifier: async () => ({ identifier: account.address, identifierKind: IdentifierKind.Ethereum }),
  signMessage: async (msg: string) => {
    const sig = await account.signMessage({ message: msg });
    const hex = sig.slice(2);
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return out;
  },
};

/** Register all content-type codecs so the SDK decodes reactions/replies/attachments instead
 *  of returning encoded blobs. Without this, msg.content is the raw bytes payload and typeId
 *  surfaces but you can't do anything with it. */
const client = await Client.create(signer, {
  env: XMTP_ENV,
  codecs: [new ReactionCodec(), new ReplyCodec(), new AttachmentCodec(), new RemoteAttachmentCodec()],
});
process.stderr.write(`xmtp train ready — inbox ${client.inboxId} (${account.address}, env=${XMTP_ENV})\n`);

/** Build a metro envelope from a decoded XMTP message. Per content type:
 *  - text: plain text body
 *  - reaction: `[react <emoji>]` + payload.reactTo (xmtp message id) + payload.emoji + payload.removed
 *  - reply: text body of the reply + payload.replyTo (xmtp message id of original)
 *  - attachment (inline): `[image|file: <name>]` + payload.attachments[{kind, mime, name, data:base64}]
 *  - remoteAttachment: `[image|file: <url>]` + payload.attachments[{kind, mime, name, url}]
 *  - anything else: `[<typeId> payload]` with the raw content in payload.raw  */
function envelope(msg: DecodedMessage, conv: Conversation): Record<string, unknown> {
  const senderInbox = msg.senderInboxId;
  const typeId = msg.contentType?.typeId;
  const c = msg.content;
  const base = {
    kind: 'inbound', id: mintId(), ts: msg.sentAt.toISOString(),
    station: 'xmtp', line: lineOf(conv.id),
    from: `metro://xmtp/user/${senderInbox}`,
    message_id: msg.id,
  };
  if (typeof c === 'string') return { ...base, text: c, payload: { contentType: typeId } };
  if (typeId === 'reaction' && c && typeof c === 'object') {
    const r = c as Reaction;
    const removed = r.action === 'removed';
    return {
      ...base,
      text: `[react ${r.content ?? ''}${removed ? ' (removed)' : ''}]`,
      payload: { contentType: typeId, reactTo: r.reference, emoji: r.content, removed },
    };
  }
  if (typeId === 'reply' && c && typeof c === 'object') {
    const r = c as Reply;
    return {
      ...base,
      text: typeof r.content === 'string' ? r.content : `[reply with ${r.contentType?.typeId ?? 'unknown'}]`,
      payload: { contentType: typeId, replyTo: r.reference, replyContentType: r.contentType?.typeId },
    };
  }
  if (typeId === 'attachment' && c && typeof c === 'object') {
    /** node-bindings' native Attachment shape is `{ filename?, mimeType, content: Uint8Array }`
     *  — NOT the `@xmtp/content-type-remote-attachment` JS shape with `data`. msg.content
     *  comes from the native side, so cast to the native field names. Casting to the JS
     *  type made `a.data` undefined → crashed the train on every attachment. */
    const a = c as { filename?: string; mimeType: string; content: Uint8Array };
    const kind = a.mimeType?.startsWith('image/') ? 'image'
      : a.mimeType?.startsWith('audio/') ? 'audio'
        : a.mimeType?.startsWith('video/') ? 'video' : 'file';
    /** Inline bytes — base64 in the payload so downstream renderers can show them without
     *  a separate fetch. Large files (>1MB) bloat history.jsonl; switch to remoteAttachment
     *  on the sender side for those. */
    const dataB64 = Buffer.from(a.content).toString('base64');
    const out = {
      ...base,
      text: `[${kind}: ${a.filename ?? 'attachment'}]`,
      payload: { contentType: typeId, attachments: [{ kind, mime: a.mimeType, name: a.filename, dataB64 }] },
    };
    /** Audio attachments → kick off whisper.cpp transcription async + emit a follow-up
     *  event tagged `transcribeFor` so downstream consumers (mobile bubble, agent worker,
     *  monitor) see the transcript without blocking the main stream. */
    if (kind === 'audio') void transcribeAndEmit(a.content, base.line, base.id);
    return out;
  }
  if (typeId === 'remoteStaticAttachment' && c && typeof c === 'object') {
    const r = c as { url: string; filename?: string; contentDigest?: string; nonce?: Uint8Array; salt?: Uint8Array; secret?: Uint8Array; scheme?: string; contentLength?: number };
    const kind = r.url.match(/\.(png|jpg|jpeg|gif|webp|heic)(\?|$)/i) ? 'image' : 'file';
    /** Note: payload includes the decryption secrets, so anything reading history can decrypt
     *  by fetching the URL + applying RemoteAttachmentCodec.load(). */
    return {
      ...base,
      text: `[${kind}: ${r.filename ?? r.url}]`,
      payload: {
        contentType: typeId,
        attachments: [{ kind, url: r.url, name: r.filename, size: r.contentLength,
          remote: { contentDigest: r.contentDigest, nonce: r.nonce ? Buffer.from(r.nonce).toString('base64') : undefined,
            salt: r.salt ? Buffer.from(r.salt).toString('base64') : undefined,
            secret: r.secret ? Buffer.from(r.secret).toString('base64') : undefined,
            scheme: r.scheme } }],
      },
    };
  }
  return { ...base, text: `[${typeId ?? 'unknown'} payload]`, payload: { contentType: typeId } };
}

const emitOutbound = (line: string, messageId: string, text: string): void => emit({
  kind: 'outbound', id: mintId(), ts: new Date().toISOString(),
  station: 'xmtp', line, from: SELF_URI, to: line, message_id: messageId, text,
});

function convOf(line: string): Promise<Conversation | undefined> {
  const convId = line.match(/^metro:\/\/xmtp\/([^/]+)$/)?.[1];
  if (!convId) throw new Error(`bad xmtp line: ${line}`);
  return client.conversations.getConversationById(convId);
}

type CallMsg = { op: 'call'; id: string; action: string; args: Record<string, unknown> };
async function handleCall({ id, action, args }: CallMsg): Promise<void> {
  try {
    if (action === 'send') {
      const { line, text } = args as { line: string; text: string };
      const conv = await convOf(line);
      if (!conv) throw new Error(`conversation not found for ${line}`);
      const messageId = await conv.sendText(text);
      emitOutbound(line, messageId, text);
      respond(id, { result: { messageId } });
    } else if (action === 'react') {
      /** node-sdk has typed `sendReaction / sendReply / sendAttachment` helpers that handle
       *  codec encoding. Calling raw `conv.send(payload, ContentType)` errors with "Content
       *  type required when sending encoded content" because the base `send` expects already-
       *  encoded bytes — pass the structured payload through the typed helpers instead.
       *  XMTP V3 reactions also need `referenceInboxId` (inbox id of the original message's
       *  sender) — look it up from local messages if the caller didn't supply it. */
      const { line, messageId, emoji, action: reactAction } = args as {
        line: string; messageId: string; emoji: string; action?: 'added' | 'removed';
        referenceInboxId?: string;
      };
      const conv = await convOf(line);
      if (!conv) throw new Error(`conversation not found for ${line}`);
      let refInbox = (args as { referenceInboxId?: string }).referenceInboxId;
      if (!refInbox) {
        const found = (await conv.messages()).find(m => m.id === messageId);
        refInbox = found?.senderInboxId;
        if (!refInbox) throw new Error(`could not resolve referenceInboxId for ${messageId}`);
      }
      const sentId = await conv.sendReaction({
        reference: messageId, referenceInboxId: refInbox,
        action: reactAction === 'removed' ? ReactionAction.Removed : ReactionAction.Added,
        content: emoji, schema: ReactionSchema.Unicode,
      });
      emitOutbound(line, sentId, `[react ${emoji}${reactAction === 'removed' ? ' (removed)' : ''}]`);
      respond(id, { result: { messageId: sentId } });
    } else if (action === 'reply') {
      const { line, replyTo, text } = args as { line: string; replyTo: string; text: string };
      const conv = await convOf(line);
      if (!conv) throw new Error(`conversation not found for ${line}`);
      const sentId = await conv.sendReply({
        reference: replyTo, content: text,
        contentType: { authorityId: 'xmtp.org', typeId: 'text', versionMajor: 1, versionMinor: 0 },
      });
      emitOutbound(line, sentId, text);
      respond(id, { result: { messageId: sentId } });
    } else if (action === 'sendAttachment') {
      const { line, name, mime, dataB64 } = args as {
        line: string; name: string; mime: string; dataB64: string;
      };
      const conv = await convOf(line);
      if (!conv) throw new Error(`conversation not found for ${line}`);
      /** node-sdk's `Attachment` shape uses `content: Uint8Array`, not the `data` field
       *  from `@xmtp/content-type-remote-attachment`'s older type — calling sendAttachment
       *  with the wrong shape errors "Missing field `content`". */
      const sentId = await conv.sendAttachment({
        filename: name, mimeType: mime,
        content: new Uint8Array(Buffer.from(dataB64, 'base64')),
      } as unknown as Attachment);
      emitOutbound(line, sentId, `[${mime.split('/')[0]}: ${name}]`);
      respond(id, { result: { messageId: sentId } });
    } else if (action === 'newDm') {
      const { address } = args as { address: string };
      const dm = await client.conversations.createDmWithIdentifier({
        identifier: address, identifierKind: IdentifierKind.Ethereum,
      });
      respond(id, { result: { line: lineOf(dm.id), id: dm.id } });
    } else if (action === 'newGroup') {
      const { addresses, name } = args as { addresses: string[]; name?: string };
      const group = await client.conversations.createGroupWithIdentifiers(
        addresses.map(a => ({ identifier: a, identifierKind: IdentifierKind.Ethereum })),
        name ? { name } : undefined,
      );
      respond(id, { result: { line: lineOf(group.id), id: group.id } });
    } else respond(id, { error: `unknown action '${action}' (have: send, react, reply, sendAttachment, newDm, newGroup)` });
  } catch (err) { respond(id, { error: (err as Error).message }); }
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    try { const msg = JSON.parse(line); if (msg.op === 'call') void handleCall(msg); }
    catch (err) { process.stderr.write(`bad stdin line: ${(err as Error).message}\n`); }
  }
});

/** Sync once on boot so existing conversations are in the local store, then keep syncing
 *  every 15 s so brand-new conversations are discovered. */
await client.conversations.syncAll([ConsentState.Allowed, ConsentState.Unknown]);
const initialConvs = await client.conversations.list();
process.stderr.write(`xmtp train: synced ${initialConvs.length} conversation(s) at boot\n`);
const SYNC_MS = Number(process.env.XMTP_SYNC_MS ?? '15000');
setInterval(async () => {
  try { await client.conversations.syncAll([ConsentState.Allowed, ConsentState.Unknown]); }
  catch (err) { process.stderr.write(`xmtp sync error: ${(err as Error).message}\n`); }
}, SYNC_MS).unref();

/** New-conversation stream — logs only; the message stream below catches the actual messages. */
void (async () => {
  try {
    const convStream = await client.conversations.stream();
    for await (const conv of convStream) {
      if (!conv) continue;
      process.stderr.write(`xmtp train: new conv ${conv.id}\n`);
    }
  } catch (err) { process.stderr.write(`xmtp conv stream error: ${(err as Error).message}\n`); }
})();

/** Main loop: stream every inbound message (incl. Unknown-consent) and emit it. */
const stream = await client.conversations.streamAllMessages({
  consentStates: [ConsentState.Allowed, ConsentState.Unknown],
});
/** Content types that are purely client-side state — never useful as a metro event because
 *  they don't carry user-visible content. Drop them at the stream rather than emitting noise. */
const SILENT_TYPES = new Set(['readReceipt', 'transactionReference', 'walletSendCalls', 'groupUpdated']);
for await (const msg of stream) {
  if (!msg) continue;
  /** Drop our own outbound echoes — the action handlers emit those above via `emitOutbound`. */
  if (msg.senderInboxId === client.inboxId) continue;
  if (SILENT_TYPES.has(msg.contentType?.typeId ?? '')) continue;
  const conv = await client.conversations.getConversationById(msg.conversationId);
  if (!conv) continue;
  emit(envelope(msg, conv));
}
