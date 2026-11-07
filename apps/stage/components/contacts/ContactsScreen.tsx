import { useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { contactNameModel } from './ContactsScreen.model';
import { ChannelRow, ChannelRowPlaceholder } from '../chatRow/ChannelRow';
import { MenuPage } from '../tabs/MenuPage';
import { PAGES } from '../tabs/pages';
import { useTabFocused } from '../tabs/useTabFocused';
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

export function ContactsScreen(): React.ReactElement {
  return (
    <MenuPage id="contacts" list>
      <ContactsBody active />
    </MenuPage>
  );
}

export function ContactsTab(): React.ReactElement {
  const opened = useTabFocused(PAGES.contacts.href);
  return <ContactsBody active={usePathname() === PAGES.contacts.href || opened} />;
}

function ContactsBody({ active }: { active: boolean }): React.ReactElement {
  const { bg } = usePalette();
  const router = useRouter();
  const bottomInset = useListBottomInset();
  const { contacts, collected } = useContactList(active);
  const known = useMemo(() => contacts.map((c) => c.address), [contacts]);

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
            router.push(dmLinkOf(item.address));
          }}
        />
      );
    },
    [router],
  );

  if (!collected) return <ContactsPlaceholder />;
  return (
    <VirtualList
      data={contacts}
      keyExtractor={(c) => c.address}
      renderItem={renderItem}
      extraData={contacts.length}
      style={{ backgroundColor: bg }}
      contentContainerStyle={{ flexGrow: 1, paddingTop: LIST_TOP_GAP, paddingBottom: bottomInset }}
      ListHeaderComponent={<SuggestedContacts known={known} headingTop={0} />}
    />
  );
}
