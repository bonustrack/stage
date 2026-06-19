/**
 * @file Accounts section for Settings providing multi-wallet management
 * (switch, add a new HD-index ZeroDev smart account, remove, export), composing
 * the useAccountsManager hook with the sibling list-card and sheet modules.
 */

import { Box } from './layout';
import { Spinner } from './Spinner';
import { useAccountsManager } from './AccountsManager.hook';
import { AccountList } from './AccountsManager.list';
import { ManageSheet, ExportSheet } from './AccountsManager.sheets';
import { usePalette } from '../lib/theme';
import { usePeerProfiles } from '../lib/peerProfiles';

/** Settings section for listing, switching, adding, and removing the device's accounts. */
export function AccountsManager({ dark, flat = false, onSwitched }: { dark: boolean; flat?: boolean; onSwitched?: () => void }): React.ReactElement {
  const tokens = usePalette();
  const head = tokens.link; // #ffffff / #000000
  const sub = tokens.sub; // de-forked onto the palette secondary grey
  const border = tokens.border; // #282a2d / #e4e4e5
  const rowBg = border;
  const sheetBg = dark ? '#1a1b1d' : '#ffffff'; // elevated sheet surface, no token
  const pal = { head, sub, border, sheetBg };

  const m = useAccountsManager(onSwitched);

  /**
   * Resolve every account's display name via the SAME stamp.fyi resolver the
   *  peers use, so the user's OWN account(s) show their ENS/stamp name (e.g.
   *  "less") instead of just the truncated address. The rows read getPeerName;
   *  without this ensure() nothing ever fetches the self addresses.
   */
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
