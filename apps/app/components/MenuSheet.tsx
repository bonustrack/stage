/** MenuSheet — the account/nav surface (formerly the full-screen /menu route),
 *  now presented in-place as the app's standard AppModal bottom-sheet over the
 *  current screen. Opened by tapping the top-left avatar (TopnavIdentity). It
 *  hosts what the old slide-out LeftDrawer rendered:
 *    - avatar header: active account's stamp avatar + name + short address
 *    - tap-to-switch accounts list (same switchToAccount path as before)
 *    - New / Add account actions
 *    - Profile + Settings nav rows
 *
 *  The presentational pieces are reused from LeftDrawer.parts / .accounts (the
 *  same components the drawer + the old page used) — no logic is duplicated.
 *  Switching an account or tapping a nav row closes the sheet first, then runs
 *  the action. */

import { useCallback, useEffect, useState } from 'react';

import { useRouter } from 'expo-router';
import { ListView } from '@metro-labs/kit/list-view';
import { AppModal } from './AppModal';
import { useEffectiveColorScheme, usePalette } from '../lib/theme';
import { usePeerProfiles } from '../lib/peerProfiles';
import { AccountManager } from '../modules/messaging';
import { loadAccounts, getActiveAccountId, type AccountRecord } from '../lib/accounts';
import { drawerAccountRows, DrawerHeader, DrawerRow } from './LeftDrawer.parts';
import { useDrawerAccountActions } from './LeftDrawer.accounts';

/** Renders the account/navigation bottom sheet with the active account, account switcher, and nav rows. */
export function MenuSheet({ visible, onClose }: {
  visible: boolean;
  onClose: () => void;
}): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const pal = usePalette();
  const head = pal.link;
  const sub = pal.text; // no `muted` token yet -> map to `text`.
  const border = pal.border;

  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    const [list, active] = await Promise.all([loadAccounts(), getActiveAccountId()]);
    setAccounts(list);
    setActiveId(active);
  }, []);
  useEffect(() => { if (visible) void refresh(); }, [visible, refresh]);
  usePeerProfiles(accounts.map(a => a.address));

  const activeRec = accounts.find(a => a.id === activeId) ?? accounts[0] ?? null;

  const actions = useDrawerAccountActions({
    head, sub, border, dark, onChanged: () => { onClose(); void refresh(); },
  });

  /** Go helper. */
  function go(href: '/settings'): void {
    onClose();
    router.navigate(href);
  }

  /** "Profile" opens the active account's own profile through the shared peer
   *  profile route (/user/[address]) — the dedicated own-profile tab was
   *  removed; viewing yourself reuses the same read-only ProfileScreen. */
  function goProfile(): void {
    const addr = activeRec?.address;
    if (!addr) return;
    onClose();
    router.navigate(`/user/${addr}`);
  }

  /** Handle the Switch. */
  function onSwitch(id: string): void {
    onClose();
    if (id === activeId) return;
    void (async () => {
      try { await AccountManager.switch(id); } catch { /* surfaced elsewhere */ }
    })();
  }

  return (
    <AppModal visible={visible} onClose={onClose}>
      <DrawerHeader rec={activeRec} c={{ head, sub, border }}/>
      {/* Cancel AppModal's 16px ScrollView padding so the list spans edge-to-edge,
          matching the HomeScreen overflow sheet. */}
      <ListView dark={dark} style={{ marginHorizontal: -16 }}>
        {drawerAccountRows({ accounts, activeId, onSwitch, c: { head, sub, border }, dark })}
        {actions.rows}
        <DrawerRow rowKey="profile" icon="user" label="Profile" head={head} sub={sub} border={border} dark={dark} onPress={goProfile}/>
        <DrawerRow rowKey="settings" icon="cog" label="Settings" head={head} sub={sub} border={border} dark={dark} onPress={() => { go('/settings'); }}/>
      </ListView>
      {actions.modal}
    </AppModal>
  );
}
