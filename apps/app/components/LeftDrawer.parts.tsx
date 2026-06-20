
import { Box, Col } from './layout';

import { Avatar } from './Avatar';
import { Text } from '@stage-labs/kit/text';
import { Icon, type HeroIconName } from '@stage-labs/kit/icon';
import { ListViewItem } from '@stage-labs/kit/list-view';
import { getPeerName } from '../lib/peerProfiles';
import { shortAddress } from '../modules/messaging';
import { type AccountRecord } from '../lib/accounts';

export interface DrawerColors { head: string; sub: string; border: string }

export function DrawerHeader({ rec, c }: {
  rec: AccountRecord | null; c: DrawerColors;
}): React.ReactElement {
  return (
    <Box padding={{ x: 18, bottom: 16 }}>
      {rec ? (
        <>
          <Avatar address={rec.address} size={56} style={{ backgroundColor: c.border, marginBottom: 10 }}/>
          <Text weight="semibold" size="4xl" numberOfLines={1} color={c.head}>
            {getPeerName(rec.address) ?? rec.label ?? shortAddress(rec.address)}
          </Text>
          <Text size="md" numberOfLines={1} color={c.sub} style={{ marginTop: 1 }}>
            {shortAddress(rec.address)}
          </Text>
        </>
      ) : null}
    </Box>
  );
}

export function drawerAccountRows({ accounts, activeId, onSwitch, c, dark }: {
  accounts: AccountRecord[]; activeId: string | null;
  onSwitch: (id: string) => void; c: DrawerColors; dark: boolean;
}): React.ReactElement[] {
  return accounts.map((a) => (
    <ListViewItem key={a.id} dark={dark} onPress={() => { onSwitch(a.id); }}>
      <Avatar address={a.address} size={30} style={{ backgroundColor: c.border }}/>
      <Col minWidth={0} flex={1}>
        <Text weight="semibold" size="md" numberOfLines={1} color={c.head}>
          {getPeerName(a.address) ?? a.label ?? shortAddress(a.address)}
        </Text>
        <Text size="xs" numberOfLines={1} color={c.sub} style={{ marginTop: 1 }}>
          {shortAddress(a.address)}
        </Text>
      </Col>
      {a.id === activeId ? <Icon name="check" size={20} color={c.head} /> : null}
    </ListViewItem>
  ));
}

export function DrawerRow({ rowKey, icon, label, onPress, head, sub, dark }: {
  rowKey?: string; icon: HeroIconName; label: string; onPress: () => void;
  head: string; sub: string; border: string; dark: boolean;
}): React.ReactElement {
  return (
    <ListViewItem key={rowKey} dark={dark} onPress={onPress}>
      <Icon name={icon} size={22} color={head}/>
      <Col flex={1}>
        <Text size="xl" color={head}>{label}</Text>
      </Col>
      <Icon name="chevronRight" size={18} color={sub}/>
    </ListViewItem>
  );
}
