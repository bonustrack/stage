/** Accounts section for Settings — multi-wallet management.
 *
 *  Lists every account the device holds, marks the active one, and lets the
 *  user switch (no logout), add a new account (generate / import a private key /
 *  connect via WalletConnect), export the private key of a local account, or
 *  remove one. Switching/adding sets the active account and reloads so XMTP
 *  re-inits against the new inbox. Android-safe: import/export/confirm use
 *  in-app Modals (Alert.prompt is iOS-only). */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, DevSettings, Image, Modal, Pressable, Text,
  TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useAppKit } from '@reown/appkit-wagmi-react-native';
import { useAccount, useSignMessage } from 'wagmi';
import { HeroIcon } from './HeroIcon';
import { usePeerProfiles, getPeerName } from '../lib/peerProfiles';
import { stampBoxAvatarUrl, shortAddress, deleteAccount, switchToAccount } from '../lib/xmtp';
import {
  loadAccounts, getActiveAccountId, addGeneratedAccount,
  importPrivateKey, addWalletConnectAccount, getPrivateKey, canExportPrivateKey,
  type AccountRecord,
} from '../lib/accounts';
import { setWcSign } from '../lib/wcSigner';
import { bumpAccountEpoch } from '../lib/accountEpoch';

const TYPE_LABEL: Record<AccountRecord['type'], string> = {
  generated: 'Generated',
  privateKey: 'Imported key',
  walletconnect: 'WalletConnect',
};

function reloadApp(): void {
  /** Dev-client reload. In a published build this is a no-op; swap to
   *  expo-updates' reloadAsync if/when we ship one. */
  DevSettings.reload?.();
}

export function AccountsManager({ dark }: { dark: boolean }): React.ReactElement {
  const head = dark ? '#ffffff' : '#000000';
  const sub = dark ? '#7a7a7e' : '#8a929d';
  const border = dark ? '#282a2d' : '#e4e4e5';
  const rowBg = dark ? '#282a2d' : '#e4e4e5';
  const sheetBg = dark ? '#1a1b1d' : '#ffffff';

  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importErr, setImportErr] = useState('');
  const [manageId, setManageId] = useState<string | null>(null);
  const [revealPk, setRevealPk] = useState<string | null>(null);

  /** WalletConnect (Reown AppKit) — open() shows the wallet picker; the effect
   *  below reacts once a wallet is connected. */
  const { open } = useAppKit();
  const { address: wcAddress, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [wcPending, setWcPending] = useState(false);

  useEffect(() => {
    if (!wcPending || !isConnected || !wcAddress) return;
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        setBusy(true);
        /** Register the sign fn xmtp.ts will call for the one-time installation
         *  challenge; signMessageAsync routes personal_sign to the wallet. */
        setWcSign(async (message: string) => signMessageAsync({ message, account: wcAddress }));
        const rec = await addWalletConnectAccount(wcAddress);
        /** Build + register this account's XMTP installation now (wallet prompts
         *  personal_sign once). After the reload it's registered → Client.build,
         *  no further prompts. */
        await switchToAccount(rec.id);
        if (!cancelled) { setWcPending(false); reloadApp(); }
      } catch (e) {
        if (!cancelled) {
          setWcPending(false);
          setBusy(false);
          Alert.alert('WalletConnect setup failed', (e as Error).message);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [wcPending, isConnected, wcAddress, signMessageAsync]);

  const refresh = useCallback(async (): Promise<void> => {
    const [list, active] = await Promise.all([loadAccounts(), getActiveAccountId()]);
    setAccounts(list);
    setActiveId(active);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const manageRec = accounts.find(a => a.id === manageId) ?? null;

  /** Resolve Snapshot display names for each account address (re-renders the
   *  rows once they load) so the list shows names, not just addresses. */
  usePeerProfiles(accounts.map(a => a.address));

  async function onSwitch(id: string): Promise<void> {
    if (id === activeId || busy) return;
    setBusy(true);
    try {
      /** In-place switch — no full app reload (which on the dev client re-downloads
       *  the whole JS bundle + flashes white). switchToAccount drops the cached
       *  client + builds the target account's; bumpAccountEpoch re-inits the
       *  channels list against it. Far snappier than reloadApp(). */
      await switchToAccount(id);
      bumpAccountEpoch();
      await refresh();
    } catch (e) {
      Alert.alert('Switch failed', (e as Error).message);
    } finally { setBusy(false); }
  }

  async function onGenerate(): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      await addGeneratedAccount();
      setAddOpen(false);
      reloadApp();
    } catch (e) {
      Alert.alert('Could not create account', (e as Error).message);
      setBusy(false);
    }
  }

  async function onImport(): Promise<void> {
    if (busy) return;
    setImportErr('');
    setBusy(true);
    try {
      await importPrivateKey(importText);
      setImportOpen(false);
      setImportText('');
      reloadApp();
    } catch (e) {
      setImportErr((e as Error).message);
      setBusy(false);
    }
  }

  async function onExport(id: string): Promise<void> {
    const pk = await getPrivateKey(id);
    if (!pk) { Alert.alert('No key', 'This account has no exportable private key.'); return; }
    setRevealPk(pk);
  }

  function onRemove(rec: AccountRecord): void {
    Alert.alert(
      'Remove account',
      `Remove ${rec.label ?? shortAddress(rec.address)}? Its local XMTP database will be deleted from this device.${
        canExportPrivateKey(rec) ? ' Export the private key first if you want to keep access.' : ''
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => {
            void (async (): Promise<void> => {
              const wasActive = rec.id === activeId;
              await deleteAccount(rec.id);
              setManageId(null);
              if (wasActive) reloadApp();
              else await refresh();
            })();
          } },
      ],
    );
  }

  return (
    <View>
      <Text style={{ color: sub, fontSize: 13, paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8, fontFamily: 'Calibre-Medium' }}>
        ACCOUNTS
      </Text>
      <View style={{
        marginHorizontal: 16, borderRadius: 12, overflow: 'hidden',
        borderWidth: 1, borderColor: border, backgroundColor: rowBg,
      }}>
        {accounts.map((a, i) => {
          const active = a.id === activeId;
          return (
            <Pressable
              key={a.id}
              onPress={() => void onSwitch(a.id)}
              onLongPress={() => setManageId(a.id)}
              delayLongPress={300}
              style={({ pressed }) => ({
                paddingHorizontal: 14, paddingVertical: 12,
                flexDirection: 'row', alignItems: 'center', gap: 12,
                borderTopWidth: i === 0 ? 0 : 1, borderTopColor: border,
                backgroundColor: pressed ? border : 'transparent',
              })}
            >
              <Image
                source={{ uri: stampBoxAvatarUrl(a.address, 56) }}
                style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: border }}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: head, fontSize: 16, fontFamily: 'Calibre-Semibold' }}>
                  {getPeerName(a.address) ?? a.label ?? shortAddress(a.address)}
                </Text>
                <Text numberOfLines={1} style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium', marginTop: 1 }}>
                  {shortAddress(a.address)} · {TYPE_LABEL[a.type]}
                </Text>
              </View>
              {active ? (
                <HeroIcon name="check" size={20} color={head} />
              ) : (
                <Pressable hitSlop={10} onPress={() => setManageId(a.id)}>
                  <Text style={{ color: sub, fontSize: 20, fontFamily: 'Calibre-Semibold', paddingHorizontal: 4 }}>⋯</Text>
                </Pressable>
              )}
            </Pressable>
          );
        })}
        {accounts.length === 0 ? (
          <Text style={{ color: sub, fontSize: 13, padding: 14, fontFamily: 'Calibre-Medium' }}>
            No accounts yet.
          </Text>
        ) : null}
        <Pressable
          onPress={() => setAddOpen(true)}
          style={({ pressed }) => ({
            paddingHorizontal: 14, paddingVertical: 12,
            flexDirection: 'row', alignItems: 'center', gap: 12,
            borderTopWidth: accounts.length ? 1 : 0, borderTopColor: border,
            backgroundColor: pressed ? border : 'transparent',
          })}
        >
          <View style={{ width: 28, height: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: sub, borderStyle: 'dashed' }}>
            <HeroIcon name="plus" size={16} color={sub} />
          </View>
          <Text style={{ color: head, fontSize: 16, fontFamily: 'Calibre-Semibold' }}>Add account</Text>
        </Pressable>
      </View>
      <Text style={{ color: sub, fontSize: 13, paddingHorizontal: 16, paddingTop: 8, fontFamily: 'Calibre-Medium' }}>
        Tap to switch · long-press for options
      </Text>

      {busy ? (
        <View style={{ paddingTop: 12, alignItems: 'center' }}>
          <ActivityIndicator color={head} />
        </View>
      ) : null}

      {/* Add-account picker */}
      <SheetModal visible={addOpen} onClose={() => setAddOpen(false)} bg={sheetBg} border={border} title="Add account" head={head}>
        <SheetButton label="Generate a new account" desc="Create a fresh wallet on this device" head={head} sub={sub} border={border} onPress={() => void onGenerate()} />
        <SheetButton label="Import private key" desc="Paste an existing wallet's private key" head={head} sub={sub} border={border} onPress={() => { setAddOpen(false); setImportErr(''); setImportText(''); setImportOpen(true); }} />
        <SheetButton label="Connect with WalletConnect" desc="Sign in with an existing wallet" head={head} sub={sub} border={border} onPress={() => { setAddOpen(false); setWcPending(true); open(); }} />
      </SheetModal>

      {/* Import private key */}
      <SheetModal visible={importOpen} onClose={() => { setImportOpen(false); }} bg={sheetBg} border={border} title="Import private key" head={head}>
        <TextInput
          value={importText}
          onChangeText={(t) => { setImportText(t); setImportErr(''); }}
          placeholder="0x… (64 hex characters)"
          placeholderTextColor={sub}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          style={{
            color: head, fontFamily: 'Menlo', fontSize: 13,
            borderWidth: 1, borderColor: border, borderRadius: 10,
            paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8,
          }}
        />
        {importErr ? <Text style={{ color: '#ff6b80', fontSize: 12, marginBottom: 8, fontFamily: 'Calibre-Medium' }}>{importErr}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() => void (async () => { const t = await Clipboard.getStringAsync(); if (t) { setImportText(t.trim()); setImportErr(''); } })()}
            style={({ pressed }) => ({ flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: border, backgroundColor: pressed ? border : 'transparent' })}
          >
            <Text style={{ color: head, fontSize: 14, fontFamily: 'Calibre-Semibold' }}>Paste</Text>
          </Pressable>
          <Pressable
            onPress={() => void onImport()}
            disabled={!importText.trim()}
            style={({ pressed }) => ({ flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center', backgroundColor: !importText.trim() ? border : pressed ? '#a08458' : '#c0a06e', opacity: !importText.trim() ? 0.6 : 1 })}
          >
            <Text style={{ color: '#000', fontSize: 14, fontFamily: 'Calibre-Semibold' }}>Import</Text>
          </Pressable>
        </View>
      </SheetModal>

      {/* Per-account options */}
      <SheetModal
        visible={manageRec !== null}
        onClose={() => setManageId(null)}
        bg={sheetBg} border={border} head={head}
        title={manageRec ? (manageRec.label ?? shortAddress(manageRec.address)) : ''}
      >
        {manageRec && manageRec.id !== activeId ? (
          <SheetButton label="Switch to this account" head={head} sub={sub} border={border} onPress={() => { const id = manageRec.id; setManageId(null); void onSwitch(id); }} />
        ) : null}
        {manageRec && canExportPrivateKey(manageRec) ? (
          <SheetButton label="Export private key" desc="Reveal + copy this account's key" head={head} sub={sub} border={border} onPress={() => { const id = manageRec.id; setManageId(null); void onExport(id); }} />
        ) : null}
        {manageRec ? (
          <SheetButton label="Remove account" desc="Delete from this device" danger dark={dark} head={head} sub={sub} border={border} onPress={() => onRemove(manageRec)} />
        ) : null}
      </SheetModal>

      {/* Export reveal */}
      <SheetModal visible={revealPk !== null} onClose={() => setRevealPk(null)} bg={sheetBg} border={border} head={head} title="Private key">
        <Text style={{ color: '#ff6b80', fontSize: 12, fontFamily: 'Calibre-Medium', marginBottom: 8 }}>
          Anyone with this key controls the account. Never share it.
        </Text>
        <Text selectable style={{
          color: head, fontFamily: 'Menlo', fontSize: 13, lineHeight: 18,
          borderWidth: 1, borderColor: border, borderRadius: 10,
          padding: 12, marginBottom: 8,
        }}>
          {revealPk}
        </Text>
        <Pressable
          onPress={() => { if (revealPk) { void Clipboard.setStringAsync(revealPk); Alert.alert('Copied', 'Private key copied to clipboard.'); } }}
          style={({ pressed }) => ({ paddingVertical: 11, borderRadius: 10, alignItems: 'center', backgroundColor: pressed ? '#a08458' : '#c0a06e' })}
        >
          <Text style={{ color: '#000', fontSize: 14, fontFamily: 'Calibre-Semibold' }}>Copy to clipboard</Text>
        </Pressable>
      </SheetModal>
    </View>
  );
}

/** Bottom-sheet style modal — dim backdrop, rounded card pinned to the bottom. */
function SheetModal({ visible, onClose, children, bg, border, title, head }: {
  visible: boolean; onClose: () => void; children: React.ReactNode;
  bg: string; border: string; title?: string; head: string;
}): React.ReactElement {
  /** Pad the sheet past the Android nav bar so its last row isn't overlapped
   *  / cut off by the system navigation buttons. */
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 28 + insets.bottom, borderTopWidth: 1, borderColor: border }}>
          <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: border, marginBottom: 12 }} />
          {title ? (
            <Text style={{ color: head, fontSize: 20, fontFamily: 'Calibre-Semibold', marginBottom: 12 }}>{title}</Text>
          ) : null}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SheetButton({ label, desc, onPress, head, sub, border, danger, dark }: {
  label: string; desc?: string; onPress: () => void;
  head: string; sub: string; border: string; danger?: boolean; dark?: boolean;
}): React.ReactElement {
  const labelColor = danger ? (dark ? '#ff6b80' : '#b91c1c') : head;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, marginTop: 8,
        borderWidth: 1, borderColor: border,
        backgroundColor: pressed ? border : 'transparent',
      })}
    >
      <Text style={{ color: labelColor, fontSize: 16, fontFamily: 'Calibre-Semibold' }}>{label}</Text>
      {desc ? <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium', marginTop: 2 }}>{desc}</Text> : null}
    </Pressable>
  );
}
