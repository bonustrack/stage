
import { useCallback, useEffect, useState } from 'react';

import { useRouter } from 'expo-router';
import { ListView } from '@stage-labs/kit/react-native/list-view';
import { AppModal } from './AppModal';
import { useEffectiveColorScheme, usePalette } from '../lib/theme';
import { usePeerProfiles } from '../lib/peerProfiles';
import { AccountManager } from '../modules/messaging';
import { loadAccounts, getActiveAccountId, type AccountRecord } from '../lib/accounts';
import { drawerAccountRows, DrawerHeader, DrawerRow } from './LeftDrawer.parts';
import { useDrawerAccountActions } from './LeftDrawer.accounts';

export function MenuSheet({ visible, onClose }: {
  visible: boolean;
  onClose: () => void;
}): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const pal = usePalette();
  const head = pal.link;
  const sub = pal.text;
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

  function go(href: '/settings'): void {
    onClose();
    router.navigate(href);
  }

  function goProfile(): void {
    const addr = activeRec?.address;
    if (!addr) return;
    onClose();
    router.navigate(`/user/${addr}`);
  }

  function onSwitch(id: string): void {
    onClose();
    if (id === activeId) return;
    void (async () => {
      try { await AccountManager.switch(id); } catch { }
    })();
  }

  return (
    <AppModal visible={visible} onClose={onClose}>
      <DrawerHeader rec={activeRec} c={{ head, sub, border }}/>
      {}
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
