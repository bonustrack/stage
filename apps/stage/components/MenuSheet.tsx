
import { useCallback, useEffect, useState } from 'react';

import { useRouter } from 'expo-router';
import { AnchoredMenu, useAnchoredMenus } from './AnchoredMenu';
import { MenuList } from './MenuRows';
import type { MenuPoint } from './AnchoredMenu.model';
import { useEffectiveColorScheme, usePalette } from '../lib/theme';
import { usePeerProfiles } from '../lib/peerProfiles';
import { AccountManager } from '../modules/messaging';
import { loadAccounts, getActiveAccountId, type AccountRecord } from '../lib/accounts';
import { drawerAccountRows, DrawerRow } from './LeftDrawer.parts';
import { IMPORT_ROUTE, SIGNUP_ROUTE } from './onboarding/nextRoute.model';

export function MenuSheet({ visible, anchor, onClose }: {
  visible: boolean;
  anchor: MenuPoint | null;
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

  const compact = useAnchoredMenus();

  function go(href: typeof SIGNUP_ROUTE | typeof IMPORT_ROUTE): void {
    onClose();
    router.navigate(href);
  }

  function onSwitch(id: string): void {
    onClose();
    if (id === activeId) return;
    void (async () => {
      try { await AccountManager.switch(id); } catch { }
    })();
  }

  return (
    <>
      <AnchoredMenu visible={visible} onClose={onClose} anchor={anchor}>
        <MenuList dark={dark}>
          {drawerAccountRows({ accounts, activeId, onSwitch, c: { head, sub, border }, dark, compact })}
          <DrawerRow rowKey="new-account" icon="userAdd" label="New account" dark={dark} onPress={() => { go(SIGNUP_ROUTE); }}/>
          <DrawerRow rowKey="import" icon="qrcode" label="Import account" dark={dark} onPress={() => { go(IMPORT_ROUTE); }}/>
        </MenuList>
      </AnchoredMenu>
    </>
  );
}
