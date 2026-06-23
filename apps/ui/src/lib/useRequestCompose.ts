
import { xmtpSendPayment, xmtpSendSignRequest } from './xmtpSend';

type Optimistic = (localId: string, text: string) => void;
type Sent = (localId: string) => void;
type Fail = (msg: string) => void;

function tmpId(): string { return `tmp_${Math.random().toString(36).slice(2, 10)}`; }

export interface PaymentPayload { to: string; amount: string; note: string }
export type SignPayload =
  | { kind: 'personal'; message: string; description: string }
  | { kind: 'eip712'; json: string; description: string };

export function useRequestCompose(
  line: () => string, optimistic: Optimistic, sent: Sent, fail: Fail,
) {
  async function sendPayment(p: PaymentPayload): Promise<void> {
    const localId = tmpId();
    const desc = p.note.trim() || `Send ${p.amount} ETH`;
    optimistic(localId, `[Transaction request] ${desc}`);
    try {
      await xmtpSendPayment(line(), { to: p.to, amount: p.amount, ...(p.note ? { note: p.note } : {}) });
      sent(localId);
    } catch (e) {
      fail((e as Error).message);
    }
  }

  async function sendSignRequest(p: SignPayload): Promise<void> {
    const localId = tmpId();
    const desc = p.description.trim();
    optimistic(localId, desc ? `[Signature request] ${desc}` : '[Signature request]');
    try {
      if (p.kind === 'personal') {
        await xmtpSendSignRequest(line(), { kind: 'personal', message: p.message, ...(desc ? { description: desc } : {}) });
      } else {
        await xmtpSendSignRequest(line(), { kind: 'eip712', json: p.json, ...(desc ? { description: desc } : {}) });
      }
      sent(localId);
    } catch (e) {
      fail((e as Error).message);
    }
  }

  return { sendPayment, sendSignRequest };
}
