/** Presentational pieces of LeftDrawer, split out to keep LeftDrawer.tsx under
 *  the line cap: the avatar header, the tap-to-switch accounts list, and the
 *  Profile/Settings nav row. Behaviour is identical to the inlined version. */

import { Image, Pressable } from 'react-native';
import { Box } from './layout';
import { Text } from '@metro-labs/kit/text';
import { Icon, type HeroIconName } from '@metro-labs/kit/icon';
import { getPeerName } from '../lib/peerProfiles';
import { shortAddress, stampBoxAvatarUrl } from '../lib/xmtp';
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
          <Image
            source={{ uri: stampBoxAvatarUrl(rec.address, 56) }}
            style={{ width: 56, height: 56, borderRadius: 999, backgroundColor: c.border, marginBottom: 10 }}
          />
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

/** Tap-to-switch accounts list. */
export function DrawerAccounts({ accounts, activeId, onSwitch, c }: {
  accounts: AccountRecord[]; activeId: string | null;
  onSwitch: (id: string) => void; c: DrawerColors;
}): React.ReactElement {
  return (
    <Box style={{ paddingVertical: 6 }}>
      {accounts.map((a) => (
        <Pressable
          key={a.id}
          onPress={() => onSwitch(a.id)}
          style={({ pressed }) => ({
            paddingHorizontal: 18, paddingVertical: 11,
            flexDirection: 'row', alignItems: 'center', gap: 12,
            backgroundColor: pressed ? c.border : 'transparent',
          })}
        >
          <Image
            source={{ uri: stampBoxAvatarUrl(a.address, 30) }}
            style={{ width: 30, height: 30, borderRadius: 999, backgroundColor: c.border }}
          />
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: c.head, fontSize: 16, fontFamily: 'Calibre-Semibold' }}>
              {getPeerName(a.address) ?? a.label ?? shortAddress(a.address)}
            </Text>
            <Text numberOfLines={1} style={{ color: c.sub, fontSize: 12, fontFamily: 'Calibre-Medium', marginTop: 1 }}>
              {shortAddress(a.address)}
            </Text>
          </Box>
          {a.id === activeId ? <Icon name="check" size={20} color={c.head} /> : null}
        </Pressable>
      ))}
    </Box>
  );
}

export function DrawerRow({ icon, label, onPress, head, sub, border }: {
  icon: HeroIconName; label: string; onPress: () => void;
  head: string; sub: string; border: string;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 18, paddingVertical: 14,
        flexDirection: 'row', alignItems: 'center', gap: 14,
        backgroundColor: pressed ? border : 'transparent',
      })}
    >
      <Icon name={icon} size={22} color={sub} />
      <Text style={{ color: head, fontSize: 17, fontFamily: 'Calibre-Semibold' }}>{label}</Text>
    </Pressable>
  );
}
