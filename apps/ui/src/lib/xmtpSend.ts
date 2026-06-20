
import {
  ReactionAction, ReactionSchema, encodeText,
  type Reaction, type Reply, type Attachment as AttachmentContent,
} from '@xmtp/browser-sdk';
import {
  convOfLine, getCachedXmtpClient, getOrCreateXmtpClient,
} from './xmtp';

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function xmtpSendText(line: string, text: string): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  return await conv.sendText(text);
}

export async function xmtpReact(
  line: string, messageId: string, emoji: string, action: 'added' | 'removed' = 'added',
): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  const payload: Reaction = {
    reference: messageId,
    referenceInboxId: client.inboxId ?? '',
    action: action === 'added' ? ReactionAction.Added : ReactionAction.Removed,
    content: emoji,
    schema: ReactionSchema.Unicode,
  };
  return await conv.sendReaction(payload);
}

export async function xmtpReply(line: string, replyTo: string, text: string): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  const encoded = await encodeText(text);
  const reply: Reply = { content: encoded, reference: replyTo };
  return await conv.sendReply(reply);
}

export async function xmtpSendAttachment(
  line: string, filename: string, mimeType: string, dataB64: string,
): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  const att: AttachmentContent = { filename, mimeType, content: base64ToBytes(dataB64) };
  return await conv.sendAttachment(att);
}
