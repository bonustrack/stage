/**
 * @file Contacts swipe-pager tab listing every user the active account can reach
 *  (DM peers plus all group members, deduped and name-sorted via useAllContacts),
 *  each a ChannelRow that opens or starts a DM on tap.
 */

import { useCallback, useState } from 'react';
import { FlatList } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { Text } from '@metro-labs/kit/text';
import type { SimultaneousRefs } from './SwipeTabs.types';
import { Col } from './layout';
import { ChannelRow } from './ChannelRow';
import { usePalette } from '../lib/theme';
import { useAllContacts, type Contact } from '../lib/useAllContacts';
import { getPeerName } from '../lib/peerProfiles';
import { openDmWithAddress, shortAddress } from '../modules/messaging';

/** Renders the Contacts pager tab listing every reachable user, tapping a row opens a DM. */
export function ContactsScreen({ panRef }: { panRef?: SimultaneousRefs } = {}): React.ReactElement {
  const { bg } = usePalette();
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
        onPress={() => { open(item.address); }}
      />
    );
  }, [open]);

  return (
    // The shared Topnav + top inset are hoisted ABOVE the pager in
    // (tabs)/_layout.tsx, so this body renders only the scrollable list.
    <Col surface="surface" flex={1}>
      <FlatList
        simultaneousHandlers={panRef}
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
