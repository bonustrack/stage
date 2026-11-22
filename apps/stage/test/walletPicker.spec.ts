import { describe, expect, test } from 'bun:test';
import { SignInCancelled } from '../lib/signInCancelled';
import { addressesOf, legacyWallet, walletFromAnnouncement, withWallet } from '../lib/injectedWallets.model';
import { cancelWalletPicker, chooseWallet, closeWalletPicker, pickWallet, showConnecting, whenPickerCancelled } from '../lib/walletPicker';
import { ACCOUNT_ENTRIES, NO_WALLET, orderEntries, tagOf, walletPickerCopy } from '../components/wallets/WalletPicker.model';

const provider = { request: () => Promise.resolve(null) };
const ICON = 'data:image/svg+xml;base64,PHN2Zy8+';

function announcement(rdns: string, name: string, icon = ICON): unknown {
  return { info: { uuid: 'x', rdns, name, icon }, provider };
}

describe('browser wallet discovery', () => {
  test('reads an EIP-6963 announcement', () => {
    expect(walletFromAnnouncement(announcement('io.metamask', ' MetaMask '))).toEqual({
      rdns: 'io.metamask',
      name: 'MetaMask',
      icon: ICON,
      provider,
    });
  });

  test('drops announcements without a name, an id or a provider, and icons that are not inline images', () => {
    expect(walletFromAnnouncement(announcement('', 'MetaMask'))).toBeNull();
    expect(walletFromAnnouncement(announcement('io.metamask', ' '))).toBeNull();
    expect(walletFromAnnouncement({ info: { rdns: 'io.metamask', name: 'MetaMask' }, provider: {} })).toBeNull();
    expect(walletFromAnnouncement(null)).toBeNull();
    expect(walletFromAnnouncement(announcement('io.metamask', 'MetaMask', 'http://plain.example/icon.svg'))?.icon).toBe('');
    expect(walletFromAnnouncement(announcement('app.phantom', 'Phantom', ` ${ICON}`))?.icon).toBe(ICON);
  });

  test('keeps one entry per wallet and lets a real announcement replace the plain browser wallet', () => {
    const metamask = walletFromAnnouncement(announcement('io.metamask', 'MetaMask'));
    const rabby = walletFromAnnouncement(announcement('io.rabby', 'Rabby'));
    const legacy = legacyWallet(provider);
    if (metamask === null || rabby === null || legacy === null) throw new Error('fixture');
    expect(withWallet(withWallet([], metamask), metamask).map((w) => w.rdns)).toEqual(['io.metamask']);
    expect(withWallet([legacy], rabby).map((w) => w.rdns)).toEqual(['io.rabby']);
    expect(withWallet([rabby], legacy).map((w) => w.rdns)).toEqual(['io.rabby']);
    expect(withWallet([], legacy).map((w) => w.name)).toEqual(['Browser wallet']);
    expect(legacyWallet(undefined)).toBeNull();
  });

  test('reads only string accounts', () => {
    expect(addressesOf(['0xabc', 1, null])).toEqual(['0xabc']);
    expect(addressesOf('0xabc')).toEqual([]);
  });
});

describe('wallet picker', () => {
  test('resolves with the picked wallet and keeps the note while connecting', async () => {
    const choice = chooseWallet({ note: 'Connect 0x12…34 to continue.', recent: null, only: null, account: false });
    pickWallet({ kind: 'injected', rdns: 'io.metamask' });
    expect(await choice).toEqual({ kind: 'injected', rdns: 'io.metamask' });
    showConnecting('MetaMask');
    closeWalletPicker();
  });

  test('cancelling rejects both the choice and a connection in progress', async () => {
    const choice = chooseWallet({ note: null, recent: null, only: null, account: false });
    const connecting = whenPickerCancelled();
    cancelWalletPicker();
    expect(choice).rejects.toBeInstanceOf(SignInCancelled);
    expect(connecting).rejects.toBeInstanceOf(SignInCancelled);
  });

  test('goes straight to WalletConnect when it is the only option', async () => {
    expect(await chooseWallet({ note: null, recent: null, only: { kind: 'walletconnect' }, account: false })).toEqual({
      kind: 'walletconnect',
    });
    closeWalletPicker();
  });

  test('from sign-up the list always shows, so a new or imported wallet can be picked', async () => {
    const choice = chooseWallet({ note: null, recent: null, only: { kind: 'walletconnect' }, account: true });
    pickWallet({ kind: 'create' });
    expect(await choice).toEqual({ kind: 'create' });
    closeWalletPicker();
  });
});

describe('wallet picker copy', () => {
  test('names the wallet to approve in and shows the note on the list', () => {
    expect(walletPickerCopy({ view: 'waiting', note: null, wallet: 'MetaMask', recent: null, account: false }, false, false)).toEqual({
      title: 'Approve in MetaMask',
      about: 'Approve the connection in MetaMask to continue.',
    });
    expect(
      walletPickerCopy({ view: 'list', note: 'Connect 0x12…34 to continue.', wallet: null, recent: null, account: false }, false, false)
        .about,
    ).toBe('Connect 0x12…34 to continue.');
    expect(
      walletPickerCopy({ view: 'walletconnect', note: null, wallet: null, recent: null, account: false }, false, false).about,
    ).toContain('WalletConnect');
  });

  test('from sign-up the list offers a wallet you have or a new one', () => {
    const copy = walletPickerCopy({ view: 'list', note: null, wallet: null, recent: null, account: true }, false, false);
    expect(copy.title).toBe('Continue with wallet');
    expect(ACCOUNT_ENTRIES.map((entry) => entry.name)).toEqual(['Create a new wallet', 'Import a wallet']);
  });

  test('a QR code is for scanning on a computer and for another device on a phone', () => {
    expect(walletPickerCopy(null, true, false).title).toBe('Scan with your wallet');
    expect(walletPickerCopy(null, true, true).title).toBe('Open your wallet');
    expect(NO_WALLET).toContain('MetaMask');
  });
});

describe('wallet picker rows', () => {
  const entries = [
    { id: 'io.metamask', name: 'MetaMask', injected: true },
    { id: 'app.phantom', name: 'Phantom', injected: true },
    { id: 'walletconnect', name: 'WalletConnect', injected: false },
  ];

  test('puts the wallet used last first and keeps the rest in order', () => {
    expect(orderEntries(entries, 'walletconnect').map((e) => e.id)).toEqual(['walletconnect', 'io.metamask', 'app.phantom']);
    expect(orderEntries(entries, null).map((e) => e.id)).toEqual(['io.metamask', 'app.phantom', 'walletconnect']);
  });

  test('tags the last wallet Recent and browser wallets Detected', () => {
    expect(tagOf({ id: 'app.phantom', name: 'Phantom', injected: true }, 'app.phantom')).toBe('Recent');
    expect(tagOf({ id: 'io.metamask', name: 'MetaMask', injected: true }, 'app.phantom')).toBe('Detected');
    expect(tagOf({ id: 'walletconnect', name: 'WalletConnect', injected: false }, null)).toBeNull();
  });
});
