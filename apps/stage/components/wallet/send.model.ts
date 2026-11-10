import type { Hex } from 'viem';

export type SendTx =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'failed'; error: string }
  | { kind: 'pending'; hash: Hex; chainId: number }
  | { kind: 'confirmed'; hash: Hex; chainId: number }
  | { kind: 'unconfirmed'; hash: Hex; chainId: number; error: string };

export type SendTxEvent =
  { type: 'submit' } | { type: 'broadcast'; hash: Hex; chainId: number } | { type: 'confirmed' } | { type: 'failed'; error: string };

export interface SendTxStatus {
  label: string;
  hash: Hex;
  chainId: number;
}

export const SEND_TX_IDLE: SendTx = { kind: 'idle' };

const UNCONFIRMED_NOTE = 'Your transfer was sent, but Stage could not confirm it. Check the explorer before you send it again.';

export function sendTx(state: SendTx, event: SendTxEvent): SendTx {
  switch (event.type) {
    case 'submit':
      return sendTxCanSubmit(state) ? { kind: 'submitting' } : state;
    case 'broadcast':
      return state.kind === 'submitting' ? { kind: 'pending', hash: event.hash, chainId: event.chainId } : state;
    case 'confirmed':
      return state.kind === 'pending' ? { kind: 'confirmed', hash: state.hash, chainId: state.chainId } : state;
    case 'failed':
      if (state.kind === 'submitting') return { kind: 'failed', error: event.error };
      if (state.kind === 'pending') return { kind: 'unconfirmed', hash: state.hash, chainId: state.chainId, error: event.error };
      return state;
  }
}

export function sendTxCanSubmit(state: SendTx): boolean {
  return state.kind === 'idle' || state.kind === 'failed';
}

export function sendTxSent(state: SendTx): boolean {
  return state.kind === 'confirmed' || state.kind === 'unconfirmed';
}

export function sendTxBusy(state: SendTx): boolean {
  return state.kind === 'submitting' || state.kind === 'pending';
}

export function sendTxSubmitLabel(state: SendTx, reviewing: boolean): string {
  switch (state.kind) {
    case 'submitting':
      return 'Confirm in wallet…';
    case 'pending':
      return 'Sending…';
    case 'confirmed':
      return 'Sent ✓';
    case 'unconfirmed':
      return 'Sent';
    default:
      return reviewing ? 'Send' : 'Review';
  }
}

export function sendTxStatus(state: SendTx): SendTxStatus | null {
  if (state.kind === 'pending') return { label: 'Pending', hash: state.hash, chainId: state.chainId };
  if (state.kind === 'confirmed') return { label: 'Confirmed', hash: state.hash, chainId: state.chainId };
  if (state.kind === 'unconfirmed') return { label: 'Sent, not confirmed yet', hash: state.hash, chainId: state.chainId };
  return null;
}

export function sendTxError(state: SendTx): string | null {
  if (state.kind === 'failed') return state.error;
  if (state.kind === 'unconfirmed') return UNCONFIRMED_NOTE;
  return null;
}
