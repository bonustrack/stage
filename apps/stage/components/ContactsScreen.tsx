import { useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { contactNameModel } from './ContactsScreen.model';
import { ChannelRow } from './ChannelRow';
import { StackHeader } from './chrome/StackHeader';
import { usePalette } from '../lib/theme';
import { Platform } from 'react-native';
import { useBottomChromeHeight } from '../lib/bottomChrome';
import { useSafeAreaInsets } from '../lib/safeArea';
import { useAllContacts, type Contact } from '../lib/useContacts';
import { getPeerDescription, getPeerHandle, getPeerName } from '../lib/peerProfiles';
import { shortAddress } from '@stage-labs/client/identity/format';
import { SuggestedContacts } from './SuggestedContacts';
import { Column, LIST_TOP_GAP, VirtualList } from './layout';

export function ContactsScreen(): React.ReactElement {
  const { bg } = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomChrome = useBottomChromeHeight();
  const { contacts } = useAllContacts();
  const known = useMemo(() => contacts.map((c) => c.address), [contacts]);

  const open = useCallback(
    (address: string): void => {
      router.push({ pathname: '/[convId]', params: { convId: address } });
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: Contact }): React.ReactElement => {
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
          onPress={() => {
            open(item.address);
          }}
        />
      );
    },
    [open],
  );

  return (
    <Column surface="surface" weight={1}>
      <StackHeader title="Contacts" back={false} />
      <VirtualList
        data={contacts}
        keyExtractor={(c) => c.address}
        renderItem={renderItem}
        extraData={contacts.length}
        style={{ backgroundColor: bg }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: LIST_TOP_GAP,
          paddingBottom: insets.bottom + (Platform.OS === 'web' ? bottomChrome : 0),
        }}
        ListHeaderComponent={<SuggestedContacts known={known} headingTop={0} />}
      />
    </Column>
  );
}
