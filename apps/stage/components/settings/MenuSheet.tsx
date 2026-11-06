import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { errorMessage } from '@stage-labs/client/errors';
import { Text } from '@stage-labs/kit/react-native/text';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { DROPDOWN_MENU, DropdownMenuItem, useDropdownMenuText } from '@stage-labs/kit/react-native/menu';
import { Avatar } from '../Avatar';
import { AnchoredMenu } from '../AnchoredMenu';
import { MenuRow } from '../MenuRows';
import type { MenuPoint } from '../AnchoredMenu.model';
import { usePalette } from '../../lib/theme';
import { getPeerName, usePeerProfiles } from '../../lib/peerProfiles';
import { switchToAccount } from '../../lib/xmtp.client';
import { shortAddress } from '@stage-labs/client/identity/format';
import { loadAccounts, getActiveAccountId, type AccountRecord } from '../../lib/accounts';
import { IMPORT_ROUTE, SIGNUP_ROUTE } from '../onboarding/nextRoute.model';
import { report, reported } from '../../lib/errorPolicy';
import { IconCheckmark1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCheckmark1';
import { IconPeopleAdd } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPeopleAdd';
import { IconQrCode } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconQrCode';
import { Column } from '../layout';
import { capabilities } from '../../lib/capabilities';

const ACCOUNT_ROW_GAP = 10;
const FIXED_ROW_PADDING = { paddingVertical: DROPDOWN_MENU.itemPadY };

function AccountSwitchRow({
  account,
  active,
  onSwitch,
}: {
  account: AccountRecord;
  active: boolean;
  onSwitch: (id: string) => void;
}): React.ReactElement {
  const { link: head, text, border } = usePalette();
  const menuText = useDropdownMenuText();
  const name = getPeerName(account.address) ?? account.label ?? shortAddress(account.address);
  const address = shortAddress(account.address);
  return (
    <DropdownMenuItem
      label={`${name} ${address}`}
      gap={ACCOUNT_ROW_GAP}
      style={FIXED_ROW_PADDING}
      leading={<Avatar address={account.address} size={26} style={{ backgroundColor: border }} />}
      trailing={active ? <Glyph icon={IconCheckmark1} size={16} color={head} /> : null}
      onPress={() => {
        onSwitch(account.id);
      }}
    >
      <Column minWidth={0}>
        <Text {...menuText} fontWeight="semibold" numberOfLines={1} color={head}>
          {name}
        </Text>
        <Text size="3xs" numberOfLines={1} color={text} style={{ marginTop: 1 }}>
          {address}
        </Text>
      </Column>
    </DropdownMenuItem>
  );
}

export function MenuSheet({
  visible,
  anchor,
  onClose,
}: {
  visible: boolean;
  anchor: MenuPoint | null;
  onClose: () => void;
}): React.ReactElement {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    void Promise.all([loadAccounts(), getActiveAccountId()])
      .then(([list, active]) => {
        setAccounts(list);
        setActiveId(active);
      })
      .catch(reported('menu.accounts'));
  }, [visible]);
  usePeerProfiles(accounts.map((a) => a.address));

  function go(href: typeof SIGNUP_ROUTE | typeof IMPORT_ROUTE): void {
    onClose();
    router.navigate(href);
  }

  function onSwitch(id: string): void {
    onClose();
    if (id === activeId) return;
    void (async () => {
      try {
        await switchToAccount(id);
      } catch (err) {
        report('menu.switchAccount', err);
        capabilities.alert('Switch failed', errorMessage(err));
      }
    })();
  }

  return (
    <AnchoredMenu visible={visible} onClose={onClose} anchor={anchor}>
      {accounts.map((a) => (
        <AccountSwitchRow key={a.id} account={a} active={a.id === activeId} onSwitch={onSwitch} />
      ))}
      <MenuRow
        key="new-account"
        icon={IconPeopleAdd}
        label="New account"
        onPress={() => {
          go(SIGNUP_ROUTE);
        }}
      />
      <MenuRow
        key="import"
        icon={IconQrCode}
        label="Import account"
        onPress={() => {
          go(IMPORT_ROUTE);
        }}
      />
    </AnchoredMenu>
  );
}
