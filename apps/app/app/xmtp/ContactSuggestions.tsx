/** Tap-to-add contact suggestions for the member picker.
 *
 *  Renders the user's existing DM peers (from `useContacts`) as tappable rows
 *  with avatar + name. Tapping toggles selection — selected contacts show a
 *  filled check. Already-staged members are passed in `selected` so they read
 *  as selected and tapping removes them. The list is hidden when empty (e.g. a
 *  brand-new account with no DMs, or a query that matches no contact). */

import { Pressable } from '@metro-labs/kit/pressable';

import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { usePalette } from '../../lib/theme';
import { shortAddress } from '../../modules/messaging';
import type { Contact } from '../../lib/useContacts';
import { Avatar } from '../../components/Avatar';
import { Col, Row } from '../../components/layout';

/** Selectable list of contact suggestions for staging group members. */
export function ContactSuggestions({
  contacts, selected, onToggle,
}: {
  contacts: Contact[];
  /** Lowercased addresses currently staged — render as selected. */
  selected: Set<string>;
  onToggle: (contact: Contact) => void;
}): React.ReactElement | null {
  const { link: head, text: sub, border } = usePalette();
  if (contacts.length === 0) return null;

  return (
    <Col gap={6}>
      <Text size="xs" color={sub}>
        Suggested contacts
      </Text>
      <Col gap={2}>
        {contacts.map(c => {
          const isSelected = selected.has(c.address);
          return (
            <Pressable
              key={c.address}
              onPress={() => onToggle(c)}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 10,
                borderRadius: 12, paddingHorizontal: 8, paddingVertical: 8,
                backgroundColor: pressed ? border : 'transparent',
              })}
>
              <Avatar
                address={c.address}
                size="md"
                style={{ backgroundColor: border }}
/>
              <Col flex={1} gap={1}>
                <Text weight="semibold" size="md" numberOfLines={1} color={head}>
                  {c.name}
                </Text>
                {c.name !== shortAddress(c.address) && (
                  <Text size="xs" numberOfLines={1} color={sub}>
                    {shortAddress(c.address)}
                  </Text>
                )}
              </Col>
              <Row width={24} height={24} radius="lg" background={isSelected ? head : 'transparent'}
                align="center"
                justify="center"
                style={{ borderWidth: 2, borderColor: isSelected ? head : border }}
>
                {isSelected && <Icon name="check" size={14} color="#fff" />}
              </Row>
            </Pressable>
          );
        })}
      </Col>
    </Col>
  );
}
