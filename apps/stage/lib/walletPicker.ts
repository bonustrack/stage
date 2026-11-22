import { ignored } from './errorPolicy';
import { SignInCancelled } from './signInCancelled';
import { makeValue } from './storeCore';
import { makeDeferred, type Deferred } from './watched';

export type WalletChoice = { kind: 'injected'; rdns: string } | { kind: 'walletconnect' };

export interface WalletPickerView {
  view: 'list' | 'waiting' | 'walletconnect';
  note: string | null;
  wallet: string | null;
  recent: string | null;
}

const picker = makeValue<WalletPickerView | null>(null);
let choice: Deferred<WalletChoice> | null = null;
let cancelled: Deferred<never> | null = null;

export const useWalletPicker = picker.use;

function cancelledSignal(): Deferred<never> {
  const signal = makeDeferred<never>();
  void signal.promise.catch(ignored(undefined, 'ui'));
  return signal;
}

export interface PickerStart {
  note: string | null;
  recent: string | null;
  only: WalletChoice | null;
}

export function chooseWallet({ note, recent, only }: PickerStart): Promise<WalletChoice> {
  cancelWalletPicker();
  cancelled = cancelledSignal();
  if (only !== null) {
    picker.set({ view: only.kind === 'walletconnect' ? 'walletconnect' : 'waiting', note, wallet: null, recent });
    return Promise.resolve(only);
  }
  choice = makeDeferred<WalletChoice>();
  picker.set({ view: 'list', note, wallet: null, recent });
  return choice.promise;
}

export function pickWallet(next: WalletChoice): void {
  const pending = choice;
  choice = null;
  pending?.resolve(next);
}

export function showConnecting(wallet: string | null): void {
  const current = picker.get();
  const kept = { note: current?.note ?? null, recent: current?.recent ?? null };
  picker.set(wallet === null ? { view: 'walletconnect', wallet: null, ...kept } : { view: 'waiting', wallet, ...kept });
}

export function whenPickerCancelled(): Promise<never> {
  return cancelled?.promise ?? new Promise<never>(() => undefined);
}

export function cancelWalletPicker(): void {
  choice?.reject(new SignInCancelled());
  cancelled?.reject(new SignInCancelled());
  choice = null;
  cancelled = null;
  picker.set(null);
}

export function closeWalletPicker(): void {
  choice = null;
  cancelled = null;
  picker.set(null);
}
