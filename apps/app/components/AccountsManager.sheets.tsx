/** AccountsManager bottom sheets — add picker, import-key, per-account manage,
 *  and export-reveal. Extracted for lint line-budget. Rendering identical. */

import { TextInput } from 'react-native';
import { Box } from './layout';
import { Text } from '@metro-labs/kit/text';
import { Button } from '@metro-labs/kit/button';
import * as Clipboard from 'expo-clipboard';
import { flash } from '../lib/toast';
import { shortAddress } from '../lib/xmtp';
import { canExportPrivateKey, type AccountRecord } from '../lib/accounts';
import { SheetModal, SheetButton } from './AccountsManager.parts';
import { DANGER } from '../lib/theme';

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

export function ImportSheet({ visible, onClose, importText, setImportText, setImportErr, importErr, onImport, dark, p }: {
  visible: boolean; onClose: () => void;
  importText: string; setImportText: (t: string) => void; setImportErr: (e: string) => void;
  importErr: string; onImport: () => void; dark: boolean; p: Pal;
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
      {importErr ? <Text style={{ color: DANGER, fontSize: 12, marginBottom: 8, fontFamily: 'Calibre-Medium' }}>{importErr}</Text> : null}
      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          variant="secondary"
          size="md"
          fullWidth
          dark={dark}
          onPress={() => void (async () => { const t = await Clipboard.getStringAsync(); if (t) { setImportText(t.trim()); setImportErr(''); } })()}
          label="Paste"
          style={{ flex: 1 }}
        />
        <Button
          variant="primary"
          size="md"
          fullWidth
          dark={dark}
          disabled={!importText.trim()}
          onPress={onImport}
          label="Import"
          style={{ flex: 1 }}
        />
      </Box>
    </SheetModal>
  );
}

export function ManageSheet({ manageRec, activeId, onClose, onSwitch, onExport, onRemove, p }: {
  manageRec: AccountRecord | null; activeId: string | null; onClose: () => void;
  onSwitch: (id: string) => void; onExport: (id: string) => void;
  onRemove: (rec: AccountRecord) => void; p: Pal;
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
        <SheetButton label="Remove account" desc="Delete from this device" danger head={p.head} sub={p.sub} border={p.border} onPress={() => onRemove(manageRec)} />
      ) : null}
    </SheetModal>
  );
}

export function ExportSheet({ revealPk, onClose, dark, p }: {
  revealPk: string | null; onClose: () => void; dark: boolean; p: Pal;
}): React.ReactElement {
  return (
    <SheetModal visible={revealPk !== null} onClose={onClose} bg={p.sheetBg} border={p.border} head={p.head} title="Private key">
      <Text style={{ color: DANGER, fontSize: 12, fontFamily: 'Calibre-Medium', marginBottom: 8 }}>
        Anyone with this key controls the account. Never share it.
      </Text>
      <Text selectable style={{
        color: p.head, fontFamily: 'Menlo', fontSize: 13, lineHeight: 18,
        borderWidth: 1, borderColor: p.border, borderRadius: 10,
        padding: 12, marginBottom: 8,
      }}>
        {revealPk}
      </Text>
      <Button
        variant="primary"
        size="md"
        fullWidth
        dark={dark}
        onPress={() => { if (revealPk) { void Clipboard.setStringAsync(revealPk); flash('Private key copied'); } }}
        label="Copy to clipboard"
      />
    </SheetModal>
  );
}
