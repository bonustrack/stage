/** Create-group screen — a pushed (non-tab) route reached from the "+" button
 *  in the Channels topnav. Lets the user name the group (optional) and add
 *  members by Ethereum address or .eth name, then creates the XMTP group and
 *  opens it.
 *
 *  - Members are entered one at a time via the shared MemberPicker; .eth names
 *    are resolved via the same resolveEnsName path the Search screen uses.
 *    Resolved members render as removable chips.
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
import { createGroup } from '../../lib/xmtp';
import { flash } from '../../lib/toast';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { Box, Col } from '../../components/layout';
import { MemberPicker, useMemberPicker } from './MemberPicker';

export default function NewGroup(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { fg, head, sub, bg, border, rowBg } = usePalette();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const picker = useMemberPicker();
  const { members } = picker;
  const [creating, setCreating] = useState(false);

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

        <MemberPicker state={picker} dark={dark} />
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
