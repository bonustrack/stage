import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { DROPDOWN_MENU } from '@stage-labs/kit/react-native/menu';
import { Row, VirtualList, PAGE_GUTTER } from '../layout';
import { Avatar } from '../Avatar';
import { CountTag } from '../CountTag';
import { Eyebrow } from '../Eyebrow';
import { useSelfAddress } from '../ProfileScreen.parts';
import { memberListEntries, type MemberListEntry } from './MemberListSidebar.model';
import { useConvMeta, shortAddress } from '../../modules/messaging';
import { getPeerName, usePeerProfiles } from '../../lib/peerProfiles';
import { profileLinkOf } from '../../lib/links';
import { usePalette, withAlpha } from '../../lib/theme';

const ROW_HEIGHT = 44;
const ROW_INSET = 8;

function MemberListRow({ entry, onPress }: { entry: MemberListEntry; onPress: () => void }): React.ReactElement {
  const { link, border } = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={entry.name}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 12, height: ROW_HEIGHT,
        marginHorizontal: ROW_INSET, paddingHorizontal: PAGE_GUTTER - ROW_INSET, borderRadius: 8,
        backgroundColor: pressed ? withAlpha(link, DROPDOWN_MENU.pressedAlpha) : 'transparent',
      })}
>
      <Avatar address={entry.address} size="md" style={{ backgroundColor: border }}/>
      <Text size="lg" weight="medium" numberOfLines={1} style={{ flex: 1 }}>{entry.name}</Text>
    </Pressable>
  );
}

export function MemberListSidebar({ convId }: { convId: string }): React.ReactElement {
  const router = useRouter();
  const { memberAddrs } = useConvMeta(convId);
  const self = useSelfAddress();
  const addresses = useMemo(() => (self ? [self, ...memberAddrs] : memberAddrs), [self, memberAddrs]);
  const profiles = usePeerProfiles(addresses);
  const entries = useMemo(
    () => memberListEntries(addresses, getPeerName, shortAddress),
    [addresses, profiles],
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
