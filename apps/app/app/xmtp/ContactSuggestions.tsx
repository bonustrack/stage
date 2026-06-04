/** Tap-to-add contact suggestions for the member picker.
 *
 *  Renders the user's existing DM peers (from `useContacts`) as tappable rows
 *  with avatar + name. Tapping toggles selection — selected contacts show a
 *  filled check. Already-staged members are passed in `selected` so they read
 *  as selected and tapping removes them. The list is hidden when empty (e.g. a
 *  brand-new account with no DMs, or a query that matches no contact). */

import { Pressable } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { usePalette } from '../../lib/theme';
import { shortAddress } from '../../lib/xmtp';
import type { Contact } from '../../lib/useContacts';
import { Avatar } from '../../components/Avatar';
import { Col, Row } from '../../components/layout';

export function ContactSuggestions({
  contacts, selected, onToggle,
}: {
  contacts: Contact[];
  /** Lowercased addresses currently staged — render as selected. */
  selected: Set<string>;
  onToggle: (contact: Contact) => void;
}): React.ReactElement | null {
  const { head, sub, border, primary } = usePalette();
  if (contacts.length === 0) return null;

  return (
    <Col gap={6}>
      <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>
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
                imageUri={c.avatar}
                size="md"
                cacheBuster={c.cacheBuster}
                style={{ backgroundColor: border }}
              />
              <Col flex={1} gap={1}>
                <Text numberOfLines={1} style={{ color: head, fontSize: 15, fontFamily: 'Calibre-Semibold' }}>
                  {c.name}
                </Text>
                {c.name !== shortAddress(c.address) && (
                  <Text numberOfLines={1} style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>
                    {shortAddress(c.address)}
                  </Text>
                )}
              </Col>
              <Row
                align="center"
                justify="center"
                style={{
                  width: 24, height: 24, borderRadius: 12, borderWidth: 2,
                  borderColor: isSelected ? primary : border,
                  backgroundColor: isSelected ? primary : 'transparent',
                }}
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
