import { hasRemoteImages, mailHtmlBlocks, mailTextBlocks, type MailBlock } from '@stage-labs/client/mail/mailHtml';
import { mailAddressOf, type MailIndex } from '@stage-labs/client/mail/mailbox';
import type { MailAttachment, ParsedMail } from '@stage-labs/client/mail/mime';
import { decodeWords, parseAddress } from '@stage-labs/client/mail/mimeHeaders';
import { bytesToBase64 } from '@stage-labs/client/text/base64';
import { fileCardModel } from '../bubble/fileCard.model';

export interface InboxEntry {
  label: string;
  id: string;
  ts: number;
  size: number;
  index: MailIndex | null;
}

export interface InboxRow {
  key: string;
  label: string;
  id: string;
  ts: number;
  sender: string;
  subject: string;
  unread: boolean;
  to: string | null;
}

export interface MailAttachmentRow {
  key: string;
  title: string;
  subtitle: string;
  attachment: MailAttachment;
}

export interface MailBody {
  blocks: MailBlock[];
  remoteImages: boolean;
  attachments: MailAttachmentRow[];
}

const MAX_READ_KEYS = 2000;
const INLINE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const MAIL_ID_TS = /^(\d{13})-/;
const UNSAFE_FILE_CHARS = /[\\/:*?"<>|]/g;

export function mailReadKey(label: string, id: string): string {
  return `${label}/${id}`;
}

export function senderLabel(from: string): string {
  const address = parseAddress(decodeWords(from));
  return address.name || address.address || 'Unknown sender';
}

export function subjectLabel(subject: string): string {
  const text = decodeWords(subject).trim();
  return text === '' ? '(no subject)' : text;
}

function inboxRow(entry: InboxEntry, read: ReadonlySet<string>, showTo: boolean): InboxRow {
  const key = mailReadKey(entry.label, entry.id);
  const index = entry.index;
  return {
    key, label: entry.label, id: entry.id, ts: entry.ts,
    sender: index === null ? 'Unreadable mail' : senderLabel(index.from || index.envelopeFrom),
    subject: index === null ? 'This mail could not be decrypted on this device.' : subjectLabel(index.subject),
    unread: !read.has(key),
    to: showTo ? mailAddressOf(entry.label) : null,
  };
}

export function inboxRows(entries: readonly InboxEntry[], read: ReadonlySet<string>, mailboxCount: number): InboxRow[] {
  return [...entries]
    .sort((a, b) => b.ts - a.ts || b.id.localeCompare(a.id))
    .map((entry) => inboxRow(entry, read, mailboxCount > 1));
}

export function withReadKey(keys: readonly string[], key: string): readonly string[] {
  if (keys.includes(key)) return keys;
  return [...keys, key].slice(-MAX_READ_KEYS);
}

export function parseReadKeys(raw: string): readonly string[] | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === 'string') : undefined;
  } catch {
    return undefined;
  }
}

export function mailReceivedAt(id: string): number | null {
  const ts = Number(MAIL_ID_TS.exec(id)?.[1]);
  return Number.isFinite(ts) && ts > 0 ? ts : null;
}

export function mailDataUri(attachment: MailAttachment): string {
  return `data:${attachment.mimeType};base64,${bytesToBase64(attachment.content)}`;
}

export function safeFileName(name: string): string {
  const clean = Array.from(name.replace(UNSAFE_FILE_CHARS, '_')).filter((ch) => ch.charCodeAt(0) >= 0x20).join('').trim();
  return clean === '' || clean === '.' || clean === '..' ? 'attachment' : clean.slice(0, 200);
}

function isInlineImage(attachment: MailAttachment): boolean {
  return attachment.inline && attachment.contentId !== null && attachment.mimeType.startsWith('image/');
}

function inlineImages(attachments: readonly MailAttachment[]): Map<string, string> {
  const inline = new Map<string, string>();
  for (const attachment of attachments) {
    if (attachment.contentId !== null && attachment.mimeType.startsWith('image/') && attachment.size <= INLINE_IMAGE_MAX_BYTES) {
      inline.set(attachment.contentId, mailDataUri(attachment));
    }
  }
  return inline;
}

function attachmentRow(attachment: MailAttachment, index: number): MailAttachmentRow {
  const card = fileCardModel({ name: attachment.filename, mime: attachment.mimeType, size: attachment.size, kind: 'file' });
  return { key: `${index}:${attachment.filename}`, title: card.title, subtitle: card.subtitle, attachment };
}

export function mailBody(mail: ParsedMail): MailBody {
  const html = mail.html === null ? [] : mailHtmlBlocks(mail.html, inlineImages(mail.attachments));
  const blocks = html.length > 0 ? html : mailTextBlocks(mail.text ?? '');
  const shownInline = html.length > 0;
  return {
    blocks,
    remoteImages: hasRemoteImages(blocks),
    attachments: mail.attachments
      .filter((attachment) => !(shownInline && isInlineImage(attachment)))
      .map(attachmentRow),
  };
}

export function visibleBlocks(blocks: readonly MailBlock[], showImages: boolean): MailBlock[] {
  return blocks.filter((block) => showImages || block.type !== 'image' || !block.remote);
}

export function mailDateLabel(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}
