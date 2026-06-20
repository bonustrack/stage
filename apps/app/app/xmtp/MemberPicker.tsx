/** @file Shared member picker (useMemberPicker hook plus MemberPicker component) for new-group and add-members screens: staged-member list, address/.eth resolution, contact suggestions, removable chips. */

import { useCallback, useMemo, useState } from 'react';
import { fontSize } from '@metro-labs/kit/tokens';
import { Pressable } from '@metro-labs/kit/pressable';
import { Input } from '@metro-labs/kit/input';
import { Text } from '@metro-labs/kit/text';
import { Button } from '@metro-labs/kit/button';
import { Icon } from '@metro-labs/kit/icon';
import { shortAddress } from '../../modules/messaging';
import { resolveEnsName } from '../../lib/ens';
import { flash } from '../../lib/toast';
import { usePalette } from '../../lib/theme';
import { Avatar } from '../../components/Avatar';
import { Col, Row } from '../../components/layout';
import { useContacts, type Contact } from '../../lib/useContacts';
import { ContactSuggestions } from './ContactSuggestions';

export interface Member {
  /** Resolved 0x address — the canonical key. */
  address: string;
  /** What the user typed (e.g. an ENS name) for display, when not a raw addr. */
  label: string;
}

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

export interface MemberPickerState {
  members: Member[];
  entry: string;
  setEntry: (v: string) => void;
  adding: boolean;
  addMember: () => Promise<void>;
  removeMember: (address: string) => void;
  /** Tap-to-add/remove a suggested contact (toggles selection by address). */
  toggleContact: (contact: Contact) => void;
  /** Lowercased addresses of every staged member — drives the suggestion checkmarks. */
  selectedAddresses: Set<string>;
}

/** Hook managing the member-picker entry field and staged member list. */
export function useMemberPicker(): MemberPickerState {
  const [entry, setEntry] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [adding, setAdding] = useState(false);

  const addMember = useCallback(async (): Promise<void> => {
    const raw = entry.trim();
    if (!raw || adding) return;
    setAdding(true);
    try {
      let address: string | null = null;
      let label = raw;
      if (ADDR_RE.test(raw)) {
        address = raw;
        label = shortAddress(raw);
      } else if (raw.includes('.')) {
        address = await resolveEnsName(raw.toLowerCase());
        if (!address) { flash(`Couldn't resolve ${raw}`); return; }
      } else {
        flash('Enter a 0x address or a .eth name'); return;
      }
      const lower = address.toLowerCase();
      if (members.some(m => m.address.toLowerCase() === lower)) {
        flash('Already added'); setEntry(''); return;
      }
      setMembers(prev => [...prev, { address: address, label }]);
      setEntry('');
    } catch (err) {
      flash((err as Error)?.message ?? 'Failed to add member');
    } finally {
      setAdding(false);
    }
  }, [entry, adding, members]);

  const removeMember = useCallback((address: string): void => {
    const lower = address.toLowerCase();
    setMembers(prev => prev.filter(m => m.address.toLowerCase() !== lower));
  }, []);

  const toggleContact = useCallback((contact: Contact): void => {
    const lower = contact.address.toLowerCase();
    setMembers(prev => (prev.some(m => m.address.toLowerCase() === lower)
      ? prev.filter(m => m.address.toLowerCase() !== lower)
      : [...prev, { address: contact.address, label: contact.name }]));
    setEntry('');
  }, []);

  const selectedAddresses = useMemo(
    () => new Set(members.map(m => m.address.toLowerCase())),
    [members],
  );

  return {
    members, entry, setEntry, adding, addMember, removeMember,
    toggleContact, selectedAddresses,
  };
}

/** UI for searching, adding and removing members when composing a group. */
export function MemberPicker({ state, dark, exclude = [] }: {
  state: MemberPickerState;
  dark: boolean;
  /** Addresses to omit from suggestions beyond self (e.g. an existing group's current members). Staged members are NOT excluded — they stay visible with a checkmark so a tap removes them. */
  exclude?: string[];
}): React.ReactElement {
  const { link: head, text: sub, border, inputBg } = usePalette();
  const {
    members, entry, setEntry, adding, addMember, removeMember,
    toggleContact, selectedAddresses,
  } = state;
  const contacts = useContacts(exclude, entry);

  return (
    <>
      {/* Member entry */}
      <Col gap={6}>
        <Text size="xs" color={sub}>
          Add members
        </Text>
        <Row gap={8} align="center">
          <Input
            value={entry}
            onChangeText={setEntry}
            onSubmit={() => { void addMember(); }}
            placeholder="0x… or name.eth"
            placeholderTextColor={sub}
            dark={dark}
            inputProps={{ autoCapitalize: 'none', autoCorrect: false, returnKeyType: 'done' }}
            style={{
              flex: 1, color: head, fontSize: fontSize('md'), fontFamily: 'Calibre-Medium',
              backgroundColor: inputBg, borderRadius: 12, paddingHorizontal: 14,
              paddingVertical: 12, borderWidth: 1, borderColor: border, minHeight: 0,
            }}
/>
          <Button
            variant="secondary"
            size="md"
            dark={dark}
            loading={adding}
            disabled={!entry.trim()}
            onPress={() => { void addMember(); }}
            label="Add"
/>
        </Row>
      </Col>

      {/* Tap-to-add suggestions from the user's existing DM contacts */}
      <ContactSuggestions
        contacts={contacts}
        selected={selectedAddresses}
        onToggle={toggleContact}
/>

      {/* Member chips */}
      {members.length> 0 && (
        <Col gap={8}>
          {members.map(m => (
            <Row surface="raised" radius="lg" padding={8}
              key={m.address}
              align="center"
              gap={10}
              style={{ borderWidth: 1, borderColor: border }}
>
              <Avatar address={m.address} size={32} style={{ backgroundColor: border }}/>
              <Col flex={1} gap={1}>
                <Text size="md" numberOfLines={1} color={head}>
                  {m.label}
                </Text>
                {m.label !== shortAddress(m.address) && (
                  <Text size="xs" numberOfLines={1} color={sub}>
                    {shortAddress(m.address)}
                  </Text>
                )}
              </Col>
              <Pressable
                onPress={() => { removeMember(m.address); }}
                hitSlop={6}
                style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: border }}
>
                <Icon name="x" size={16} color={sub}/>
              </Pressable>
            </Row>
          ))}
        </Col>
      )}
    </>
  );
}
