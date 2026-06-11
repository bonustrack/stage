/** XMTP outbound action handler: send-family actions + handleCall dispatch. */

import { ReactionAction, ReactionSchema } from '@xmtp/node-sdk';
import type { Reply } from '@xmtp/content-type-reply';
import { AttachmentCodec, type Attachment } from '@xmtp/content-type-remote-attachment';
import { WalletSendCallsCodec, type WalletSendCallsParams } from '@xmtp/content-type-wallet-send-calls';
import { toHex, parseUnits, encodeFunctionData } from 'viem';
import { convOf } from './accounts.js';
import { resolveMsgId, respond } from './wire.js';
import { emitOutbound } from './emit.js';
import {
  PollCodec, buildPollContent, SignatureRequestCodec, type SignatureRequestContent,
} from './codecs.js';
import { convHandlers } from './actions-conv.js';
import { normalizeXmtp } from '../messaging-normalize.js';
import { unsupported } from '../../messaging.js';
import { TrainError, serializeTrainError } from '../../train-error.js';

type Args = Record<string, unknown>;

/** Structured "conversation not found" (#3): callers branch on NOT_FOUND. */
const noConv = (line: string): TrainError =>
  new TrainError('NOT_FOUND', `conversation not found for ${line}`);
/** Structured bad-args (#3): callers branch on INVALID_ARGS. */
const badArgs = (message: string): TrainError => new TrainError('INVALID_ARGS', message);

async function send(id: string, args: Args): Promise<void> {
  const { line, text } = args as { line: string; text: string };
  const { acct, conv } = await convOf(line);
  if (!conv) throw noConv(line);
  const messageId = await conv.sendText(text);
  emitOutbound(acct.cfg.id, line, messageId, text);
  respond(id, { result: { messageId } });
}

/** Ask (poll, mirrors Claude AskUserQuestion). Single { question, options[], header?,
 *  multiSelect? } OR multi { questions: [...] }; a question may set `open:true` for a
 *  FREE-TEXT answer (options then optional). See buildPollContent. Alias: sendPoll. */
async function ask(id: string, args: Args): Promise<void> {
  const { line, pollId } = args as { line: string; pollId?: string };
  const { acct, conv } = await convOf(line);
  if (!conv) throw noConv(line);
  const fallbackId = `poll_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const mintedId = pollId ?? (typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : fallbackId);
  const { poll, title } = buildPollContent(args, mintedId);
  const sentId = await conv.send(new PollCodec().encode(poll));
  emitOutbound(acct.cfg.id, line, sentId, `📊 Poll: ${title}`);
  respond(id, { result: { messageId: sentId, pollId: mintedId } });
}

async function react(id: string, args: Args): Promise<void> {
  const { line, messageId, emoji, action: reactAction, schema: reactSchema } = args as {
    line: string; messageId: string; emoji: string;
    action?: 'added' | 'removed'; schema?: string; referenceInboxId?: string };
  const { acct, conv } = await convOf(line);
  if (!conv) throw noConv(line);
  const xmtpMsgId = resolveMsgId(messageId); // #2: accept universal msg_* or raw id
  let refInbox = (args as { referenceInboxId?: string }).referenceInboxId;
  if (!refInbox) {
    /** #9: bounded — search recent messages (newest first), not the whole history. */
    const recent = await conv.messages({ limit: 200, direction: 1 } as Parameters<typeof conv.messages>[0]);
    refInbox = recent.find(m => m.id === xmtpMsgId)?.senderInboxId;
    if (!refInbox) throw new TrainError('NOT_FOUND', `could not resolve referenceInboxId for ${xmtpMsgId}`);
  }
  // A poll vote is a custom-schema reaction whose content is the option index;
  // default (no schema) is a plain unicode emoji reaction.
  const schemaEnum = reactSchema === 'custom' ? ReactionSchema.Custom
    : reactSchema === 'shortcode' ? ReactionSchema.Shortcode : ReactionSchema.Unicode;
  const sentId = await conv.sendReaction({
    reference: xmtpMsgId, referenceInboxId: refInbox,
    action: reactAction === 'removed' ? ReactionAction.Removed : ReactionAction.Added,
    content: emoji, schema: schemaEnum });
  emitOutbound(acct.cfg.id, line, sentId, `[react ${emoji}${reactAction === 'removed' ? ' (removed)' : ''}]`,
    { type: 'react', emoji, targetId: xmtpMsgId });
  respond(id, { result: { messageId: sentId } });
}

async function reply(id: string, args: Args): Promise<void> {
  const { line, replyTo, text } = args as { line: string; replyTo: string; text: string };
  const { acct, conv } = await convOf(line);
  if (!conv) throw noConv(line);
  const { encodeText } = await import('@xmtp/node-bindings');
  const xmtpReplyTo = resolveMsgId(replyTo); // #2: universal or raw id
  const sentId = await conv.sendReply({
    reference: xmtpReplyTo, content: encodeText(text),
    contentType: { authorityId: 'xmtp.org', typeId: 'text', versionMajor: 1, versionMinor: 0 },
  } as unknown as Reply);
  emitOutbound(acct.cfg.id, line, sentId, text, { type: 'reply', replyTo: xmtpReplyTo });
  respond(id, { result: { messageId: sentId } });
}

async function sendAttachment(id: string, args: Args): Promise<void> {
  const { line, name, mime, dataB64 } = args as { line: string; name: string; mime: string; dataB64: string };
  const { acct, conv } = await convOf(line);
  if (!conv) throw noConv(line);
  const sentId = await conv.sendAttachment({
    filename: name, mimeType: mime, content: new Uint8Array(Buffer.from(dataB64, 'base64')),
  } as unknown as Attachment);
  emitOutbound(acct.cfg.id, line, sentId, `[${mime.split('/')[0]}: ${name}]`);
  respond(id, { result: { messageId: sentId } });
}

async function sendImage(id: string, args: Args): Promise<void> {
  const { line, path, dataB64, filename, mimeType } = args as {
    line: string; path?: string; dataB64?: string; filename?: string; mimeType?: string };
  const { acct, conv } = await convOf(line);
  if (!conv) throw noConv(line);
  let bytes: Uint8Array;
  if (path) { const { readFileSync } = await import('node:fs'); bytes = new Uint8Array(readFileSync(path)); }
  else if (dataB64) bytes = new Uint8Array(Buffer.from(dataB64, 'base64'));
  else throw badArgs('sendImage requires path or dataB64');
  const ext = (filename ?? path ?? '').toLowerCase().split('.').pop() ?? '';
  const mime = mimeType ?? (
    ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif'
      : ext === 'webp' ? 'image/webp' : 'image/png');
  const fname = filename ?? (path ? (path.split('/').pop() || 'image.png') : 'image.png');
  const attachment: Attachment = { filename: fname, mimeType: mime, data: bytes };
  const sentId = await conv.send(new AttachmentCodec().encode(attachment));
  emitOutbound(acct.cfg.id, line, sentId, `[${mime.split('/')[0]}: ${fname}]`);
  respond(id, { result: { messageId: sentId } });
}

const ERC20_TRANSFER_ABI = [{
  name: 'transfer', type: 'function', stateMutability: 'nonpayable',
  inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
  outputs: [{ name: '', type: 'bool' }],
}] as const;

/** Payment request as a WalletSendCalls. Native ETH (default) sends `value` to
 *  `to`; ERC20 (when `token` is given) sets call.to=token contract, value=0x0,
 *  and data=transfer(to, amount). The card derives its amount/currency from
 *  metadata, so both carry { amount (human number), currency, decimals, toAddress }. */
async function sendTxRequest(id: string, args: Args): Promise<void> {
  const { line, to, amount, amountEth, note, chainId, token, decimals, currency } = args as {
    line: string; to: string; amount?: number; amountEth?: number; note?: string;
    chainId?: number | string; token?: string; decimals?: number; currency?: string };
  const { acct, conv } = await convOf(line);
  if (!conv) throw noConv(line);
  if (!to || typeof to !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(to)) {
    throw badArgs('sendTxRequest requires a valid 0x `to` address');
  }
  const human = typeof amount === 'number' ? amount : amountEth;
  if (typeof human !== 'number' || !(human > 0)) throw badArgs('sendTxRequest requires a positive `amount`');
  const dec = typeof decimals === 'number' ? decimals : 18;
  const sym = currency ?? 'ETH';
  let call: WalletSendCallsParams['calls'][number];
  if (token) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(token)) throw badArgs('sendTxRequest `token` must be a valid 0x contract address');
    const data = encodeFunctionData({
      abi: ERC20_TRANSFER_ABI, functionName: 'transfer',
      args: [to as `0x${string}`, parseUnits(String(human), dec)],
    });
    call = {
      to: token as `0x${string}`, value: '0x0', data,
      metadata: {
        description: note ?? 'Payment request', transactionType: 'transfer',
        currency: sym, amount: human, decimals: dec, toAddress: to,
      },
    };
  } else {
    const weiHex = toHex(parseUnits(String(human), dec));
    call = {
      to: to as `0x${string}`, value: weiHex,
      metadata: {
        description: note ?? 'Payment request', transactionType: 'transfer',
        currency: sym, amount: human, decimals: dec, toAddress: to,
      },
    };
  }
  const chainHex = (typeof chainId === 'string' && chainId.startsWith('0x'))
    ? (chainId as `0x${string}`) : toHex(chainId ?? 1);
  const content: WalletSendCallsParams = {
    version: '1.0', chainId: chainHex, from: acct.address as `0x${string}`, calls: [call],
  };
  const sentId = await conv.send(new WalletSendCallsCodec().encode(content));
  emitOutbound(acct.cfg.id, line, sentId, `💸 ${note ?? 'Payment request'} (${human} ${sym})`);
  respond(id, { result: { messageId: sentId } });
}

async function sendSignatureRequest(id: string, args: Args): Promise<void> {
  const { line, kind, eip712, message, description } = args as {
    line: string; kind?: 'eip712' | 'personal'; eip712?: unknown; message?: string; description?: string };
  const { acct, conv } = await convOf(line);
  if (!conv) throw noConv(line);
  const k: 'eip712' | 'personal' = kind === 'eip712' ? 'eip712' : 'personal';
  if (k === 'eip712' && !eip712) throw badArgs('sendSignatureRequest eip712 requires an `eip712` typed-data object');
  if (k === 'personal' && (!message || typeof message !== 'string')) {
    throw badArgs('sendSignatureRequest personal requires a `message` string');
  }
  const content: SignatureRequestContent = {
    id: 'sig_' + Date.now().toString(36), kind: k, ...(k === 'eip712' ? { eip712 } : { message }), description };
  const sentId = await conv.send(new SignatureRequestCodec().encode(content));
  emitOutbound(acct.cfg.id, line, sentId, `✍️ ${description ?? 'Signature request'}`);
  respond(id, { result: { messageId: sentId } });
}

async function accountsAction(id: string): Promise<void> {
  const { accounts } = await import('./accounts.js');
  respond(id, { result: { accounts: [...accounts.values()].map(a => ({
    id: a.cfg.id, address: a.address, inboxId: a.inboxId, env: a.cfg.env ?? 'production',
    owner: a.cfg.owner ?? null,
    keySource: typeof a.cfg.derive === 'number' ? `derive:${a.cfg.derive}` : 'privateKey' })) } });
}

// XMTP has no native edit/delete (immutable message log) — answer the canonical
// verb with a uniform unsupported error rather than an "unknown action".
async function unsupportedVerb(id: string, verb: string): Promise<void> {
  respond(id, { error: unsupported(verb, 'xmtp') });
}

const handlers: Record<string, (id: string, args: Args) => Promise<void>> = {
  accounts: (id) => accountsAction(id),
  send, ask, sendPoll: ask, react, reply, sendAttachment, sendImage, sendTxRequest, sendSignatureRequest,
  edit: (id) => unsupportedVerb(id, 'edit'),
  delete: (id) => unsupportedVerb(id, 'delete'),
  ...convHandlers,
};

const KNOWN = 'accounts, send, ask, sendImage, sendTxRequest, react, reply, sendAttachment, '
  + 'newDm, newGroup, createRequestGroup, setLabels, setGithub, setPreview, updateChannelMeta, closeGroup, query, groupInfo, listConvs, '
  + 'register-push, list-push, test-push, unregister-push';

type CallMsg = { op: 'call'; id: string; action: string; args: Args };

export async function handleCall(msg: CallMsg): Promise<void> {
  const { id } = msg;
  const { action, args } = normalizeXmtp(msg.action, msg.args);
  try {
    const h = handlers[action];
    if (h) await h(id, args);
    else respond(id, { error: `unknown action '${action}' (have: ${KNOWN})` });
  } catch (err) {
    // TrainError → legacy string + structured errorInfo (#3); plain Error →
    // legacy string only, byte-identical to pre-#3 behaviour.
    respond(id, serializeTrainError(err));
  }
}
