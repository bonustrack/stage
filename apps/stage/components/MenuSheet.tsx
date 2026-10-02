import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { errorMessage } from '@stage-labs/client/errors';
import { Text } from '@stage-labs/kit/react-native/text';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { DROPDOWN_MENU } from '@stage-labs/kit/react-native/menu';
import { Col } from './layout';
import { Avatar } from './Avatar';
import { AnchoredMenu } from './AnchoredMenu';
import { MenuRow } from './MenuRows';
import type { MenuPoint } from './AnchoredMenu.model';
import { MENU_ROW } from './menuStyle';
import { useHover } from './hover';
import { usePalette, withAlpha } from '../lib/theme';
import { getPeerName, usePeerProfiles } from '../lib/peerProfiles';
import { AccountManager, shortAddress } from '../modules/messaging';
import { loadAccounts, getActiveAccountId, type AccountRecord } from '../lib/accounts';
import { IMPORT_ROUTE, SIGNUP_ROUTE } from './onboarding/nextRoute.model';
import { report, reported } from '../lib/errorPolicy';
import { IconCheckmark1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCheckmark1';
import { IconPeopleAdd } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPeopleAdd';
import { IconQrCode } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconQrCode';

function AccountSwitchRow({ account, active, onSwitch }: {
  account: AccountRecord; active: boolean; onSwitch: (id: string) => void;
}): React.ReactElement {
  const { link: head, text, border } = usePalette();
  const { hovered, hoverProps } = useHover();
  return (
    <Pressable
      onPress={() => { onSwitch(account.id); }}
      accessibilityRole="menuitem"
      {...hoverProps}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: MENU_ROW.padX, paddingVertical: MENU_ROW.padY,
        backgroundColor: pressed ? withAlpha(head, DROPDOWN_MENU.pressedAlpha) : hovered ? withAlpha(head, DROPDOWN_MENU.hoverAlpha) : 'transparent',
      })}
    >
      <Avatar address={account.address} size={26} style={{ backgroundColor: border }}/>
      <Col minWidth={0} flex={1}>
        <Text weight="semibold" size="3xs" numberOfLines={1} color={head}>
          {getPeerName(account.address) ?? account.label ?? shortAddress(account.address)}
        </Text>
        <Text size="4xs" numberOfLines={1} color={text} style={{ marginTop: 1 }}>
          {shortAddress(account.address)}
        </Text>
      </Col>
      {active ? <Glyph icon={IconCheckmark1} size={16} color={head} /> : null}
    </Pressable>
  );
}

export function MenuSheet({ visible, anchor, onClose }: {
  visible: boolean;
  anchor: MenuPoint | null;
  onClose: () => void;
}): React.ReactElement {
  const router = useRouter();
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
      {accounts.map((a) => (
        <AccountSwitchRow key={a.id} account={a} active={a.id === activeId} onSwitch={onSwitch}/>
      ))}
      <MenuRow key="new-account" icon={IconPeopleAdd} label="New account" onPress={() => { go(SIGNUP_ROUTE); }}/>
      <MenuRow key="import" icon={IconQrCode} label="Import account" onPress={() => { go(IMPORT_ROUTE); }}/>
    </AnchoredMenu>
  );
}
