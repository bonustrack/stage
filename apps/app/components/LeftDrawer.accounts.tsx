/** Account-action rows + import sheet for the LeftDrawer, split out to keep
 *  LeftDrawer.tsx under the line cap.
 *
 *    - "New account"  → mints a fresh random EOA (addGeneratedAccount) and
 *                       switches the active client to it.
 *    - "Add account"  → opens a sheet to paste an existing wallet's private key
 *                       (0x… 64 hex) or BIP-39 recovery phrase; validates +
 *                       imports it (importWallet) and switches to it.
 *
 *  The private key / phrase is never logged; it is handed straight to the
 *  registry, which stores it in expo-secure-store via the same per-account slot
 *  used by every other local account. */

import { useState } from 'react';
import { fontSize } from '@metro-labs/kit/tokens';
import { Textarea } from '@metro-labs/kit/textarea';
import { Box } from './layout';
import { Text } from '@metro-labs/kit/text';
import { Button } from '@metro-labs/kit/button';
import * as Clipboard from 'expo-clipboard';
import { flash } from '../lib/toast';
import { AccountManager, shortAddress } from '../modules/messaging';
import { addGeneratedAccount, importWallet } from '../lib/accounts';
import { AppModal } from './AppModal';
import { DrawerRow } from './LeftDrawer.parts';
import { DANGER, usePalette } from '../lib/theme';

/** Switch the active XMTP client to a freshly added account id. The wallet/EOA
 *  switch happens regardless (decoupled from XMTP), and switchToAccount bumps the
 *  account epoch even when its XMTP inbox fails to build - so HomeScreen re-inits
 *  onto the recoverable HomeError screen instead of a dead spinner. We surface a
 *  toast here so the user knows messaging needs a reset, but never block the
 *  wallet switch (don't re-throw). The drawer still closes via onChanged(). */
async function activate(id: string, onChanged: () => void): Promise<void> {
  try {
    await AccountManager.switch(id);
  } catch {
    flash('Switched account - XMTP messaging needs a reset (see Home)');
  }
  onChanged();
}

/** Account-action rows + their import sheet. Returns the rows as a flat array
 *  (so the caller spreads them as DIRECT ListView children and the Kit ListView
 *  draws its inset divider under every row, including "New account") and the
 *  modal (rendered as a sibling, OUTSIDE the list so it is never a stray row). */
export function useDrawerAccountActions({ head, sub, border, dark, onChanged }: {
  head: string; sub: string; border: string; dark: boolean;
  /** Called after the registry changes so the drawer re-reads the list/active. */
  onChanged: () => void;
}): { rows: React.ReactElement[]; modal: React.ReactElement } {
  const { primary, bg } = usePalette();
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');

  const onNew = (): void => {
    if (busy) return;
    setBusy(true);
    void (async () => {
      try {
        const rec = await addGeneratedAccount();
        await activate(rec.id, onChanged);
        flash(`New account ${shortAddress(rec.address)} created`);
      } catch {
        flash('Could not create account');
      } finally {
        setBusy(false);
      }
    })();
  };

  const onImport = (): void => {
    const input = text.trim();
    if (!input || busy) return;
    setBusy(true);
    void (async () => {
      try {
        const rec = await importWallet(input);
        await activate(rec.id, onChanged);
        setText('');
        setImportOpen(false);
        flash(`Imported ${shortAddress(rec.address)}`);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Invalid private key or recovery phrase.');
      } finally {
        setBusy(false);
      }
    })();
  };

  const rows = [
    <DrawerRow
      key="new-account" rowKey="new-account" icon="userAdd" label="New account"
      head={head} sub={sub} border={border} dark={dark} onPress={onNew}
    />,
    <DrawerRow
      key="add-account" rowKey="add-account" icon="download" label="Add account"
      head={head} sub={sub} border={border} dark={dark}
      onPress={() => { setErr(''); setText(''); setImportOpen(true); }}
    />,
  ];

  const modal = (
    <AppModal visible={importOpen} onClose={() => setImportOpen(false)} title="Add account">
        <Text size="xs" color={sub} style={{ marginBottom: 10 }}>
          Paste an existing wallet&apos;s private key (0x… 64 hex) or its 12–24 word recovery phrase.
        </Text>
        <Textarea
          value={text}
          onChangeText={(t) => { setText(t); setErr(''); }}
          placeholder="0x… or word1 word2 word3 …"
          placeholderTextColor={sub}
          dark={dark}
          inputProps={{ autoCapitalize: 'none', autoCorrect: false, secureTextEntry: !text.includes(' ') }}
          style={{
            color: head, fontFamily: 'Menlo', fontSize: fontSize('xs'), minHeight: 64, height: undefined,
            borderWidth: 1, borderColor: border, borderRadius: 10,
            paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8,
            textAlignVertical: 'top', backgroundColor: 'transparent',
          }}
        />
        {err ? (
          <Text size="xs" color={DANGER} style={{ marginBottom: 8 }}>{err}</Text>
        ) : null}
        <Box style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            variant="secondary" size="md" fullWidth dark={dark} label="Paste" style={{ flex: 1 }}
            onPress={() => void (async () => {
              const t = await Clipboard.getStringAsync();
              if (t) { setText(t.trim()); setErr(''); }
            })()}
          />
          <Button
            variant="primary" size="md" fullWidth dark={dark} label="Import"
            tintBg={primary} tintFg={bg} style={{ flex: 1 }}
            disabled={!text.trim() || busy}
            onPress={onImport}
          />
        </Box>
      </AppModal>
  );

  return { rows, modal };
}
