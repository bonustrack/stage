import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { errorMessage } from '@stage-labs/client/errors';
import { Text } from '@stage-labs/kit/react-native/text';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Col } from './layout';
import { Avatar } from './Avatar';
import { AnchoredMenu, useAnchoredMenus } from './AnchoredMenu';
import { MenuHover, MenuList, MenuRow, menuRowPadding } from './MenuRows';
import type { MenuPoint } from './AnchoredMenu.model';
import { useEffectiveColorScheme, usePalette } from '../lib/theme';
import { getPeerName, usePeerProfiles } from '../lib/peerProfiles';
import { AccountManager, shortAddress } from '../modules/messaging';
import { loadAccounts, getActiveAccountId, type AccountRecord } from '../lib/accounts';
import { IMPORT_ROUTE, SIGNUP_ROUTE } from './onboarding/nextRoute.model';
import { report, reported } from '../lib/errorPolicy';

function AccountSwitchRow({ account, active, onSwitch, dark, compact }: {
  account: AccountRecord; active: boolean; onSwitch: (id: string) => void; dark: boolean; compact: boolean;
}): React.ReactElement {
  const { link: head, text, border } = usePalette();
  return (
    <MenuHover compact={compact}>
      <ListViewItem dark={dark} onPress={() => { onSwitch(account.id); }} gap={compact ? 10 : 12} padding={menuRowPadding(compact)}>
        <Avatar address={account.address} size={compact ? 26 : 30} style={{ backgroundColor: border }}/>
        <Col minWidth={0} flex={1}>
          <Text weight="semibold" size={compact ? 'sm' : 'md'} numberOfLines={1} color={head}>
            {getPeerName(account.address) ?? account.label ?? shortAddress(account.address)}
          </Text>
          <Text size="xs" numberOfLines={1} color={text} style={{ marginTop: 1 }}>
            {shortAddress(account.address)}
          </Text>
        </Col>
        {active ? <Icon name="check" size={compact ? 16 : 20} color={head} /> : null}
      </ListViewItem>
    </MenuHover>
  );
}

export function MenuSheet({ visible, anchor, onClose }: {
  visible: boolean;
  anchor: MenuPoint | null;
  onClose: () => void;
}): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    void Promise.all([loadAccounts(), getActiveAccountId()]).then(([list, active]) => {
      setAccounts(list);
      setActiveId(active);
    }).catch(reported('menu.accounts'));
  }, [visible]);
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
      try {
        await AccountManager.switch(id);
      } catch (err) {
        report('menu.switchAccount', err);
        Alert.alert('Switch failed', errorMessage(err));
      }
    })();
  }

  return (
    <AnchoredMenu visible={visible} onClose={onClose} anchor={anchor}>
      <MenuList dark={dark}>
        {accounts.map((a) => (
          <AccountSwitchRow key={a.id} account={a} active={a.id === activeId} onSwitch={onSwitch} dark={dark} compact={compact}/>
        ))}
        <MenuRow key="new-account" icon="userAdd" label="New account" dark={dark} onPress={() => { go(SIGNUP_ROUTE); }} chevron/>
        <MenuRow key="import" icon="qrcode" label="Import account" dark={dark} onPress={() => { go(IMPORT_ROUTE); }} chevron/>
      </MenuList>
    </AnchoredMenu>
  );
}
