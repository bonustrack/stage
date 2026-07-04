
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Image } from '@stage-labs/kit/react-native/image';
import { ListView, ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { stampAvatarUrl } from '@stage-labs/kit/avatar';
import { ON_PRIMARY_COLOR } from '@views';
import { usePalette } from '../../lib/theme';
import { shortAddress } from '../../modules/messaging';
import type { Contact } from '../../lib/useContacts';
import { Col, Row } from '../../components/layout';

function SuggestionCheck({ selected, checkBackground, dark }: {
  selected: boolean; checkBackground: string; dark: boolean;
}): React.ReactElement {
  if (selected) {
    return (
      <Row width={24} height={24} radius="lg" background={checkBackground} align="center" justify="center">
        <Icon
          name="check"
          size={14}
          color={dark ? ON_PRIMARY_COLOR.dark : ON_PRIMARY_COLOR.light}
          dark={dark}
        />
      </Row>
    );
  }
  const side = { width: 2, color: checkBackground };
  return (
    <Row
      width={24}
      height={24}
      radius="lg"
      align="center"
      justify="center"
      border={{ top: side, right: side, bottom: side, left: side }}
    />
  );
}

function SuggestionRow({ contact, selected, checkBackground, dark, onToggle }: {
  contact: Contact; selected: boolean; checkBackground: string; dark: boolean;
  onToggle: (contact: Contact) => void;
}): React.ReactElement {
  const short = shortAddress(contact.address);
  const handle = contact.name !== short ? short : undefined;
  return (
    <ListViewItem align="center" gap={10} dark={dark} onPress={() => { onToggle(contact); }}>
      <Row align="center" gap={10} flex={1}>
        <Image src={stampAvatarUrl(contact.address, 80)} size={36} radius="full" />
        <Col gap={1} flex={1}>
          <Text value={contact.name} weight="semibold" truncate />
          {handle === undefined ? null : (
            <Caption value={handle} color="secondary" truncate />
          )}
        </Col>
        <SuggestionCheck selected={selected} checkBackground={checkBackground} dark={dark} />
      </Row>
    </ListViewItem>
  );
}

export function ContactSuggestions({
  contacts, selected, onToggle,
}: {
  contacts: Contact[];
  selected: Set<string>;
  onToggle: (contact: Contact) => void;
}): React.ReactElement | null {
  const { link: head } = usePalette();
  const dark = useKitScheme() === 'dark';
  if (contacts.length === 0) return null;

  return (
    <Col gap={6}>
      <Text size="xs" role="secondary">
        Suggested contacts
      </Text>
      <ListView dark={dark}>
        {contacts.map((c) => (
          <SuggestionRow
            key={c.address}
            contact={c}
            selected={selected.has(c.address)}
            checkBackground={head}
            dark={dark}
            onToggle={onToggle}
          />
        ))}
      </ListView>
    </Col>
  );
}
