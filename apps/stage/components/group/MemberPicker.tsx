
import { useCallback, useMemo, useState } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { shortAddress } from '../../modules/messaging';
import { resolveHandleToAddress } from '../../lib/resolveHandle';
import {
  RECIPIENT_HELP, RECIPIENT_PLACEHOLDER, recipientHint, settleRecipient, startRecipient,
} from '../wallet/recipient.model';
import { capabilities } from '../../lib/capabilities';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { Avatar } from '../Avatar';
import { Box, Col, Row } from '../layout';
import { FormField } from '../FormField';
import { useContacts, type Contact } from '../../lib/useContacts';
import { ContactSuggestions } from './ContactSuggestions';

export interface Member {
  address: string;
  label: string;
}


interface MemberPickerState {
  members: Member[];
  entry: string;
  setEntry: (v: string) => void;
  adding: boolean;
  addMember: () => Promise<void>;
  removeMember: (address: string) => void;
  toggleContact: (contact: Contact) => void;
  selectedAddresses: Set<string>;
}

async function lookupMember(raw: string): Promise<Member | string> {
  const start = startRecipient(raw);
  const found = start.kind === 'resolving'
    ? settleRecipient(start, await resolveHandleToAddress(start.query.handle))
    : start;
  if (found.kind !== 'resolved') return recipientHint(found)?.text ?? RECIPIENT_HELP;
  return { address: found.address, label: found.label ?? shortAddress(found.address) };
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
      const member = await lookupMember(raw);
      if (typeof member === 'string') { capabilities.toast(member); return; }
      const { address, label } = member;
      const lower = address.toLowerCase();
      if (members.some(m => m.address.toLowerCase() === lower)) {
        capabilities.toast('Already added'); setEntry(''); return;
      }
      setMembers(prev => [...prev, { address: address, label }]);
      setEntry('');
    } catch (err) {
      capabilities.toast((err as Error)?.message ?? 'Failed to add member');
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
  const { link: head, text: sub, border } = usePalette();
  const {
    members, entry, setEntry, adding, addMember, removeMember,
    toggleContact, selectedAddresses,
  } = state;
  const contacts = useContacts(exclude, entry);

  return (
    <>
      <Col gap={6}>
        <Row gap={8} align="center">
          <Box flex={1}>
            <FormField label="Add members" placeholder={RECIPIENT_PLACEHOLDER} value={entry} onChangeText={setEntry}
              onSubmit={() => { void addMember(); }}
              inputProps={{ autoCapitalize: 'none', autoCorrect: false, returnKeyType: 'done' }} />
          </Box>
          <Button
            color="secondary"
            variant="solid"
            size="md"
            dark={dark}
            loading={adding}
            disabled={!entry.trim()}
            onPress={() => { void addMember(); }}
            label="Add"
/>
        </Row>
      </Col>

      <ContactSuggestions
        contacts={contacts}
        selected={selectedAddresses}
        onToggle={toggleContact}
/>

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

export function MemberPickerFooter({ count, busy, verb, onPress }: {
  count: number; busy: boolean; verb: string; onPress: () => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { bg, border, primary } = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <Box padding={{ top: 16, right: 16, bottom: 16 + insets.bottom, left: 16 }} style={{ borderTopWidth: 1, borderTopColor: border }}>
      <Button size="lg" fullWidth pill dark={dark} loading={busy} disabled={count === 0} onPress={onPress}
        tintBg={primary} tintFg={bg} label={count > 0 ? `${verb} (${count})` : verb} />
    </Box>
  );
}
