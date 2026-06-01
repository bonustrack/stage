/** Add-members screen — a pushed (non-tab) route reached from the "Add members"
 *  item in a group's ChannelMenu. Reuses the new-group member picker (address /
 *  .eth entry + validation + removable chips) WITHOUT a group-name field, since
 *  the group already exists.
 *
 *  - Members are entered one at a time; .eth names resolve via the same
 *    resolveEnsName path the Search + new-group screens use. Resolved members
 *    render as removable chips.
 *  - "Add" is disabled until at least one valid member is staged. It calls
 *    addGroupMembers(convId, addresses) → router.back() + a confirmation flash.
 *  - Errors (invalid entry, address not on XMTP, not a group admin) flash a toast.
 */

import { useCallback, useState } from 'react';
import { Pressable, TextInput, ScrollView } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Title } from '@metro-labs/kit/title';
import { Icon } from '@metro-labs/kit/icon';
import { Button } from '@metro-labs/kit/button';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addGroupMembers, shortAddress } from '../../lib/xmtp';
import { resolveEnsName } from '../../lib/ens';
import { flash } from '../../lib/toast';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { Avatar } from '../../components/Avatar';
import { Box, Col, Row } from '../../components/layout';

interface Member {
  /** Resolved 0x address — the canonical key. */
  address: string;
  /** What the user typed (e.g. an ENS name) for display, when not a raw addr. */
  label: string;
}

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

export default function AddMembers(): React.ReactElement {
  const router = useRouter();
  const { convId } = useLocalSearchParams<{ convId: string }>();
  const dark = useEffectiveColorScheme() === 'dark';
  const { fg, head, sub, bg, border, rowBg } = usePalette();
  const insets = useSafeAreaInsets();

  const [entry, setEntry] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [adding, setAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      setMembers(prev => [...prev, { address, label }]);
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

  const onSubmit = useCallback(async (): Promise<void> => {
    if (members.length === 0 || submitting || !convId) return;
    setSubmitting(true);
    try {
      await addGroupMembers(convId, members.map(m => m.address));
      router.back();
      flash(members.length === 1 ? 'Member added' : `${members.length} members added`);
    } catch (err) {
      flash((err as Error)?.message ?? "Couldn't add members");
      setSubmitting(false);
    }
  }, [members, submitting, convId, router]);

  return (
    <Box style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      {/* Header — back button + title, consistent with other pushed screens. */}
      <Box style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: border,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
          <Icon name="arrowLeft" size={22} color={fg} />
        </Pressable>
        <Title dark={dark} style={{ color: head, fontSize: 20 }}>
          Add members
        </Title>
      </Box>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
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
      </ScrollView>

      {/* Add */}
      <Box style={{ padding: 16, paddingBottom: 16 + insets.bottom, borderTopWidth: 1, borderTopColor: border }}>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          pill
          dark={dark}
          loading={submitting}
          disabled={members.length === 0}
          onPress={() => { void onSubmit(); }}
          label={members.length > 0 ? `Add to group (${members.length})` : 'Add to group'}
        />
      </Box>
    </Box>
  );
}
