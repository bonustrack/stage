/** Add-members screen — a pushed (non-tab) route reached from the "Add members"
 *  item in a group's ChannelMenu. Reuses the shared MemberPicker (address /
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
import { Pressable, ScrollView } from 'react-native';
import { Title } from '@metro-labs/kit/title';
import { Icon } from '@metro-labs/kit/icon';
import { Button } from '@metro-labs/kit/button';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addGroupMembers } from '../../lib/xmtp';
import { flash } from '../../lib/toast';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { Box } from '../../components/layout';
import { useConvMeta } from '../../lib/useConvMeta';
import { MemberPicker, useMemberPicker } from './MemberPicker';

export default function AddMembers(): React.ReactElement {
  const router = useRouter();
  const { convId } = useLocalSearchParams<{ convId: string }>();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, primary: head, bg, border } = usePalette();
  const insets = useSafeAreaInsets();

  const picker = useMemberPicker();
  const { members } = picker;
  const [submitting, setSubmitting] = useState(false);
  /** Current group members — excluded from the contact suggestions so we don't
   *  suggest adding someone who's already in the group. */
  const { memberAddrs } = useConvMeta(convId);

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
        <MemberPicker state={picker} dark={dark} exclude={memberAddrs} />
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
