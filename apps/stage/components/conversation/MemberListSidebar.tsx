import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { DROPDOWN_MENU } from '@stage-labs/kit/react-native/menu';
import { Box, Row, VirtualList, PAGE_GUTTER } from '../layout';
import { Avatar } from '../Avatar';
import { CountTag } from '../CountTag';
import { Eyebrow } from '../Eyebrow';
import { HoverTooltip } from '../HoverTooltip';
import { useSelfAddress } from '../ProfileScreen.parts';
import { memberListEntries, type MemberAdminMark, type MemberListEntry } from './MemberListSidebar.model';
import { useChannelRoles } from '../channel/channel.detail';
import { useConvMeta, shortAddress } from '../../modules/messaging';
import { getPeerName, usePeerProfiles } from '../../lib/peerProfiles';
import { profileLinkOf } from '../../lib/links';
import { usePalette, withAlpha } from '../../lib/theme';
import { IconCrown } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCrown';
import { IconShield } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconShield';

const ROW_HEIGHT = 44;
const ROW_INSET = 8;
const ADMIN_ICONS = { superAdmin: IconCrown, admin: IconShield } as const;

function AdminMark({ mark, color }: { mark: MemberAdminMark; color: string }): React.ReactElement {
  return (
    <HoverTooltip label={mark.label}>
      <Row accessible accessibilityRole="image" accessibilityLabel={mark.label}>
        <Glyph icon={ADMIN_ICONS[mark.role]} size={16} color={color}/>
      </Row>
    </HoverTooltip>
  );
}

function MemberListRow({ entry, onPress }: { entry: MemberListEntry; onPress: () => void }): React.ReactElement {
  const { link, border, sub } = usePalette();
  return (
    <Box padding={{ x: ROW_INSET }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={entry.admin === undefined ? entry.name : `${entry.name}, ${entry.admin.label}`}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 12, height: ROW_HEIGHT,
          paddingHorizontal: PAGE_GUTTER - ROW_INSET, borderRadius: 8,
          backgroundColor: pressed ? withAlpha(link, DROPDOWN_MENU.pressedAlpha) : 'transparent',
        })}
>
        <Avatar address={entry.address} size="md" style={{ backgroundColor: border }}/>
        <Row align="center" gap={6} flex={1}>
          <Text size="lg" weight="medium" numberOfLines={1} style={{ flexShrink: 1 }}>{entry.name}</Text>
          {entry.admin === undefined ? null : <AdminMark mark={entry.admin} color={sub}/>}
        </Row>
      </Pressable>
    </Box>
  );
}

export function MemberListSidebar({ convId }: { convId: string }): React.ReactElement {
  const router = useRouter();
  const { memberAddrs, inboxToAddr } = useConvMeta(convId);
  const roles = useChannelRoles(convId, inboxToAddr);
  const self = useSelfAddress();
  const addresses = useMemo(() => (self ? [self, ...memberAddrs] : memberAddrs), [self, memberAddrs]);
  const profiles = usePeerProfiles(addresses);
  const entries = useMemo(
    () => memberListEntries(addresses, getPeerName, shortAddress, roles),
    [addresses, profiles, roles],
  );
  return (
    <>
      <Row align="center" gap={8} padding={{ x: PAGE_GUTTER, top: PAGE_GUTTER, bottom: 8 }}>
        <Eyebrow>MEMBERS</Eyebrow>
        <CountTag count={entries.length}/>
      </Row>
      <VirtualList
        scroll="self"
        data={entries}
        extraData={profiles}
        keyExtractor={(entry) => entry.address.toLowerCase()}
        contentContainerStyle={{ paddingBottom: PAGE_GUTTER }}
        renderItem={({ item }) => (
          <MemberListRow entry={item} onPress={() => { router.push(profileLinkOf(item.address)); }}/>
        )}
      />
    </>
  );
}
