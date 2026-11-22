import type { WalletPickerView } from '../../lib/walletPicker';

export interface WalletPickerCopy {
  title: string;
  about: string | null;
}

export const NO_WALLET = 'No wallet found in this browser. Install a wallet extension such as MetaMask or Rabby, then reload the page.';

function pairingCopy(phone: boolean): WalletPickerCopy {
  if (phone) {
    return {
      title: 'Open your wallet',
      about: 'Open a wallet app to approve the connection, or scan this code with a wallet on another device.',
    };
  }
  return { title: 'Scan with your wallet', about: 'Scan this code with a wallet app on your phone, then approve the connection there.' };
}

export function walletPickerCopy(view: WalletPickerView | null, pairing: boolean, phone: boolean): WalletPickerCopy {
  if (pairing) return pairingCopy(phone);
  if (view?.view === 'waiting' && view.wallet !== null) {
    return { title: `Approve in ${view.wallet}`, about: `Approve the connection in ${view.wallet} to continue.` };
  }
  if (view?.view === 'walletconnect') return { title: 'Connect a wallet', about: 'Preparing WalletConnect…' };
  return { title: 'Connect a wallet', about: view?.note ?? null };
}

export const WALLETCONNECT_ID = 'walletconnect';

export interface PickerEntry {
  id: string;
  name: string;
  injected: boolean;
}

export type WalletTag = 'Recent' | 'Detected' | null;

export function orderEntries<T extends PickerEntry>(entries: readonly T[], recent: string | null): T[] {
  return [...entries.filter((entry) => entry.id === recent), ...entries.filter((entry) => entry.id !== recent)];
}

export function tagOf(entry: PickerEntry, recent: string | null): WalletTag {
  if (entry.id === recent) return 'Recent';
  return entry.injected ? 'Detected' : null;
}
