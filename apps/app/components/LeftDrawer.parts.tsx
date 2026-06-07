/** Presentational pieces of LeftDrawer, split out to keep LeftDrawer.tsx under
 *  the line cap: the avatar header, the tap-to-switch accounts list, and the
 *  Profile/Settings nav row. Behaviour is identical to the inlined version. */

import { Box } from './layout';
import { Stamp } from './Stamp';
import { Text } from '@metro-labs/kit/text';
import { Icon, type HeroIconName } from '@metro-labs/kit/icon';
import { ListViewItem } from '@metro-labs/kit/list-view';
import { getPeerName } from '../lib/peerProfiles';
import { shortAddress } from '../lib/xmtp';
import { type AccountRecord } from '../lib/accounts';

export interface DrawerColors { head: string; sub: string; border: string }

/** Avatar header — active account's stamp avatar + name + short address. */
export function DrawerHeader({ rec, c }: {
  rec: AccountRecord | null; c: DrawerColors;
}): React.ReactElement {
  return (
    <Box style={{ paddingHorizontal: 18, paddingBottom: 16 }}>
      {rec ? (
        <>
          <Stamp address={rec.address} size={56} style={{ backgroundColor: c.border, marginBottom: 10 }} />
          <Text numberOfLines={1} style={{ color: c.head, fontSize: 20, fontFamily: 'Calibre-Semibold' }}>
            {getPeerName(rec.address) ?? rec.label ?? shortAddress(rec.address)}
          </Text>
          <Text numberOfLines={1} style={{ color: c.sub, fontSize: 14, fontFamily: 'Calibre-Medium', marginTop: 1 }}>
            {shortAddress(rec.address)}
          </Text>
        </>
      ) : null}
    </Box>
  );
}

/** Tap-to-switch accounts list — emits one ListViewItem per account so the
 *  caller can drop them straight into a shared Kit ListView. */
export function DrawerAccounts({ accounts, activeId, onSwitch, c, dark }: {
  accounts: AccountRecord[]; activeId: string | null;
  onSwitch: (id: string) => void; c: DrawerColors; dark: boolean;
}): React.ReactElement {
  return (
    <>
      {accounts.map((a) => (
        <ListViewItem key={a.id} dark={dark} onPress={() => onSwitch(a.id)}>
          <Stamp address={a.address} size={30} style={{ backgroundColor: c.border }} />
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: c.head, fontSize: 16, fontFamily: 'Calibre-Semibold' }}>
              {getPeerName(a.address) ?? a.label ?? shortAddress(a.address)}
            </Text>
            <Text numberOfLines={1} style={{ color: c.sub, fontSize: 12, fontFamily: 'Calibre-Medium', marginTop: 1 }}>
              {shortAddress(a.address)}
            </Text>
          </Box>
          {a.id === activeId ? <Icon name="check" size={20} color={c.head} /> : null}
        </ListViewItem>
      ))}
    </>
  );
}

/** A single Kit ListView row for the Menu page (account actions + nav). */
export function DrawerRow({ icon, label, onPress, head, sub, dark }: {
  icon: HeroIconName; label: string; onPress: () => void;
  head: string; sub: string; border: string; dark: boolean;
}): React.ReactElement {
  return (
    <ListViewItem dark={dark} onPress={onPress}>
      <Icon name={icon} size={22} color={sub} />
      <Box style={{ flex: 1 }}>
        <Text style={{ color: head, fontSize: 17, fontFamily: 'Calibre-Semibold' }}>{label}</Text>
      </Box>
    </ListViewItem>
  );
}
