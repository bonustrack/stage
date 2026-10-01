import { useState } from 'react';
import { Text } from '@stage-labs/kit/react-native/text';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Avatar } from '../Avatar';
import { PickerList, PickerNote, PickerRow, PickerSearch, type SectionDraft } from './SidebarSection';
import { includesKey, matchesQuery, selectedFirst } from './SidebarSection.model';
import type { MemberListEntry } from './MemberListSidebar.model';
import { lookupMember } from '../channel/MemberPicker';
import { capabilities } from '../../lib/capabilities';
import { useContacts } from '../../lib/useContacts';
import { usePalette } from '../../lib/theme';
import { IconPlusLarge } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPlusLarge';

interface PersonOption { address: string; name: string; disabled: boolean }

function PersonRow({ option, draft, toggle }: { option: PersonOption } & SectionDraft): React.ReactElement {
  return (
    <PickerRow selected={includesKey(draft, option.address)} disabled={option.disabled} label={option.name}
      onPress={() => { toggle(option.address.toLowerCase()); }}>
      <Avatar address={option.address} size="sm"/>
      <Text size="md" numberOfLines={1} style={{ flexShrink: 1 }}>{option.name}</Text>
    </PickerRow>
  );
}

function useOrderedEntries(entries: MemberListEntry[], draft: string[]): MemberListEntry[] {
  const [order] = useState(() => selectedFirst(entries.map(entry => entry.address), draft));
  const byAddress = new Map(entries.map(entry => [entry.address.toLowerCase(), entry]));
  const ordered = order.flatMap(address => byAddress.get(address.toLowerCase()) ?? []);
  return [...ordered, ...entries.filter(entry => !includesKey(order, entry.address))];
}

export function AssigneePicker({ draft, toggle, entries }: SectionDraft & { entries: MemberListEntry[] }): React.ReactElement {
  const [query, setQuery] = useState('');
  const shown = useOrderedEntries(entries, draft).filter(entry => matchesQuery(query, entry.name, entry.address));
  return (
    <>
      <PickerSearch value={query} onChangeText={setQuery} placeholder="Search members"/>
      <PickerList>
        {shown.map(entry => (
          <PersonRow key={entry.address.toLowerCase()} option={{ address: entry.address, name: entry.name, disabled: false }}
            draft={draft} toggle={toggle}/>
        ))}
        {shown.length === 0 ? <PickerNote text="No matching members."/> : null}
      </PickerList>
    </>
  );
}

interface MemberRights { add: boolean; remove: boolean }

function useLookup(draft: string[], toggle: (key: string) => void): {
  found: PersonOption[]; looking: boolean; look: (raw: string, done: () => void) => void;
} {
  const [found, setFound] = useState<PersonOption[]>([]);
  const [looking, setLooking] = useState(false);
  const look = (raw: string, done: () => void): void => {
    if (looking || raw.trim() === '') return;
    setLooking(true);
    void lookupMember(raw)
      .then((member) => {
        if (typeof member === 'string') { capabilities.toast(member); return; }
        setFound(list => (includesKey(list.map(option => option.address), member.address)
          ? list : [...list, { address: member.address, name: member.label, disabled: false }]));
        if (!includesKey(draft, member.address)) toggle(member.address.toLowerCase());
        done();
      })
      .catch((err: unknown) => { capabilities.toast(err instanceof Error ? err.message : 'Could not find that person.'); })
      .finally(() => { setLooking(false); });
  };
  return { found, looking, look };
}

function LookupRow({ query, looking, onPress }: { query: string; looking: boolean; onPress: () => void }): React.ReactElement {
  const { text: fg } = usePalette();
  return (
    <PickerRow selected={false} disabled={looking} label={`Add ${query}`} onPress={onPress}>
      <Glyph icon={IconPlusLarge} size={16} color={fg}/>
      <Text size="md" numberOfLines={1} style={{ flexShrink: 1 }}>{looking ? 'Looking up…' : `Add "${query}"`}</Text>
    </PickerRow>
  );
}

export function MembersPicker({ draft, toggle, entries, self, rights }: SectionDraft & {
  entries: MemberListEntry[]; self: string; rights: MemberRights;
}): React.ReactElement {
  const [query, setQuery] = useState('');
  const memberAddresses = entries.map(entry => entry.address);
  const contacts = useContacts(memberAddresses, query);
  const { found, looking, look } = useLookup(draft, toggle);
  const members: PersonOption[] = useOrderedEntries(entries, draft)
    .filter(entry => matchesQuery(query, entry.name, entry.address))
    .map(entry => ({ address: entry.address, name: entry.name, disabled: !rights.remove || entry.address.toLowerCase() === self.toLowerCase() }));
  const extra = [...found, ...contacts.map(contact => ({ address: contact.address, name: contact.name, disabled: false }))]
    .filter((option, index, list) => list.findIndex(other => other.address.toLowerCase() === option.address.toLowerCase()) === index)
    .filter(option => !includesKey(memberAddresses, option.address));
  const others = rights.add ? extra : [];
  const typed = query.trim();
  const add = (): void => { look(typed, () => { setQuery(''); }); };
  return (
    <>
      <PickerSearch value={query} onChangeText={setQuery} placeholder={rights.add ? 'Search or add by name' : 'Search members'}
        onSubmit={rights.add ? add : undefined}/>
      <PickerList>
        {[...members, ...others].map(option => <PersonRow key={option.address.toLowerCase()} option={option} draft={draft} toggle={toggle}/>)}
        {rights.add && typed !== '' ? <LookupRow query={typed} looking={looking} onPress={add}/> : null}
        {members.length + others.length === 0 && !(rights.add && typed !== '') ? <PickerNote text="No matching people."/> : null}
      </PickerList>
    </>
  );
}
