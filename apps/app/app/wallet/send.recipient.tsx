import { Pressable } from '@stage-labs/kit/react-native/pressable';

import { Text } from '@stage-labs/kit/react-native/text';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Avatar } from '../../components/Avatar';
import { AppModal } from '../../components/AppModal';
import { Row, Col } from '../../components/layout';
import { shortAddress } from '../../modules/messaging';
import { usePeerProfiles, getPeerName } from '../../lib/peerProfiles';
import { useContacts } from '../../lib/useContacts';

interface RowPalette { head: string; sub: string; border: string }

export function RecipientRow({ address, pal, right, onPress }: {
  address: string;
  pal: RowPalette;
  right?: React.ReactNode;
  onPress?: () => void;
}): React.ReactElement {
  const { head, border } = pal;
  usePeerProfiles([address]);
  const name = getPeerName(address) ?? shortAddress(address);
  const showAddrLine = name !== shortAddress(address);

  const inner = (
    <>
      <Avatar
        address={address}
        size="md"
        style={{ backgroundColor: border }}
/>
      <Col minWidth={0} flex={1}>
        <Text weight="semibold" size="md" color={head} numberOfLines={1}>
          {name}
        </Text>
        {showAddrLine ? (
          <Text size="xs" role="secondary" style={{ marginTop: 2 }} numberOfLines={1}>
            {shortAddress(address)}
          </Text>
        ) : null}
      </Col>
      {right}
    </>
  );

  if (!onPress) {
    return (
      <Row background={border} radius="lg" padding={{ x: 14, y: 10 }} align="center" gap={12}>
        {inner}
      </Row>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: pressed ? border : 'transparent', borderRadius: 12,
        paddingHorizontal: 14, paddingVertical: 10,
      })}
>
      {inner}
    </Pressable>
  );
}

export function ContactsModal({ visible, onClose, onPick, pal }: {
  visible: boolean;
  onClose: () => void;
  onPick: (address: string) => void;
  pal: RowPalette & { head: string };
}): React.ReactElement {
  const { head } = pal;
  const contacts = useContacts([], '');

  return (
    <AppModal visible={visible} onClose={onClose}>
      <Text weight="semibold" size="xl" color={head} style={{ marginBottom: 8 }}>
        Contacts
      </Text>
      {contacts.length === 0 ? (
        <Text size="md" role="secondary" style={{ paddingVertical: 16 }}>
          No contacts yet — start a DM to build your list.
        </Text>
      ) : (
        contacts.map((c) => (
          <RecipientRow
            key={c.address}
            address={c.address}
            pal={pal}
            onPress={() => { onPick(c.address); onClose(); }}
/>
        ))
      )}
    </AppModal>
  );
}

export function ContactsButton({ color, border, onPress }: {
  color: string; border: string; onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 40, height: 40, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: pressed ? border : 'transparent',
      })}
>
      <Icon name="users" size={20} color={color}/>
    </Pressable>
  );
}
