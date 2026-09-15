import { Col } from './layout';
import { Avatar } from './Avatar';
import { Text } from '@stage-labs/kit/react-native/text';
import { Icon, type HeroIconName } from '@stage-labs/kit/react-native/icon';
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { getPeerName } from '../lib/peerProfiles';
import { shortAddress } from '../modules/messaging';
import { type AccountRecord } from '../lib/accounts';
import { MenuHover, MenuRow, menuRowPadding } from './MenuRows';

interface DrawerColors { head: string; sub: string; border: string }

export function drawerAccountRows({ accounts, activeId, onSwitch, c, dark, compact }: {
  accounts: AccountRecord[]; activeId: string | null;
  onSwitch: (id: string) => void; c: DrawerColors; dark: boolean; compact: boolean;
}): React.ReactElement[] {
  return accounts.map((a) => (
    <MenuHover key={a.id} compact={compact}>
    <ListViewItem dark={dark} onPress={() => { onSwitch(a.id); }} gap={compact ? 10 : 12} padding={menuRowPadding(compact)}>
      <Avatar address={a.address} size={compact ? 26 : 30} style={{ backgroundColor: c.border }}/>
      <Col minWidth={0} flex={1}>
        <Text weight="semibold" size={compact ? 'sm' : 'md'} numberOfLines={1} color={c.head}>
          {getPeerName(a.address) ?? a.label ?? shortAddress(a.address)}
        </Text>
        <Text size="xs" numberOfLines={1} color={c.sub} style={{ marginTop: 1 }}>
          {shortAddress(a.address)}
        </Text>
      </Col>
      {a.id === activeId ? <Icon name="check" size={compact ? 16 : 20} color={c.head} /> : null}
    </ListViewItem>
    </MenuHover>
  ));
}

export function DrawerRow({ rowKey, icon, label, onPress, dark }: {
  rowKey?: string; icon: HeroIconName; label: string; onPress: () => void; dark: boolean;
}): React.ReactElement {
  return <MenuRow key={rowKey} icon={icon} label={label} dark={dark} onPress={onPress} chevron />;
}
