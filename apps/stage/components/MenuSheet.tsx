
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
import { useDrawerAccountActions } from './LeftDrawer.accounts';
import { transferKindFor } from '../lib/accountTransfer';
import { useAccountTransfer } from './accounts/useAccountTransfer';
import { TransferAccountSheet } from './accounts/TransferAccountSheet';
import { ImportAccountSheet } from './accounts/ImportAccountSheet';
import { profileLinkOf } from '../lib/links';

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

  const activeRec = accounts.find(a => a.id === activeId) ?? accounts[0] ?? null;

  const actions = useDrawerAccountActions({
    dark, onChanged: () => { onClose(); void refresh(); },
  });
  const t = useAccountTransfer();
  const compact = useAnchoredMenus();
  const movable = activeRec !== null && transferKindFor(activeRec) !== null;

  function go(href: '/settings'): void {
    onClose();
    router.navigate(href);
  }

  function goProfile(): void {
    const addr = activeRec?.address;
    if (!addr) return;
    onClose();
    router.navigate(profileLinkOf(addr));
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
          {actions.rows}
          <DrawerRow rowKey="import" icon="qrcode" label="Import account" dark={dark} onPress={() => { onClose(); t.openImport(); }}/>
          {movable ? (
            <DrawerRow rowKey="move" icon="deviceMobile" label="Move to another device" dark={dark} onPress={() => { onClose(); t.openTransfer(activeRec); }}/>
          ) : null}
          <DrawerRow rowKey="profile" icon="user" label="Profile" dark={dark} onPress={goProfile}/>
          <DrawerRow rowKey="settings" icon="cog" label="Settings" dark={dark} onPress={() => { go('/settings'); }}/>
        </MenuList>
      </AnchoredMenu>
      <TransferAccountSheet rec={t.transferRec} dark={dark} onClose={t.closeTransfer} />
      <ImportAccountSheet
        visible={t.importOpen} dark={dark} busy={t.importing} error={t.importError}
        onClose={t.closeImport} onSubmit={t.onImport}
      />
    </>
  );
}
