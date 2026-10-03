import {
  binaryBytes, binaryString, decodeBase64Loose, decodeCharset, decodeQuotedPrintable, headerText, parseHeaderBlock,
  parseParams, type HeaderParams, type MailHeaders,
} from './mimeHeaders';

export interface MailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  content: Uint8Array;
  contentId: string | null;
  inline: boolean;
}

export interface ParsedMail {
  from: string;
  to: string;
  cc: string;
  subject: string;
  date: string;
  text: string | null;
  html: string | null;
  attachments: MailAttachment[];
}

interface Part {
  headers: MailHeaders;
  body: string;
}

interface Collected {
  text: string[];
  html: string[];
  attachments: MailAttachment[];
  parts: number;
}

const MAX_DEPTH = 10;
const MAX_PARTS = 500;
const BODY_TYPES: Readonly<Record<string, 'text' | 'html'>> = { 'text/plain': 'text', 'text/html': 'html' };
const EXTENSIONS: Readonly<Record<string, string>> = {
  'message/rfc822': 'eml', 'text/calendar': 'ics', 'text/plain': 'txt', 'text/html': 'html', 'application/pdf': 'pdf',
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp',
};

function splitPart(source: string): Part {
  if (/^\r?\n/.test(source)) return { headers: new Map(), body: source.replace(/^\r?\n/, '') };
  const gap = /\r?\n\r?\n/.exec(source);
  if (gap === null) return { headers: parseHeaderBlock(source), body: '' };
  return { headers: parseHeaderBlock(source.slice(0, gap.index)), body: source.slice(gap.index + gap[0].length) };
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');
}

function withoutTrailingNewline(text: string): string {
  if (text.endsWith('\r\n')) return text.slice(0, -2);
  return text.endsWith('\n') ? text.slice(0, -1) : text;
}

function multipartBodies(body: string, boundary: string): string[] {
  const delimiter = new RegExp(`^--${escapeRegExp(boundary)}(--)?[ \\t\\r]*$`, 'gm');
  const parts: string[] = [];
  let start = -1;
  for (const match of body.matchAll(delimiter)) {
    if (start >= 0) parts.push(withoutTrailingNewline(body.slice(start, match.index)));
    if (match[1] === '--') return parts;
    start = match.index + match[0].length + 1;
  }
  if (start >= 0) parts.push(body.slice(start));
  return parts;
}

function transferDecode(body: string, encoding: string): Uint8Array {
  const name = encoding.trim().toLowerCase();
  if (name === 'base64') return decodeBase64Loose(body);
  return binaryBytes(name === 'quoted-printable' ? decodeQuotedPrintable(body) : body);
}

function contentIdOf(headers: MailHeaders): string | null {
  const id = (headers.get('content-id') ?? '').trim().replace(/^<|>$/g, '').trim();
  return id === '' ? null : id;
}

function defaultName(mimeType: string, index: number): string {
  return `attachment-${index + 1}.${EXTENSIONS[mimeType] ?? 'bin'}`;
}

function bodyTypeOf(type: HeaderParams, disposition: HeaderParams, filename: string): 'text' | 'html' | null {
  if (disposition.value === 'attachment' || filename !== '') return null;
  return BODY_TYPES[type.value] ?? null;
}

function attachmentOf(part: Part, mimeType: string, filename: string, disposition: string, index: number): MailAttachment {
  const content = transferDecode(part.body, part.headers.get('content-transfer-encoding') ?? '');
  const contentId = contentIdOf(part.headers);
  return {
    filename: filename === '' ? defaultName(mimeType, index) : filename,
    mimeType, size: content.byteLength, content, contentId,
    inline: disposition === 'inline' || (disposition === '' && contentId !== null),
  };
}

function collectLeaf(part: Part, type: HeaderParams, out: Collected): void {
  const disposition = parseParams(part.headers.get('content-disposition') ?? '');
  const filename = (disposition.params.get('filename') ?? type.params.get('name') ?? '').trim();
  const bodyType = bodyTypeOf(type, disposition, filename);
  if (bodyType !== null) {
    const content = transferDecode(part.body, part.headers.get('content-transfer-encoding') ?? '');
    out[bodyType].push(decodeCharset(content, type.params.get('charset') ?? 'utf-8'));
    return;
  }
  const mimeType = type.value === '' ? 'application/octet-stream' : type.value;
  out.attachments.push(attachmentOf(part, mimeType, filename, disposition.value, out.attachments.length));
}

function walk(part: Part, depth: number, out: Collected): void {
  out.parts += 1;
  if (out.parts > MAX_PARTS) return;
  const type = parseParams(part.headers.get('content-type') ?? 'text/plain');
  const boundary = type.params.get('boundary');
  if (!type.value.startsWith('multipart/') || boundary === undefined || boundary === '') {
    collectLeaf(part, type, out);
    return;
  }
  if (depth >= MAX_DEPTH) return;
  for (const body of multipartBodies(part.body, boundary)) walk(splitPart(body), depth + 1, out);
}

export function parseMail(raw: Uint8Array): ParsedMail {
  const root = splitPart(binaryString(raw));
  const out: Collected = { text: [], html: [], attachments: [], parts: 0 };
  walk(root, 0, out);
  const header = (name: string): string => headerText(root.headers.get(name) ?? '');
  return {
    from: header('from'),
    to: header('to'),
    cc: header('cc'),
    subject: header('subject'),
    date: header('date'),
    text: out.text.length > 0 ? out.text.join('\n\n') : null,
    html: out.html.length > 0 ? out.html.join('\n') : null,
    attachments: out.attachments,
  };
}
