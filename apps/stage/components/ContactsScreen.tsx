
import { useCallback } from 'react';
import { FlatList } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { Text } from '@stage-labs/kit/react-native/text';
import { contactNameModel, contactsEmptyLabel } from './ContactsScreen.model';
import type { SimultaneousRefs } from './SwipeTabs.types';
import { Col, WEB_EDGE_SCROLL, WEB_EDGE_CONTENT } from './layout';
import { useWebTabsContentPad } from './tabs/webPad';
import { ChannelRow } from './ChannelRow';
import { usePalette } from '../lib/theme';
import { useAllContacts, type Contact } from '../lib/useAllContacts';
import { getPeerName } from '../lib/peerProfiles';
import { shortAddress } from '../modules/messaging';

export function ContactsScreen({ panRef }: { panRef?: SimultaneousRefs } = {}): React.ReactElement {
  const webTabsPad = useWebTabsContentPad();
  const { bg } = usePalette();
  const router = useRouter();
  const { contacts, loading } = useAllContacts();

  const open = useCallback((address: string): void => {
    router.push({ pathname: '/[convId]', params: { convId: address } });
  }, [router]);

  const renderItem = useCallback(({ item }: { item: Contact }): React.ReactElement => {
    const model = contactNameModel({
      resolvedName: getPeerName(item.address) ?? null,
      fallbackName: item.name,
      shortAddress: shortAddress(item.address),
    });
    return (
      <ChannelRow
        title={model.name}
        avatarAddress={item.address}
        square={false}
        subtitle={model.handle ?? null}
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
        style={[{ flex: 1, backgroundColor: bg }, WEB_EDGE_SCROLL]}
        contentContainerStyle={[{ flexGrow: 1, paddingTop: 4 }, WEB_EDGE_CONTENT, webTabsPad]}
        ListEmptyComponent={
          <Col flex={1} align="center" justify="center" padding={{ x: 24, y: 48 }}>
            <Text size="md" role="secondary" style={{ textAlign: 'center' }}>
              {contactsEmptyLabel(loading)}
            </Text>
          </Col>
        }
      />
    </Col>
  );
}
