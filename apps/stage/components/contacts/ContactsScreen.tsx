import { useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { contactNameModel } from './ContactsScreen.model';
import { ChannelRow, ChannelRowPlaceholder } from '../chatRow/ChannelRow';
import { MenuPage } from '../tabs/MenuPage';
import { usePalette } from '../../lib/theme';
import { useListBottomInset } from '../layout/insets';
import { useContactList, type Contact } from '../../lib/useContacts';
import { getPeerDescription, getPeerHandle, getPeerName } from '../../lib/peerProfiles';
import { dmLinkOf } from '../../lib/links';
import { shortAddress } from '@stage-labs/client/identity/format';
import { SuggestedContacts } from './SuggestedContacts';
import { Column, LIST_TOP_GAP, VirtualList } from '../layout';

const PLACEHOLDER_ROWS = Array.from({ length: 5 }, (_, i) => i);

function ContactsPlaceholder(): React.ReactElement {
  return (
    <Column weight={1} surface="surface" padding={{ top: LIST_TOP_GAP }}>
      {PLACEHOLDER_ROWS.map((i) => (
        <ChannelRowPlaceholder key={i} />
      ))}
    </Column>
  );
}

export function ContactsScreen(): React.ReactElement | null {
  const { bg } = usePalette();
  const router = useRouter();
  const bottomInset = useListBottomInset();
  const { contacts, collected } = useContactList(true);
  const known = useMemo(() => contacts.map((c) => c.address), [contacts]);

  const open = useCallback(
    (address: string): void => {
      router.push(dmLinkOf(address));
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
    <MenuPage id="contacts" list>
      {collected ? (
        <VirtualList
          data={contacts}
          keyExtractor={(c) => c.address}
          renderItem={renderItem}
          extraData={contacts.length}
          style={{ backgroundColor: bg }}
          contentContainerStyle={{ flexGrow: 1, paddingTop: LIST_TOP_GAP, paddingBottom: bottomInset }}
          ListHeaderComponent={<SuggestedContacts known={known} headingTop={0} />}
        />
      ) : (
        <ContactsPlaceholder />
      )}
    </MenuPage>
  );
}
