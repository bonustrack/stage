
import { Box } from './layout';
import { Spinner } from './Spinner';
import { useAccountsManager } from './AccountsManager.hook';
import { AccountList } from './AccountsManager.list';
import { ManageSheet, ExportSheet } from './AccountsManager.sheets';
import { usePalette } from '../lib/theme';
import { usePeerProfiles } from '../lib/peerProfiles';

export function AccountsManager({ dark, flat = false, onSwitched }: { dark: boolean; flat?: boolean; onSwitched?: () => void }): React.ReactElement {
  const tokens = usePalette();
  const head = tokens.link;
  const sub = tokens.sub;
  const border = tokens.border;
  const rowBg = border;
  const sheetBg = dark ? '#1a1b1d' : '#ffffff';
  const pal = { head, sub, border, sheetBg };

  const m = useAccountsManager(onSwitched);

  usePeerProfiles(m.accounts.map(a => a.address));

  return (
    <Box>
      <AccountList
        flat={flat} accounts={m.accounts} activeId={m.activeId}
        activeRec={m.activeRec} otherAccounts={m.otherAccounts}
        expanded={m.expanded} setExpanded={m.setExpanded}
        head={head} sub={sub} border={border} rowBg={rowBg}
        onSwitch={(id) => void m.onSwitch(id)} setManageId={m.setManageId} onAdd={() => void m.onAdd()}
      />

      {m.busy ? (
        <Box padding={{ top: 12 }} align="center">
          <Spinner size={20} color={head} />
        </Box>
      ) : null}

      <ManageSheet
        manageRec={m.manageRec} activeId={m.activeId}
        onClose={() => { m.setManageId(null); }}
        onSwitch={(id) => void m.onSwitch(id)}
        onExport={(id) => void m.onExport(id)}
        onRemove={m.onRemove}
        p={pal}
      />
      <ExportSheet revealPk={m.revealPk} onClose={() => { m.setRevealPk(null); }} dark={dark} p={pal} />
    </Box>
  );
}
