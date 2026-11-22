import { ignored } from './errorPolicy';
import { SignInCancelled } from './signInCancelled';
import { makeValue } from './storeCore';
import { makeDeferred, type Deferred } from './watched';

export type ConnectChoice = { kind: 'injected'; rdns: string } | { kind: 'walletconnect' };

export type WalletChoice = ConnectChoice | { kind: 'create' } | { kind: 'import' };

export interface WalletPickerView {
  view: 'list' | 'waiting' | 'walletconnect';
  note: string | null;
  wallet: string | null;
  recent: string | null;
  account: boolean;
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
  only: ConnectChoice | null;
  account: boolean;
}

export function chooseWallet({ note, recent, only, account }: PickerStart): Promise<WalletChoice> {
  cancelWalletPicker();
  cancelled = cancelledSignal();
  if (only !== null && !account) {
    picker.set({ view: only.kind === 'walletconnect' ? 'walletconnect' : 'waiting', note, wallet: null, recent, account });
    return Promise.resolve(only);
  }
  choice = makeDeferred<WalletChoice>();
  picker.set({ view: 'list', note, wallet: null, recent, account });
  return choice.promise;
}

export function pickWallet(next: WalletChoice): void {
  const pending = choice;
  choice = null;
  pending?.resolve(next);
}

export function showConnecting(wallet: string | null): void {
  const current = picker.get();
  const kept = { note: current?.note ?? null, recent: current?.recent ?? null, account: current?.account ?? false };
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
