
import { useCallback, useMemo, useState } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { KitRenderer } from '@stage-labs/kit/react-native/kit-renderer';
import type { WidgetActionRegistry } from '@stage-labs/kit/kit';
import { basicRoot, memberTextField, MEMBER_FIELD_CHANGE, MEMBER_FIELD_SUBMIT } from '@stage-labs/views';
import { shortAddress } from '../../modules/messaging';
import { resolveEnsName } from '../../lib/ens';
import { flash } from '../../lib/toast';
import { usePalette } from '../../lib/theme';
import { Avatar } from '../../components/Avatar';
import { Box, Col, Row } from '../../components/layout';
import { useContacts, type Contact } from '../../lib/useContacts';
import { ContactSuggestions } from './ContactSuggestions';

export interface Member {
  address: string;
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
  toggleContact: (contact: Contact) => void;
  selectedAddresses: Set<string>;
}

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

export function MemberPicker({ state, dark, exclude = [] }: {
  state: MemberPickerState;
  dark: boolean;
  exclude?: string[];
}): React.ReactElement {
  const { link: head, text: sub, border, inputBg } = usePalette();
  const {
    members, entry, setEntry, adding, addMember, removeMember,
    toggleContact, selectedAddresses,
  } = state;
  const contacts = useContacts(exclude, entry);

  const resolverRegistry: WidgetActionRegistry = {
    [MEMBER_FIELD_CHANGE]: (a) => {
      if (typeof a.payload.field === 'string') setEntry(a.payload.field);
    },
    [MEMBER_FIELD_SUBMIT]: () => { void addMember(); },
  };

  return (
    <>
      {}
      <Col gap={6}>
        <Text size="xs" role="secondary">
          Add members
        </Text>
        <Row gap={8} align="center">
          <Box flex={1}>
            <KitRenderer
              node={basicRoot(memberTextField({
                value: entry,
                placeholder: '0x… or name.eth',
                color: head,
                placeholderColor: sub,
                inputBg,
                border,
                radius: 12,
                paddingX: 14,
                paddingY: 12,
                autoCapitalize: 'none',
                autoCorrect: false,
                returnKeyType: 'done',
                submitType: MEMBER_FIELD_SUBMIT,
              }))}
              registry={resolverRegistry}
            />
          </Box>
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

      {}
      <ContactSuggestions
        contacts={contacts}
        selected={selectedAddresses}
        onToggle={toggleContact}
/>

      {}
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
                  <Text size="xs" numberOfLines={1} role="secondary">
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
