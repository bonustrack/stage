/** Accounts section for Settings — multi-wallet management.
 *
 *  Lists every account the device holds, marks the active one, and lets the
 *  user switch (no logout), add a new account (generate / import a private key /
 *  connect via WalletConnect), export the private key of a local account, or
 *  remove one. Switching/adding sets the active account and reloads so XMTP
 *  re-inits against the new inbox. Android-safe: import/export/confirm use
 *  in-app Modals (Alert.prompt is iOS-only). State + handlers live in
 *  useAccountsManager; the list card + sheets in sibling modules. */

import { Box } from './layout';
import { Spinner } from './Spinner';
import { useAccountsManager } from './AccountsManager.hook';
import { AccountList } from './AccountsManager.list';
import { AddSheet, ImportSheet, ManageSheet, ExportSheet } from './AccountsManager.sheets';
import { usePalette } from '../lib/theme';

export function AccountsManager({ dark, flat = false, onSwitched }: { dark: boolean; flat?: boolean; onSwitched?: () => void }): React.ReactElement {
  const tokens = usePalette();
  const head = tokens.link; // #ffffff / #000000
  const sub = dark ? '#7a7a7e' : '#8a929d'; // one-off sub-grey, no token
  const border = tokens.border; // #282a2d / #e4e4e5
  const rowBg = border;
  const sheetBg = dark ? '#1a1b1d' : '#ffffff'; // elevated sheet surface, no token
  const pal = { head, sub, border, sheetBg };

  const m = useAccountsManager(onSwitched);

  return (
    <Box>
      <AccountList
        flat={flat} accounts={m.accounts} activeId={m.activeId}
        activeRec={m.activeRec} otherAccounts={m.otherAccounts}
        expanded={m.expanded} setExpanded={m.setExpanded}
        head={head} sub={sub} border={border} rowBg={rowBg}
        onSwitch={(id) => void m.onSwitch(id)} setManageId={m.setManageId} setAddOpen={m.setAddOpen}
      />

      {m.busy ? (
        <Box style={{ paddingTop: 12, alignItems: 'center' }}>
          <Spinner size={20} color={head} />
        </Box>
      ) : null}

      <AddSheet
        visible={m.addOpen}
        onClose={() => m.setAddOpen(false)}
        onGenerate={() => void m.onGenerate()}
        onImport={() => { m.setAddOpen(false); m.setImportErr(''); m.setImportText(''); m.setImportOpen(true); }}
        onWalletConnect={() => { m.setAddOpen(false); m.setWcPending(true); m.open(); }}
        p={pal}
      />
      <ImportSheet
        visible={m.importOpen}
        onClose={() => { m.setImportOpen(false); }}
        importText={m.importText} setImportText={m.setImportText} setImportErr={m.setImportErr}
        importErr={m.importErr} onImport={() => void m.onImport()} dark={dark} p={pal}
      />
      <ManageSheet
        manageRec={m.manageRec} activeId={m.activeId}
        onClose={() => m.setManageId(null)}
        onSwitch={(id) => void m.onSwitch(id)}
        onExport={(id) => void m.onExport(id)}
        onRemove={m.onRemove}
        p={pal}
      />
      <ExportSheet revealPk={m.revealPk} onClose={() => m.setRevealPk(null)} dark={dark} p={pal} />
    </Box>
  );
}
