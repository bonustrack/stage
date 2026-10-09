
import { useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { contactNameModel } from './ContactsScreen.model';
import { Col, LIST_TOP_GAP, VirtualList } from './layout';
import { ChannelRow } from './ChannelRow';
import { StackHeader } from './chrome/StackHeader';
import { usePalette } from '../lib/theme';
import { SETTINGS_ROUTE } from '../lib/routes';
import { useSafeAreaInsets } from '../lib/safeArea';
import { useAllContacts, type Contact } from '../lib/useContacts';
import { getPeerDescription, getPeerHandle, getPeerName } from '../lib/peerProfiles';
import { shortAddress } from '@stage-labs/client/identity/format';
import { SuggestedContacts } from './SuggestedContacts';

export function ContactsScreen(): React.ReactElement {
  const { bg } = usePalette();
  const insets = useSafeAreaInsets();
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
      <StackHeader title="Contacts" backTo={SETTINGS_ROUTE} />
      <VirtualList
        data={contacts}
        keyExtractor={c => c.address}
        renderItem={renderItem}
        extraData={contacts.length}
        style={{ backgroundColor: bg }}
        contentContainerStyle={{ flexGrow: 1, paddingTop: LIST_TOP_GAP, paddingBottom: insets.bottom }}
        ListHeaderComponent={<SuggestedContacts known={known} headingTop={0} />}
      />
    </Col>
  );
}
