/** Shared member picker used by the new-group + add-members screens.
 *
 *  Owns the staged-member list and the "address / .eth → resolved chip" entry
 *  flow (the two screens previously duplicated this verbatim). `useMemberPicker`
 *  exposes the staged `members` (and a `reset`) so each screen can drive its own
 *  Create / Add submit; `<MemberPicker>` renders the entry field + removable
 *  chips. Behaviour is identical to the inlined version. */

import { useCallback, useState } from 'react';
import { Pressable, TextInput } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Button } from '@metro-labs/kit/button';
import { Icon } from '@metro-labs/kit/icon';
import { shortAddress } from '../../lib/xmtp';
import { resolveEnsName } from '../../lib/ens';
import { flash } from '../../lib/toast';
import { usePalette } from '../../lib/theme';
import { Avatar } from '../../components/Avatar';
import { Col, Row } from '../../components/layout';

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
      setMembers(prev => [...prev, { address: address as string, label }]);
      setEntry('');
    } catch (err) {
      flash((err as Error)?.message ?? 'Failed to add member');
    } finally {
      setAdding(false);
    }
  }, [entry, adding, members]);

  const removeMember = useCallback((address: string): void => {
    setMembers(prev => prev.filter(m => m.address !== address));
  }, []);

  return { members, entry, setEntry, adding, addMember, removeMember };
}

export function MemberPicker({ state, dark }: { state: MemberPickerState; dark: boolean }): React.ReactElement {
  const { head, sub, border, rowBg } = usePalette();
  const { members, entry, setEntry, adding, addMember, removeMember } = state;

  return (
    <>
      {/* Member entry */}
      <Col gap={6}>
        <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>
          Add members
        </Text>
        <Row gap={8} align="center">
          <TextInput
            value={entry}
            onChangeText={setEntry}
            onSubmitEditing={() => { void addMember(); }}
            placeholder="0x… or name.eth"
            placeholderTextColor={sub}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            style={{
              flex: 1, color: head, fontSize: 16, fontFamily: 'Calibre-Medium',
              backgroundColor: rowBg, borderRadius: 12, paddingHorizontal: 14,
              paddingVertical: 12, borderWidth: 1, borderColor: border,
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

      {/* Member chips */}
      {members.length > 0 && (
        <Col gap={8}>
          {members.map(m => (
            <Row
              key={m.address}
              align="center"
              gap={10}
              style={{
                backgroundColor: rowBg, borderRadius: 12, padding: 8,
                borderWidth: 1, borderColor: border,
              }}
            >
              <Avatar address={m.address} size={32} style={{ backgroundColor: border }} />
              <Col flex={1} gap={1}>
                <Text numberOfLines={1} style={{ color: head, fontSize: 15, fontFamily: 'Calibre-Medium' }}>
                  {m.label}
                </Text>
                {m.label !== shortAddress(m.address) && (
                  <Text numberOfLines={1} style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>
                    {shortAddress(m.address)}
                  </Text>
                )}
              </Col>
              <Pressable
                onPress={() => removeMember(m.address)}
                hitSlop={6}
                style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: border }}
              >
                <Icon name="x" size={16} color={sub} />
              </Pressable>
            </Row>
          ))}
        </Col>
      )}
    </>
  );
}
