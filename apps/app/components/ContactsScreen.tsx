
import { useCallback, useState } from 'react';
import { FlatList } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { Text } from '@stage-labs/kit/react-native/text';
import type { SimultaneousRefs } from './SwipeTabs.types';
import { Col } from './layout';
import { ChannelRow } from './ChannelRow';
import { usePalette } from '../lib/theme';
import { useAllContacts, type Contact } from '../lib/useAllContacts';
import { getPeerName } from '../lib/peerProfiles';
import { openDmWithAddress, shortAddress } from '../modules/messaging';

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
      } catch { } finally { setOpening(null); }
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
