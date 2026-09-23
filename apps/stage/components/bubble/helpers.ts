
import type { HistoryEntry } from '@stage-labs/client/types';
import { fontSize } from '@stage-labs/kit/tokens';
import { markdownStyles as kitMarkdownStyles } from '@stage-labs/kit/markdown-styles';
import type { RemoteAttachmentInfo } from '@xmtp/react-native-sdk';
import { normalizeQuestions, type PollContent, type PollQuestion } from '@stage-labs/client/xmtp/poll';
import type { SignatureRequestContent, SignatureReferenceContent } from '@stage-labs/client/xmtp/sign';
import type { WalletSendCallsContent, TransactionReferenceContent } from '@stage-labs/client/xmtp/tx';
import { formatEther } from 'viem';
import { MarkdownIt } from 'react-native-markdown-display';
import { registerDeepLinkSchemas } from '@stage-labs/client/text/markdown';

export const REACT_PRESETS = ['👍', '🔥', '👀', '🙏', '😁', '💯', '🫡'];

export const mdParser = MarkdownIt({ typographer: false, linkify: true, breaks: true });

registerDeepLinkSchemas(mdParser.linkify);

export { hasMention } from '@stage-labs/client/xmtp/mentions';

const CODE_SPAN_RE = /```[\s\S]*?```|`[^`\n]*`/g;

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

export interface Attachment {
  id?: string; url?: string; dataB64?: string; remote?: RemoteAttachmentInfo;
  kind: string; mime?: string; size?: number; name?: string;
}

export function attachmentsOf(entry: HistoryEntry): Attachment[] {
  const p = entry.payload as { attachments?: Attachment[] } | undefined;
  return Array.isArray(p?.attachments) ? p.attachments : [];
}

export function markdownStyles(fg: string, dark: boolean): Record<string, object> {
  return kitMarkdownStyles({ fg, dark, link: fg, fontSize: fontSize('3xl'), lineHeight: 23, paragraphGap: 0 });
}

interface QuestionOption { label: string; description?: string }
export interface Question {
  header?: string;
  options: QuestionOption[];
  multiSelect?: boolean;
  allowOther?: boolean;
}

export function questionOf(entry: HistoryEntry): Question | undefined {
  const p = entry.payload as { question?: Question } | undefined;
  if (!p?.question || !Array.isArray(p.question.options)) return undefined;
  return p.question;
}

export interface Poll { pollId?: string; question?: string; questions: PollQuestion[] }

export function pollOf(entry: HistoryEntry): Poll | undefined {
  const raw = (entry.payload as { poll?: PollContent })?.poll;
  if (!raw) return undefined;
  const questions = normalizeQuestions(raw);
  const first = questions[0];
  if (first === undefined) return undefined;
  return { pollId: raw.pollId, question: first.question, questions };
}

export function sigRequestOf(entry: HistoryEntry): SignatureRequestContent | undefined {
  const p = entry.payload as { signatureRequest?: SignatureRequestContent } | undefined;
  if (!p?.signatureRequest?.kind) return undefined;
  return p.signatureRequest;
}
export function sigReferenceOf(entry: HistoryEntry): SignatureReferenceContent | undefined {
  const p = entry.payload as { signatureReference?: SignatureReferenceContent } | undefined;
  if (!p?.signatureReference?.signature) return undefined;
  return p.signatureReference;
}

export function fmtSigValue(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') {
    if (/^0x[0-9a-fA-F]{42,}$/.test(v) && v.length > 24) return `${v.slice(0, 12)}…${v.slice(-8)}`;
    return v;
  }
  if (typeof v === 'number' || typeof v === 'bigint' || typeof v === 'boolean') return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 200 ? `${s.slice(0, 197)}…` : s;
  } catch { return '[unserializable]'; }
}

export function txRequestOf(entry: HistoryEntry): WalletSendCallsContent | undefined {
  const p = entry.payload as { walletSendCalls?: WalletSendCallsContent } | undefined;
  if (!p?.walletSendCalls || !Array.isArray(p.walletSendCalls.calls)) return undefined;
  return p.walletSendCalls;
}
export function txReceiptOf(entry: HistoryEntry): TransactionReferenceContent | undefined {
  const p = entry.payload as { txReference?: TransactionReferenceContent } | undefined;
  if (!p?.txReference?.reference) return undefined;
  return p.txReference;
}

export function ethFromWeiHex(valueHex?: string): string | undefined {
  if (!valueHex) return undefined;
  try {
    const out = formatEther(BigInt(valueHex));
    return out.includes('.') ? out.replace(/\.?0+$/, '') : out;
  } catch { return undefined; }
}
