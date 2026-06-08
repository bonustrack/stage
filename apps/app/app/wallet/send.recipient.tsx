/** Recipient user-row + contacts picker for the Wallet → Send screen.
 *
 *  - `RecipientRow` renders a resolved recipient as the same avatar + name +
 *    short-address row the app uses everywhere else (Search results, member
 *    picker): `Avatar` + `getPeerName`/`getPeerAvatarCb` + `shortAddress`. It
 *    fetches the peer's Snapshot profile (name/avatar) via the shared
 *    `peerProfiles` cache so a known contact shows their display name.
 *
 *  - `ContactsModal` is an `AppModal` bottom-sheet (same pattern as the
 *    TokenSelector) listing the user's contacts — their existing 1:1 DM peers
 *    via `useContacts` — as the same user-row. Tapping one fills the recipient.
 *
 *  No bespoke/gold styling — Kit `Text`/`Icon` + palette tokens only. */
import { Pressable } from '@metro-labs/kit/pressable';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Avatar } from '../../components/Avatar';
import { AppModal } from '../../components/AppModal';
import { Box } from '../../components/layout';
import { shortAddress } from '../../modules/messaging';
import {
  usePeerProfiles, getPeerName, getPeerAvatar, getPeerAvatarCb,
} from '../../lib/peerProfiles';
import { useContacts } from '../../lib/useContacts';

interface RowPalette { head: string; sub: string; border: string }

/** A single avatar + name + short-address row for one address. Reused for the
 *  resolved recipient and every contact in the picker. */
export function RecipientRow({ address, pal, right, onPress }: {
  address: string;
  pal: RowPalette;
  /** Optional trailing element (e.g. a clear/chevron icon). */
  right?: React.ReactNode;
  onPress?: () => void;
}): React.ReactElement {
  const { head, sub, border } = pal;
  // Fetch (and re-render on) this peer's Snapshot profile — name + avatar.
  usePeerProfiles([address]);
  const name = getPeerName(address) ?? shortAddress(address);
  const showAddrLine = name !== shortAddress(address);

  const inner = (
    <>
      <Avatar
        address={address}
        size="md"
        imageUri={getPeerAvatar(address)}
        cacheBuster={getPeerAvatarCb(address)}
        style={{ backgroundColor: border }}
      />
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: head, fontSize: 16, fontFamily: 'Calibre-Semibold' }} numberOfLines={1}>
          {name}
        </Text>
        {showAddrLine ? (
          <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium', marginTop: 2 }} numberOfLines={1}>
            {shortAddress(address)}
          </Text>
        ) : null}
      </Box>
      {right}
    </>
  );

  if (!onPress) {
    return (
      <Box style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: border, borderRadius: 12,
        paddingHorizontal: 14, paddingVertical: 10,
      }}>
        {inner}
      </Box>
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

/** Bottom-sheet list of the user's contacts (DM peers). Tapping one calls
 *  `onPick(address)` and closes. */
export function ContactsModal({ visible, onClose, onPick, pal }: {
  visible: boolean;
  onClose: () => void;
  onPick: (address: string) => void;
  pal: RowPalette & { head: string };
}): React.ReactElement {
  const { head, sub } = pal;
  const contacts = useContacts([], '');

  return (
    <AppModal visible={visible} onClose={onClose}>
      <Text style={{ color: head, fontSize: 18, fontFamily: 'Calibre-Semibold', marginBottom: 8 }}>
        Contacts
      </Text>
      {contacts.length === 0 ? (
        <Text style={{ color: sub, fontSize: 14, fontFamily: 'Calibre-Medium', paddingVertical: 16 }}>
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

/** Icon button that opens the contacts picker. Sits at the right edge of the
 *  recipient input. */
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
      <Icon name="users" size={20} color={color} />
    </Pressable>
  );
}
