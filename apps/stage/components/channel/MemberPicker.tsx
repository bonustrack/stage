
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@stage-labs/kit/react-native/button';
import { shortAddress } from '../../modules/messaging';
import { resolveHandleToAddress } from '../../lib/resolveHandle';
import {
  RECIPIENT_HELP, RECIPIENT_PLACEHOLDER, recipientHint, settleRecipient, startRecipient,
} from '../wallet/recipient.model';
import { capabilities } from '../../lib/capabilities';
import { Col } from '../layout';
import { FormField, useFocusOnOpen } from '../FormField';
import { useContacts, type Contact } from '../../lib/useContacts';
import { ContactSuggestions } from './ContactSuggestions';
import { pickerRows, togglePick } from './MemberPicker.model';

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

export async function lookupMember(raw: string): Promise<Member | string> {
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
      const lower = member.address.toLowerCase();
      if (members.some(m => m.address.toLowerCase() === lower)) {
        capabilities.toast('Already added'); setEntry(''); return;
      }
      setMembers(prev => togglePick(prev, member));
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
    setMembers(prev => togglePick(prev, { address: contact.address, label: contact.name }));
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

export function MemberPicker({ state, dark, exclude = [], children }: {
  state: MemberPickerState;
  dark: boolean;
  exclude?: string[];
  children?: ReactNode;
}): React.ReactElement {
  const { members, entry, setEntry, adding, addMember, toggleContact, selectedAddresses } = state;
  const contacts = useContacts(exclude, entry);
  const input = useFocusOnOpen();
  const rows = useMemo(
    () => pickerRows(members, contacts, (m) => ({ address: m.address, name: m.label })),
    [members, contacts],
  );
  const addButton = entry.trim() === '' ? undefined : (
    <Button color="secondary" variant="solid" size="sm" dark={dark} loading={adding} onPress={() => { void addMember(); }} label="Add" />
  );
  return (
    <Col gap={12}>
      <FormField label="Search" placeholder={RECIPIENT_PLACEHOLDER} value={entry} onChangeText={setEntry}
        onSubmit={() => { void addMember(); }} trailing={addButton} inputRef={input}
        inputProps={{ autoFocus: true, autoCapitalize: 'none', autoCorrect: false, returnKeyType: 'done' }} />
      {children}
      <ContactSuggestions contacts={rows} selected={selectedAddresses} onToggle={toggleContact} />
    </Col>
  );
}
