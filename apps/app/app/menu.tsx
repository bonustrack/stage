/** Menu page - the full-screen account/nav surface opened by tapping the
 *  top-left avatar on the Channels (Home) tab. It hosts what the old slide-out
 *  LeftDrawer used to render, now as a normal pushed route with a back header:
 *    - avatar header: active account's stamp avatar + name + short address
 *    - tap-to-switch accounts list (same switchToAccount path as before)
 *    - New / Add account actions
 *    - Profile + Settings nav rows
 *
 *  The presentational pieces are reused from LeftDrawer.parts / .accounts (the
 *  same components the drawer used) - no logic is duplicated. Switching an
 *  account or tapping a nav row pops back via router.back()/navigate, matching
 *  the Accounts + Search pages' header style. */

import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Title } from '@metro-labs/kit/title';
import { Icon } from '@metro-labs/kit/icon';
import { ListView } from '@metro-labs/kit/list-view';
import { Box } from '../components/layout';
import { useEffectiveColorScheme, usePalette } from '../lib/theme';
import { usePeerProfiles } from '../lib/peerProfiles';
import { AccountManager } from '../modules/messaging';
import { loadAccounts, getActiveAccountId, type AccountRecord } from '../lib/accounts';
import { drawerAccountRows, DrawerHeader, DrawerRow } from '../components/LeftDrawer.parts';
import { useDrawerAccountActions } from '../components/LeftDrawer.accounts';

export default function Menu(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const pal = usePalette();
  const head = pal.link;
  const sub = pal.text; // no `muted` token yet -> map to `text`.
  const border = pal.border;
  const bg = pal.bg;

  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    const [list, active] = await Promise.all([loadAccounts(), getActiveAccountId()]);
    setAccounts(list);
    setActiveId(active);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  usePeerProfiles(accounts.map(a => a.address));

  const activeRec = accounts.find(a => a.id === activeId) ?? accounts[0] ?? null;

  const actions = useDrawerAccountActions({
    head, sub, border, dark, onChanged: () => { void refresh(); },
  });

  function go(href: '/profile' | '/settings'): void {
    router.navigate(href);
  }

  function onSwitch(id: string): void {
    if (id === activeId) { router.back(); return; }
    void (async () => {
      try { await AccountManager.switch(id); } catch { /* surfaced elsewhere */ }
      router.back();
    })();
  }

  return (
    <Box style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      {/* Topnav: back + title, mirroring the Accounts / Search pages. */}
      <Box style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: border,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
          <Icon name="arrowLeft" size={22} color={head} />
        </Pressable>
        <Title dark={dark} style={{ color: head, fontSize: 20 }}>
          Menu
        </Title>
      </Box>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 14, paddingBottom: 24 + insets.bottom }}
      >
        <DrawerHeader rec={activeRec} c={{ head, sub, border }} />
        <ListView dark={dark}>
          {drawerAccountRows({ accounts, activeId, onSwitch, c: { head, sub, border }, dark })}
          {actions.rows}
          <DrawerRow rowKey="profile" icon="user" label="Profile" head={head} sub={sub} border={border} dark={dark} onPress={() => go('/profile')} />
          <DrawerRow rowKey="settings" icon="cog" label="Settings" head={head} sub={sub} border={border} dark={dark} onPress={() => go('/settings')} />
        </ListView>
      </ScrollView>
      {actions.modal}
    </Box>
  );
}
