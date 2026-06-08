/** Presentational pieces of LeftDrawer, split out to keep LeftDrawer.tsx under
 *  the line cap: the avatar header, the tap-to-switch accounts list, and the
 *  Profile/Settings nav row. Behaviour is identical to the inlined version. */

import { Box } from './layout';
import { fontSize } from '@metro-labs/kit/tokens';
import { Avatar } from './Avatar';
import { Text } from '@metro-labs/kit/text';
import { Icon, type HeroIconName } from '@metro-labs/kit/icon';
import { ListViewItem } from '@metro-labs/kit/list-view';
import { getPeerName } from '../lib/peerProfiles';
import { shortAddress } from '../modules/messaging';
import { type AccountRecord } from '../lib/accounts';

export interface DrawerColors { head: string; sub: string; border: string }

/** Avatar header - active account's stamp avatar + name + short address. */
export function DrawerHeader({ rec, c }: {
  rec: AccountRecord | null; c: DrawerColors;
}): React.ReactElement {
  return (
    <Box style={{ paddingHorizontal: 18, paddingBottom: 16 }}>
      {rec ? (
        <>
          <Avatar address={rec.address} size={56} style={{ backgroundColor: c.border, marginBottom: 10 }} />
          <Text numberOfLines={1} style={{ color: c.head, fontSize: fontSize('xl'), fontFamily: 'Calibre-Semibold' }}>
            {getPeerName(rec.address) ?? rec.label ?? shortAddress(rec.address)}
          </Text>
          <Text numberOfLines={1} style={{ color: c.sub, fontSize: fontSize('md'), fontFamily: 'Calibre-Medium', marginTop: 1 }}>
            {shortAddress(rec.address)}
          </Text>
        </>
      ) : null}
    </Box>
  );
}

/** Tap-to-switch accounts list - returns a flat array of ListViewItems (one per
 *  account) so the caller spreads them as DIRECT ListView children, letting the
 *  Kit ListView draw its inset divider between every row. */
export function drawerAccountRows({ accounts, activeId, onSwitch, c, dark }: {
  accounts: AccountRecord[]; activeId: string | null;
  onSwitch: (id: string) => void; c: DrawerColors; dark: boolean;
}): React.ReactElement[] {
  return accounts.map((a) => (
    <ListViewItem key={a.id} dark={dark} onPress={() => onSwitch(a.id)}>
      <Avatar address={a.address} size={30} style={{ backgroundColor: c.border }} />
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: c.head, fontSize: fontSize('md'), fontFamily: 'Calibre-Semibold' }}>
          {getPeerName(a.address) ?? a.label ?? shortAddress(a.address)}
        </Text>
        <Text numberOfLines={1} style={{ color: c.sub, fontSize: fontSize('sm'), fontFamily: 'Calibre-Medium', marginTop: 1 }}>
          {shortAddress(a.address)}
        </Text>
      </Box>
      {a.id === activeId ? <Icon name="check" size={20} color={c.head} /> : null}
    </ListViewItem>
  ));
}

/** A single Kit ListView row for the Menu page (account actions + nav), styled
 *  to match the canonical Settings list: head-colored leading icon, Calibre-
 *  Medium 18px label, trailing chevron. */
export function DrawerRow({ rowKey, icon, label, onPress, head, sub, dark }: {
  rowKey?: string; icon: HeroIconName; label: string; onPress: () => void;
  head: string; sub: string; border: string; dark: boolean;
}): React.ReactElement {
  return (
    <ListViewItem key={rowKey} dark={dark} onPress={onPress}>
      <Icon name={icon} size={22} color={head} />
      <Box style={{ flex: 1 }}>
        <Text style={{ color: head, fontSize: fontSize('lg'), fontFamily: 'Calibre-Medium' }}>{label}</Text>
      </Box>
      <Icon name="chevronRight" size={18} color={sub} />
    </ListViewItem>
  );
}
