import { useMemo, useState } from 'react';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { AppModal } from '../AppModal';
import { FormField, useFocusOnOpen } from '../FormField';
import { Col } from '../layout';
import { ContactSuggestions } from './ContactSuggestions';
import type { MemberListEntry } from '../conversation/MemberListSidebar.model';
import { updateGroupAssigned, invalidateConvMeta } from '../../modules/messaging';
import { useEffectiveColorScheme } from '../../lib/theme';
import { useConvMetaPatch } from './channel.detail';

export function AssigneesEditor({ convId, entries, assigned, onClose }: {
  convId: string; entries: MemberListEntry[]; assigned: string[]; onClose: () => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const input = useFocusOnOpen();
  const patchMeta = useConvMetaPatch(convId);
  const [selected, setSelected] = useState(() => new Set(assigned.map(address => address.toLowerCase())));
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const contacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter(entry => entry.name.toLowerCase().includes(q) || entry.address.toLowerCase().includes(q))
      .map(entry => ({ address: entry.address, name: entry.name }));
  }, [entries, query]);
  const toggle = (address: string): void => {
    if (busy) return;
    setSelected(current => {
      const next = new Set(current);
      const key = address.toLowerCase();
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const save = (): void => {
    if (busy) return;
    setBusy(true);
    setError('');
    const next = [...selected];
    void updateGroupAssigned(convId, next)
      .then(written => { patchMeta({ assigned: written }); onClose(); })
      .catch((err: unknown) => {
        invalidateConvMeta(convId);
        setError(err instanceof Error ? err.message.split('\n')[0] ?? 'Could not save assignees.' : 'Could not save assignees.');
      })
      .finally(() => { setBusy(false); });
  };
  return (
    <AppModal visible title="Assignees" onClose={() => { if (!busy) onClose(); }} dismissable={!busy}
      footer={<Button label="Save" block size="lg" color="primary" variant="solid" dark={dark} loading={busy} disabled={busy} onPress={save}/>}
    >
      <Col gap={12}>
        <FormField label="Search members" placeholder="Name or address" value={query} onChangeText={setQuery} disabled={busy}
          inputRef={input} inputProps={{ autoFocus: true, autoCapitalize: 'none', autoCorrect: false }}/>
        <ContactSuggestions contacts={contacts} selected={selected} onToggle={contact => { toggle(contact.address); }}/>
        {contacts.length === 0 ? <Text size="md" color="secondary">No matching members.</Text> : null}
        {error ? <Text size="md" color="danger">{error}</Text> : null}
      </Col>
    </AppModal>
  );
}
