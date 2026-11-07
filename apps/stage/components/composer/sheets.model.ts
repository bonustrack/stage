import { errorMessage } from '@stage-labs/client/errors';
import { isAddress } from 'viem';
import type { PollContent } from '@stage-labs/client/xmtp/poll';
import { buildEip712SignatureRequest, buildPersonalSignatureRequest, type SignatureRequestContent } from '@stage-labs/client/xmtp/sign';

export interface PollDraft {
  question: string;
  header: string;
  options: string[];
  multi: boolean;
}
export interface SignatureDraft {
  kind: 'personal' | 'eip712';
  desc: string;
  message: string;
  json: string;
}
export interface PaymentDraft {
  to: string;
  amount: string;
  note: string;
}

export type DraftCheck<T> = { filled: boolean } & ({ ok: true; value: T } | { ok: false; message: string });

export const SIGNATURE_KINDS: readonly { value: SignatureDraft['kind']; label: string }[] = [
  { value: 'personal', label: 'Message' },
  { value: 'eip712', label: 'Typed data' },
];

const filled = (s: string): boolean => s.trim() !== '';

export function checkSignatureDraft(d: SignatureDraft): DraftCheck<SignatureRequestContent> {
  const hasContent = filled(d.kind === 'personal' ? d.message : d.json);
  try {
    const value = d.kind === 'personal' ? buildPersonalSignatureRequest(d.message, d.desc) : buildEip712SignatureRequest(d.json, d.desc);
    return { filled: hasContent, ok: true, value };
  } catch (e) {
    return { filled: hasContent, ok: false, message: errorMessage(e) };
  }
}

export function checkPollDraft(d: PollDraft): DraftCheck<Omit<PollContent, 'pollId'>> {
  const question = d.question.trim();
  const options = d.options.map((o) => o.trim()).filter(Boolean);
  if (!question || options.length < 2) return { filled: false, ok: false, message: 'Add a question and at least 2 options' };
  const value = {
    question,
    ...(d.header.trim() ? { header: d.header.trim() } : {}),
    options: options.map((label) => ({ label })),
    ...(d.multi ? { multiSelect: true } : {}),
  };
  return { filled: true, ok: true, value };
}

interface PaymentFields {
  to: string;
  amount: string;
  units: number;
}

export function checkPaymentDraft(d: PaymentDraft): DraftCheck<PaymentFields> {
  const to = d.to.trim();
  const amount = d.amount.trim();
  const hasContent = to !== '' && amount !== '';
  if (!isAddress(to)) return { filled: hasContent, ok: false, message: 'Enter a valid recipient address' };
  const units = Number(amount);
  if (!isFinite(units) || units <= 0) return { filled: hasContent, ok: false, message: 'Enter a valid amount' };
  return { filled: hasContent, ok: true, value: { to, amount, units } };
}
