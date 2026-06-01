/** Create-group screen — a pushed (non-tab) route reached from the "+" button
 *  in the Channels topnav. Lets the user name the group (optional) and add
 *  members by Ethereum address or .eth name, then creates the XMTP group and
 *  opens it.
 *
 *  - Members are entered one at a time; .eth names are resolved via the same
 *    resolveEnsName path the Search screen uses. Resolved members render as
 *    removable chips.
 *  - Create is disabled until at least one valid member is staged. It calls
 *    createGroup(members, name) → router.replace into the new conversation.
 *  - Errors (invalid entry, address not on XMTP, create failure) flash a toast.
 */

import { useCallback, useState } from 'react';
import { Pressable, TextInput, ScrollView } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Title } from '@metro-labs/kit/title';
import { Icon } from '@metro-labs/kit/icon';
import { Button } from '@metro-labs/kit/button';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createGroup, shortAddress } from '../../lib/xmtp';
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

export default function NewGroup(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { fg, head, sub, bg, border, rowBg } = usePalette();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [entry, setEntry] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [adding, setAdding] = useState(false);
  const [creating, setCreating] = useState(false);

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

  const onCreate = useCallback(async (): Promise<void> => {
    if (members.length === 0 || creating) return;
    setCreating(true);
    try {
      const { id } = await createGroup(members.map(m => m.address), name);
      router.replace({ pathname: '/xmtp/[convId]', params: { convId: id } });
    } catch (err) {
      flash((err as Error)?.message ?? "Couldn't create the group");
      setCreating(false);
    }
  }, [members, name, creating, router]);

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
          New group
        </Title>
      </Box>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Group name (optional) */}
        <Col gap={6}>
          <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>
            Group name (optional)
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Metro builders"
            placeholderTextColor={sub}
            style={{
              color: head, fontSize: 16, fontFamily: 'Calibre-Medium',
              backgroundColor: rowBg, borderRadius: 12, paddingHorizontal: 14,
              paddingVertical: 12, borderWidth: 1, borderColor: border,
            }}
          />
        </Col>

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

      {/* Create */}
      <Box style={{ padding: 16, paddingBottom: 16 + insets.bottom, borderTopWidth: 1, borderTopColor: border }}>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          pill
          dark={dark}
          loading={creating}
          disabled={members.length === 0}
          onPress={() => { void onCreate(); }}
          label={members.length > 0 ? `Create group (${members.length})` : 'Create group'}
        />
      </Box>
    </Box>
  );
}
