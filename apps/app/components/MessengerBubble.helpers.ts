/** Pure helpers, types, and shared module-scope constants for MessengerBubble.
 *  Extracted to keep the bubble component file under the phase-2 lint cap. */

import type { HistoryEntry } from '../lib/types';
import { fontSize } from '@metro-labs/kit/tokens';
import type { RemoteAttachmentInfo } from '@xmtp/react-native-sdk';
import { normalizeQuestions, type PollContent } from '@stage-labs/client/xmtp/poll';
import { formatEther } from 'viem';

export const REACT_PRESETS = ['👍', '🔥', '👀', '🙏', '😁', '💯', '🫡'];

/** Shared markdown-it instance (with metro://`/`stage://` deep-link schemes
 *  registered). Re-exported here so existing importers keep working. */
export { mdParser } from '../lib/mdParser';

/** Matches an `@`-mention stored in the raw message as a bare lowercase address
 *  (the composer's wire form), e.g. `@0x1d8c…0b5b`. Capture group 1 is the
 *  42-char address. The `\b` boundary lets a mention be immediately followed by
 *  punctuation (`@0xabc…, hi`) without swallowing it. Address matching is
 *  case-insensitive so a hand-typed mixed-case address still links. */
export const MENTION_RE = /@(0x[0-9a-fA-F]{40})\b/g;

/** Matches a fenced or inline code span so `unescapeBody` can leave its literal
 *  `\n` untouched (a backslash-n inside code is intentional source, not a broken
 *  line break). Fences first (``` … ```), then inline `` `…` ``. */
const CODE_SPAN_RE = /```[\s\S]*?```|`[^`\n]*`/g;

/** Some senders (a daemon/CLI that JSON-escaped the body, or an agent reply that
 *  was double-stringified) deliver line breaks as the literal 2-char sequence
 *  `\n` (backslash + n) instead of a real newline, so the bubble shows `\n` mid
 *  sentence. Convert those escaped whitespace sequences back to real characters
 *  for display — but ONLY outside code spans, where a literal `\n`/`\t` is part of
 *  the content the author typed. A body with no literal backslash-escape is
 *  returned unchanged (fast path), so correctly-formatted messages are untouched. */
export function unescapeBody(text: string): string {
  if (!text.includes('\\n') && !text.includes('\\t') && !text.includes('\\r')) return text;
  const unescapeRun = (s: string): string =>
    s.replace(/\\r\\n|\\n|\\r/g, '\n').replace(/\\t/g, '\t');
  let out = '';
  let last = 0;
  CODE_SPAN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CODE_SPAN_RE.exec(text)) !== null) {
    out += unescapeRun(text.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  out += unescapeRun(text.slice(last));
  return out;
}

/** Cheap test for the slow (mention-aware) body path. Resets the shared regex's
 *  `lastIndex` (the `g` flag makes `.test()` stateful) so a no-match leaves it at
 *  0 for the next caller. */
export function hasMention(text: string): boolean {
  if (!text.includes('@0x')) return false;
  MENTION_RE.lastIndex = 0;
  const found = MENTION_RE.test(text);
  MENTION_RE.lastIndex = 0;
  return found;
}

/** Shape covers messenger-station attachments (id+url, served by the daemon), XMTP
 *  inline attachments (dataB64 carries the raw bytes — no URL exists), and XMTP
 *  multi-remote attachments (`remote` carries the IPFS URL + decryption metadata;
 *  the bytes are fetched + decrypted lazily by `RemoteAttachmentResolver`). */
export interface Attachment {
  id?: string; url?: string; dataB64?: string; remote?: RemoteAttachmentInfo;
  kind: string; mime?: string; size?: number; name?: string;
}

export function fmtTs(ts: string): string {
  try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); }
  catch { return ts.slice(11, 16); }
}

export function attachmentsOf(entry: HistoryEntry): Attachment[] {
  const p = entry.payload as { attachments?: Attachment[] } | undefined;
  return Array.isArray(p?.attachments) ? p.attachments : [];
}

export function markdownStyles(fg: string, dark: boolean, mine: boolean): Record<string, object> {
  const codeBg = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  /** Tighter leading on the user's own bubble — Less prefers a snugger look there.
   *  Assistant text keeps 23 for comfortable reading on long replies. */
  const lh = mine ? 21 : 23;
  /** Heading sizes MUST live here: the lib flattens styles.headingN into the leaf
   *  <Text>'s inheritedStyles, and that fontSize wins over a wrapping Text (RN: nearest
   *  Text wins), so a <Title> rule wrapper never sized the glyphs. */
  const h = (fontSize: number, lineHeight: number): object =>
    ({ color: fg, fontSize, lineHeight, fontFamily: 'Calibre-Semibold', marginTop: 6, marginBottom: 2 });
  return {
    body: { color: fg, fontSize: fontSize('3xl'), lineHeight: lh, fontFamily: 'Calibre-Medium' },
    paragraph: { marginTop: 0, marginBottom: 0 },
    heading1: h(30, 34), heading2: h(24, 28), heading3: h(21, 25), heading4: h(21, 25), heading5: h(21, 25), heading6: h(21, 25),
    /** Pin family/weight/size/lineHeight on inline marks. The lib defaults strong to
     *  fontWeight:'bold', which makes RN miss the Calibre-Semibold family (registered
     *  as its own family, not a weight); fontWeight:'normal' lets the family win. */
    strong: { fontFamily: 'Calibre-Semibold', fontWeight: 'normal', fontSize: fontSize('md'), lineHeight: lh },
    em: { fontFamily: 'Calibre-Medium', fontStyle: 'italic', fontWeight: 'normal', fontSize: fontSize('md'), lineHeight: lh },
    link: { color: fg, textDecorationLine: 'underline' },
    /** Menlo's em-square is wider than Calibre's, so size down to match. */
    code_inline: { backgroundColor: codeBg, paddingHorizontal: 4, borderRadius: 4, fontFamily: 'Menlo', fontSize: fontSize('xs'), lineHeight: lh },
    fence: { backgroundColor: codeBg, padding: 8, borderRadius: 6, fontFamily: 'Menlo', fontSize: fontSize('2xs'), lineHeight: 18 },
    bullet_list: { marginTop: 2, marginBottom: 2 },
    ordered_list: { marginTop: 2, marginBottom: 2 },
    blockquote: { borderLeftWidth: 3, borderLeftColor: codeBg, paddingLeft: 8, marginVertical: 4 },
  };
}

export interface QuestionOption { label: string; description?: string }
export interface Question {
  header?: string;
  options: QuestionOption[];
  multiSelect?: boolean;
  /** Default true. When true, an "Other…" affordance lets the user type a free-text
   *  answer instead of (or in addition to, for multi-select) the listed options. */
  allowOther?: boolean;
}

export function questionOf(entry: HistoryEntry): Question | undefined {
  const p = entry.payload as { question?: Question } | undefined;
  if (!p?.question || !Array.isArray(p.question.options)) return undefined;
  return p.question;
}

export interface PollOption { label: string; description?: string }
export interface PollQuestion { question: string; header?: string; options: PollOption[]; multiSelect?: boolean; open?: boolean }
/** Normalized poll: non-empty `questions[]`; `question` is the bubble title (q0). */
export interface Poll { pollId?: string; question?: string; questions: PollQuestion[] }

export function pollOf(entry: HistoryEntry): Poll | undefined {
  const raw = (entry.payload as { poll?: PollContent })?.poll;
  if (!raw) return undefined;
  // normalizeQuestions folds BOTH shapes into one array (option strings -> {label}).
  const questions = normalizeQuestions(raw);
  if (questions.length === 0) return undefined;
  return { pollId: raw.pollId, question: questions[0].question, questions };
}

export interface SigRequest {
  id?: string;
  kind?: 'eip712' | 'personal';
  eip712?: { domain?: Record<string, unknown>; types?: Record<string, Array<{ name: string; type: string }>>; primaryType?: string; message?: Record<string, unknown> };
  message?: string;
  description?: string;
}
export interface SigReference {
  requestId?: string;
  signature: string;
  signer?: string;
}

export function sigRequestOf(entry: HistoryEntry): SigRequest | undefined {
  const p = entry.payload as { signatureRequest?: SigRequest } | undefined;
  if (!p?.signatureRequest?.kind) return undefined;
  return p.signatureRequest;
}
export function sigReferenceOf(entry: HistoryEntry): SigReference | undefined {
  const p = entry.payload as { signatureReference?: SigReference } | undefined;
  if (!p?.signatureReference?.signature) return undefined;
  return p.signatureReference;
}

/** Render one EIP-712 message value as a readable string. Scalars pass through
 *  (addresses/hex shown as-is, long hex truncated); nested objects/arrays are
 *  JSON-stringified compactly so a row stays one line-ish. */
export function fmtSigValue(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') {
    // Truncate very long hex (calldata, byte blobs) but keep addresses intact.
    if (/^0x[0-9a-fA-F]{42,}$/.test(v) && v.length > 24) return `${v.slice(0, 12)}…${v.slice(-8)}`;
    return v;
  }
  if (typeof v === 'number' || typeof v === 'bigint' || typeof v === 'boolean') return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 200 ? `${s.slice(0, 197)}…` : s;
  } catch { return String(v); }
}

export interface TxRequest {
  version?: string;
  chainId?: string;
  from?: string;
  calls: Array<{ to?: string; data?: string; value?: string; metadata?: { description?: string; currency?: string; amount?: number; toAddress?: string } }>;
}
export interface TxReceipt {
  networkId: number | string;
  reference: string;
  metadata?: { currency?: string; amount?: number; toAddress?: string };
}

export function txRequestOf(entry: HistoryEntry): TxRequest | undefined {
  const p = entry.payload as { walletSendCalls?: TxRequest } | undefined;
  if (!p?.walletSendCalls || !Array.isArray(p.walletSendCalls.calls)) return undefined;
  return p.walletSendCalls;
}
export function txReceiptOf(entry: HistoryEntry): TxReceipt | undefined {
  const p = entry.payload as { txReference?: TxReceipt } | undefined;
  if (!p?.txReference?.reference) return undefined;
  return p.txReference;
}

/** Block-explorer URL for a chain id (decimal/hex/number) + tx hash. Mirrors
 *  explorerTxUrl in @stage-labs/client/xmtp/tx (re-stated to avoid pulling the
 *  helper through a separate import in the bubble). */
export function explorerUrl(networkId: number | string, txHash: string): string {
  const id = typeof networkId === 'number' ? networkId
    : networkId.startsWith('0x') ? parseInt(networkId, 16) : parseInt(networkId, 10);
  const base: Record<number, string> = {
    1: 'https://etherscan.io', 10: 'https://optimistic.etherscan.io',
    137: 'https://polygonscan.com', 8453: 'https://basescan.org',
    42161: 'https://arbiscan.io', 11155111: 'https://sepolia.etherscan.io',
  };
  return `${base[id] ?? 'https://etherscan.io'}/tx/${txHash}`;
}

/** Format a hex-wei value (from a WalletSendCalls call) as an exact ETH string.
 *  Uses viem `formatEther` (exact bigint -> decimal) rather than float math, then
 *  trims trailing fractional zeros for a short display. */
export function ethFromWeiHex(valueHex?: string): string | undefined {
  if (!valueHex) return undefined;
  try {
    const out = formatEther(BigInt(valueHex));
    return out.includes('.') ? out.replace(/\.?0+$/, '') : out;
  } catch { return undefined; }
}
