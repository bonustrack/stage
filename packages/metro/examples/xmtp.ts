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
 *   cd ~/.metro && bun add @xmtp/node-sdk viem
 *   cp <this-file> ~/.metro/trains/xmtp.ts
 *   # Generate a private key (e.g. `bun -e "console.log('0x'+crypto.getRandomValues(new Uint8Array(32)).reduce((s,b)=>s+b.toString(16).padStart(2,'0'),''))"`) — keep it safe.
 *   echo 'XMTP_PRIVATE_KEY=0x…' >> ~/.metro/.env
 *   echo 'XMTP_ENV=production' >> ~/.metro/.env   # or "dev"
 *   metro
 */

import { Client, IdentifierKind, type Conversation, type DecodedMessage, type Signer } from '@xmtp/node-sdk';
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

const account = privateKeyToAccount(PK as `0x${string}`);
const signer: Signer = {
  type: 'EOA',
  getIdentifier: async () => ({ identifier: account.address, identifierKind: IdentifierKind.Ethereum }),
  signMessage: async (msg: string) => {
    const sig = await account.signMessage({ message: msg });
    /** XMTP wants raw bytes — strip 0x and decode. */
    const hex = sig.slice(2);
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return out;
  },
};

const client = await Client.create(signer, { env: XMTP_ENV });
process.stderr.write(`xmtp train ready — inbox ${client.inboxId} (${account.address}, env=${XMTP_ENV})\n`);

function envelope(msg: DecodedMessage, conv: Conversation): Record<string, unknown> {
  const senderInbox = msg.senderInboxId;
  return {
    kind: 'inbound', id: mintId(), ts: msg.sentAt.toISOString(),
    station: 'xmtp', line: lineOf(conv.id),
    from: `metro://xmtp/user/${senderInbox}`,
    message_id: msg.id,
    text: typeof msg.content === 'string' ? msg.content : '[non-text payload]',
    payload: { senderInbox, contentType: msg.contentType?.typeId, raw: msg.content },
  };
}

const emitOutbound = (line: string, messageId: string, text: string): void => emit({
  kind: 'outbound', id: mintId(), ts: new Date().toISOString(),
  station: 'xmtp', line, from: SELF_URI, to: line, message_id: messageId, text,
});

type CallMsg = { op: 'call'; id: string; action: string; args: Record<string, unknown> };
async function handleCall({ id, action, args }: CallMsg): Promise<void> {
  try {
    if (action === 'send') {
      const { line, text } = args as { line: string; text: string };
      const convId = line.match(/^metro:\/\/xmtp\/([^/]+)$/)?.[1];
      if (!convId) throw new Error(`bad xmtp line: ${line}`);
      const conv = await client.conversations.getConversationById(convId);
      if (!conv) throw new Error(`conversation ${convId} not found`);
      const messageId = await conv.send(text);
      emitOutbound(line, messageId, text);
      respond(id, { result: { messageId } });
    } else if (action === 'newDm') {
      /** Create a 1:1 conversation with a wallet address. Returns the new line. */
      const { address } = args as { address: string };
      const dm = await client.conversations.newDmWithIdentifier({
        identifier: address, identifierKind: IdentifierKind.Ethereum,
      });
      respond(id, { result: { line: lineOf(dm.id), id: dm.id } });
    } else if (action === 'newGroup') {
      /** Create a group conversation with multiple wallets. */
      const { addresses, name } = args as { addresses: string[]; name?: string };
      const group = await client.conversations.newGroupWithIdentifiers(
        addresses.map(a => ({ identifier: a, identifierKind: IdentifierKind.Ethereum })),
        name ? { name } : undefined,
      );
      respond(id, { result: { line: lineOf(group.id), id: group.id } });
    } else respond(id, { error: `unknown action '${action}' (have: send, newDm, newGroup)` });
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

/** Sync once on boot so existing conversations are in the local store. */
await client.conversations.sync();

/** Stream every inbound message across every conversation we're a member of. */
const stream = await client.conversations.streamAllMessages();
for await (const msg of stream) {
  if (!msg) continue;
  /** Drop our own outbound echoes — the train already emits those above via `emitOutbound`. */
  if (msg.senderInboxId === client.inboxId) continue;
  const conv = await client.conversations.getConversationById(msg.conversationId);
  if (!conv) continue;
  emit(envelope(msg, conv));
}
