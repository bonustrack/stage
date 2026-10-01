
import { useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { contactNameModel } from './ContactsScreen.model';
import type { SimultaneousRefs } from './SwipeTabs.types';
import { Col, LIST_TOP_GAP, VirtualList } from './layout';
import { ChannelRow } from './ChannelRow';
import { usePalette } from '../lib/theme';
import { useAllContacts, type Contact } from '../lib/useAllContacts';
import { getPeerDescription, getPeerHandle, getPeerName } from '../lib/peerProfiles';
import { shortAddress } from '../modules/messaging';
import { SuggestedContacts } from './SuggestedContacts';

export function ContactsScreen({ panRef }: { panRef?: SimultaneousRefs } = {}): React.ReactElement {
  const { bg } = usePalette();
  const router = useRouter();
  const { contacts } = useAllContacts();
  const known = useMemo(() => contacts.map((c) => c.address), [contacts]);

  const open = useCallback((address: string): void => {
    router.push({ pathname: '/[convId]', params: { convId: address } });
  }, [router]);

  const renderItem = useCallback(({ item }: { item: Contact }): React.ReactElement => {
    const model = contactNameModel({
      resolvedName: getPeerName(item.address) ?? null,
      fallbackName: item.name,
      shortAddress: shortAddress(item.address),
      description: getPeerDescription(item.address),
      handle: getPeerHandle(item.address),
    });
    return (
      <ChannelRow
        title={model.name}
        avatarAddress={item.address}
        square={false}
        subtitle={model.subtitle}
        previewLines={1}
        onPress={() => { open(item.address); }}
      />
    );
  }, [open]);

  return (
    <Col surface="surface" flex={1}>
      <VirtualList
        simultaneousHandlers={panRef}
        data={contacts}
        keyExtractor={c => c.address}
        renderItem={renderItem}
        extraData={contacts.length}
        style={{ backgroundColor: bg }}
        contentContainerStyle={{ flexGrow: 1, paddingTop: LIST_TOP_GAP }}
        ListHeaderComponent={<SuggestedContacts known={known} headingTop={0} />}
      />
    </Col>
  );
}
