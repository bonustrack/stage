
import { Text } from '@stage-labs/kit/react-native/text';
import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import type { PayloadHandlers, WidgetRoot } from '@stage-labs/kit/kit';
import { stampAvatarUrl } from '@stage-labs/kit/avatar';
import { suggestionRow, SUGGESTION_TOGGLE } from '@stage-labs/views';
import { usePalette } from '../../lib/theme';
import { shortAddress } from '../../modules/messaging';
import type { Contact } from '../../lib/useContacts';
import { Col } from '../../components/layout';

export function ContactSuggestions({
  contacts, selected, onToggle,
}: {
  contacts: Contact[];
  selected: Set<string>;
  onToggle: (contact: Contact) => void;
}): React.ReactElement | null {
  const { link: head } = usePalette();
  if (contacts.length === 0) return null;

  const node: WidgetRoot = {
    type: 'ListView',
    children: contacts.map((c) =>
      suggestionRow({
        address: c.address,
        name: c.name,
        avatarUri: stampAvatarUrl(c.address, 80),
        handle: c.name !== shortAddress(c.address) ? shortAddress(c.address) : undefined,
        selected: selected.has(c.address),
        checkBackground: head,
      }),
    ),
  };

  const actions: PayloadHandlers = {
    [SUGGESTION_TOGGLE]: (payload) => {
      const address = payload.address;
      const contact = contacts.find((c) => c.address === address);
      if (contact) onToggle(contact);
    },
  };

  return (
    <Col gap={6}>
      <Text size="xs" role="secondary">
        Suggested contacts
      </Text>
      <ViewHost node={node} actions={actions} />
    </Col>
  );
}
