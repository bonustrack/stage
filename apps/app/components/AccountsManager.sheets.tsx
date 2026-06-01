/** AccountsManager bottom sheets — add picker, import-key, per-account manage,
 *  and export-reveal. Extracted for lint line-budget. Rendering identical. */

import { Pressable, TextInput } from 'react-native';
import { Box } from './layout';
import { Text } from '@metro-labs/kit/text';
import * as Clipboard from 'expo-clipboard';
import { flash } from '../lib/toast';
import { shortAddress } from '../lib/xmtp';
import { canExportPrivateKey, type AccountRecord } from '../lib/accounts';
import { SheetModal, SheetButton } from './AccountsManager.parts';

interface Pal { head: string; sub: string; border: string; sheetBg: string; }

export function AddSheet({ visible, onClose, onGenerate, onImport, onWalletConnect, p }: {
  visible: boolean; onClose: () => void;
  onGenerate: () => void; onImport: () => void; onWalletConnect: () => void; p: Pal;
}): React.ReactElement {
  return (
    <SheetModal visible={visible} onClose={onClose} bg={p.sheetBg} border={p.border} title="Add account" head={p.head}>
      <SheetButton label="Generate a new account" desc="Create a fresh wallet on this device" head={p.head} sub={p.sub} border={p.border} onPress={onGenerate} />
      <SheetButton label="Import private key" desc="Paste an existing wallet's private key" head={p.head} sub={p.sub} border={p.border} onPress={onImport} />
      <SheetButton label="Connect with WalletConnect" desc="Sign in with an existing wallet" head={p.head} sub={p.sub} border={p.border} onPress={onWalletConnect} />
    </SheetModal>
  );
}

export function ImportSheet({ visible, onClose, importText, setImportText, setImportErr, importErr, onImport, p }: {
  visible: boolean; onClose: () => void;
  importText: string; setImportText: (t: string) => void; setImportErr: (e: string) => void;
  importErr: string; onImport: () => void; p: Pal;
}): React.ReactElement {
  return (
    <SheetModal visible={visible} onClose={onClose} bg={p.sheetBg} border={p.border} title="Import private key" head={p.head}>
      <TextInput
        value={importText}
        onChangeText={(t) => { setImportText(t); setImportErr(''); }}
        placeholder="0x… (64 hex characters)"
        placeholderTextColor={p.sub}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        style={{
          color: p.head, fontFamily: 'Menlo', fontSize: 13,
          borderWidth: 1, borderColor: p.border, borderRadius: 10,
          paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8,
        }}
      />
      {importErr ? <Text style={{ color: '#ff6b80', fontSize: 12, marginBottom: 8, fontFamily: 'Calibre-Medium' }}>{importErr}</Text> : null}
      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={() => void (async () => { const t = await Clipboard.getStringAsync(); if (t) { setImportText(t.trim()); setImportErr(''); } })()}
          style={({ pressed }) => ({ flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: p.border, backgroundColor: pressed ? p.border : 'transparent' })}
        >
          <Text style={{ color: p.head, fontSize: 14, fontFamily: 'Calibre-Semibold' }}>Paste</Text>
        </Pressable>
        <Pressable
          onPress={onImport}
          disabled={!importText.trim()}
          style={({ pressed }) => ({ flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center', backgroundColor: !importText.trim() ? p.border : pressed ? '#a08458' : '#c0a06e', opacity: !importText.trim() ? 0.6 : 1 })}
        >
          <Text style={{ color: '#000', fontSize: 14, fontFamily: 'Calibre-Semibold' }}>Import</Text>
        </Pressable>
      </Box>
    </SheetModal>
  );
}

export function ManageSheet({ manageRec, activeId, onClose, onSwitch, onExport, onRemove, dark, p }: {
  manageRec: AccountRecord | null; activeId: string | null; onClose: () => void;
  onSwitch: (id: string) => void; onExport: (id: string) => void;
  onRemove: (rec: AccountRecord) => void; dark: boolean; p: Pal;
}): React.ReactElement {
  return (
    <SheetModal
      visible={manageRec !== null}
      onClose={onClose}
      bg={p.sheetBg} border={p.border} head={p.head}
      title={manageRec ? (manageRec.label ?? shortAddress(manageRec.address)) : ''}
    >
      {manageRec && manageRec.id !== activeId ? (
        <SheetButton label="Switch to this account" head={p.head} sub={p.sub} border={p.border} onPress={() => { const id = manageRec.id; onClose(); onSwitch(id); }} />
      ) : null}
      {manageRec && canExportPrivateKey(manageRec) ? (
        <SheetButton label="Export private key" desc="Reveal + copy this account's key" head={p.head} sub={p.sub} border={p.border} onPress={() => { const id = manageRec.id; onClose(); onExport(id); }} />
      ) : null}
      {manageRec ? (
        <SheetButton label="Remove account" desc="Delete from this device" danger dark={dark} head={p.head} sub={p.sub} border={p.border} onPress={() => onRemove(manageRec)} />
      ) : null}
    </SheetModal>
  );
}

export function ExportSheet({ revealPk, onClose, p }: {
  revealPk: string | null; onClose: () => void; p: Pal;
}): React.ReactElement {
  return (
    <SheetModal visible={revealPk !== null} onClose={onClose} bg={p.sheetBg} border={p.border} head={p.head} title="Private key">
      <Text style={{ color: '#ff6b80', fontSize: 12, fontFamily: 'Calibre-Medium', marginBottom: 8 }}>
        Anyone with this key controls the account. Never share it.
      </Text>
      <Text selectable style={{
        color: p.head, fontFamily: 'Menlo', fontSize: 13, lineHeight: 18,
        borderWidth: 1, borderColor: p.border, borderRadius: 10,
        padding: 12, marginBottom: 8,
      }}>
        {revealPk}
      </Text>
      <Pressable
        onPress={() => { if (revealPk) { void Clipboard.setStringAsync(revealPk); flash('Private key copied'); } }}
        style={({ pressed }) => ({ paddingVertical: 11, borderRadius: 10, alignItems: 'center', backgroundColor: pressed ? '#a08458' : '#c0a06e' })}
      >
        <Text style={{ color: '#000', fontSize: 14, fontFamily: 'Calibre-Semibold' }}>Copy to clipboard</Text>
      </Pressable>
    </SheetModal>
  );
}
