/** Contacts page — every user the active account has access to: all DM peers
 *  plus all members of every group the account belongs to, deduplicated by
 *  address and sorted alphabetically by resolved name. Data comes from
 *  `useAllContacts` (live XMTP walk, cache-first, non-blocking); each row reuses
 *  the shared `ChannelRow` (Avatar + name + short address), tapping it opens (or
 *  starts) a DM with that user.
 *
 *  This screen is a 5th bottom-tab destination but is NOT in the swipe pager, so
 *  the hoisted topnav/pager are hidden on /contacts. To stay visually consistent
 *  with the four pager tabs it renders the SAME unified bar (`HoistedTopnav`) and
 *  absorbs the top safe-area inset itself (the way (tabs)/_layout does for the
 *  pager), instead of a separate per-page title. */

import { useCallback, useState } from 'react';
import { FlatList } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Text } from '@metro-labs/kit/text';
import { Box, Col } from './layout';
import { ChannelRow } from './ChannelRow';
import { HoistedTopnav } from './tabs/HoistedTopnav';
import { usePalette } from '../lib/theme';
import { useAllContacts, type Contact } from '../lib/useAllContacts';
import { getPeerName } from '../lib/peerProfiles';
import { openDmWithAddress, shortAddress } from '../modules/messaging';

export function ContactsScreen(): React.ReactElement {
  const { bg } = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { contacts, loading } = useAllContacts();
  const [opening, setOpening] = useState<string | null>(null);

  const open = useCallback((address: string): void => {
    if (opening) return;
    setOpening(address);
    void (async (): Promise<void> => {
      try {
        const id = await openDmWithAddress(address);
        router.push({ pathname: '/xmtp/[convId]', params: { convId: id } });
      } catch { /* swallow */ } finally { setOpening(null); }
    })();
  }, [opening, router]);

  const renderItem = useCallback(({ item }: { item: Contact }): React.ReactElement => {
    const name = getPeerName(item.address) ?? item.name;
    const hasName = !!getPeerName(item.address);
    return (
      <ChannelRow
        title={name}
        avatarAddress={item.address}
        square={false}
        subtitle={hasName ? shortAddress(item.address) : null}
        onPress={() => open(item.address)}
      />
    );
  }, [open]);

  return (
    <Col surface="surface" flex={1}>
      {/* Same unified bar as the four pager tabs. The pager/topnav are hidden on
          this route, so absorb the top safe-area inset here (the way
          (tabs)/_layout does for the pager) and render the shared HoistedTopnav
          under it, instead of a separate per-page title. */}
      <Box surface="toolbar" padding={{ top: insets.top }}/>
      <HoistedTopnav/>
      <FlatList
        data={contacts}
        keyExtractor={c => c.address}
        renderItem={renderItem}
        extraData={contacts.length}
        style={{ flex: 1, backgroundColor: bg }}
        contentContainerStyle={{ flexGrow: 1, paddingTop: 4 }}
        ListEmptyComponent={
          <Col flex={1} align="center" justify="center" padding={{ x: 24, y: 48 }}>
            <Text size="md" role="secondary" style={{ textAlign: 'center' }}>
              {loading ? 'Loading contacts…' : 'No contacts yet. Start a chat to add one.'}
            </Text>
          </Col>
        }
      />
    </Col>
  );
}
