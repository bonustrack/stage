import type { PaymentDraft, PollDraft, SignatureDraft } from './builders';

export const SIGNATURE_KINDS: readonly { value: SignatureDraft['kind']; label: string }[] = [
  { value: 'personal', label: 'Message' },
  { value: 'eip712', label: 'Typed data' },
];

const filled = (s: string): boolean => s.trim() !== '';

export function canSendSignature(d: SignatureDraft): boolean {
  return filled(d.kind === 'personal' ? d.message : d.json);
}

export function canSendPoll(d: PollDraft): boolean {
  return filled(d.question) && d.options.filter(filled).length >= 2;
}

export function canSendPayment(d: PaymentDraft): boolean {
  return filled(d.to) && filled(d.amount);
}
