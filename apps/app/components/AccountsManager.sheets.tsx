/** AccountsManager bottom sheets — per-account manage + export-reveal. Extracted
 *  for lint line-budget. Rendering identical. */

import { Text } from '@metro-labs/kit/text';
import { Button } from '@metro-labs/kit/button';
import { ListView } from '@metro-labs/kit/list-view';
import * as Clipboard from 'expo-clipboard';
import { flash } from '../lib/toast';
import { canExportPrivateKey, type AccountRecord } from '../lib/accounts';
import { SheetModal, SheetRow } from './AccountsManager.parts';
import { DANGER, useEffectiveColorScheme, usePalette } from '../lib/theme';

interface Pal { head: string; sub: string; border: string; sheetBg: string; }

/** Bottom sheet with switch/export/remove actions for a single account. */
export function ManageSheet({ manageRec, activeId, onClose, onSwitch, onExport, onRemove, p }: {
  manageRec: AccountRecord | null; activeId: string | null; onClose: () => void;
  onSwitch: (id: string) => void; onExport: (id: string) => void;
  onRemove: (rec: AccountRecord) => void; p: Pal;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  return (
    <SheetModal
      visible={manageRec !== null}
      onClose={onClose}
      bg={p.sheetBg} border={p.border}
    >
      {/* Cancel SheetModal's 16px padding so the list spans edge-to-edge and the
          row content inset (ROW_INSET 16) matches the Settings page. */}
      <ListView dark={dark} style={{ marginHorizontal: -16 }}>
        {manageRec && manageRec.id !== activeId ? (
          <SheetRow label="Switch to this account" head={p.head} sub={p.sub} dark={dark} onPress={() => { const id = manageRec.id; onClose(); onSwitch(id); }} />
        ) : null}
        {manageRec && canExportPrivateKey(manageRec) ? (
          <SheetRow label="Export private key" desc="Reveal + copy this account's key" head={p.head} sub={p.sub} dark={dark} onPress={() => { const id = manageRec.id; onClose(); onExport(id); }} />
        ) : null}
        {manageRec ? (
          <SheetRow label="Remove account" desc="Delete from this device" danger head={p.head} sub={p.sub} dark={dark} onPress={() => { onRemove(manageRec); }} />
        ) : null}
      </ListView>
    </SheetModal>
  );
}

/** Bottom sheet that reveals and copies an account's exported private key. */
export function ExportSheet({ revealPk, onClose, dark, p }: {
  revealPk: string | null; onClose: () => void; dark: boolean; p: Pal;
}): React.ReactElement {
  const { primary, bg } = usePalette();
  return (
    <SheetModal visible={revealPk !== null} onClose={onClose} bg={p.sheetBg} border={p.border}>
      <Text size="xs" color={DANGER} style={{ marginBottom: 8 }}>
        Anyone with this key controls the account. Never share it.
      </Text>
      <Text variant="mono" size="xs" selectable color={p.head} style={{ lineHeight: 18, borderWidth: 1, borderColor: p.border, borderRadius: 10, padding: 12, marginBottom: 8 }}>
        {revealPk}
      </Text>
      <Button
        variant="primary"
        size="md"
        fullWidth
        dark={dark}
        onPress={() => { if (revealPk) { void Clipboard.setStringAsync(revealPk); flash('Private key copied'); } }}
        label="Copy to clipboard"
        tintBg={primary}
        tintFg={bg}
      />
    </SheetModal>
  );
}
