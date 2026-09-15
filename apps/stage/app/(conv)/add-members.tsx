
import { useCallback, useState } from 'react';

import { Button } from '@stage-labs/kit/react-native/button';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { addGroupMembers } from '../../modules/messaging';
import { capabilities } from '../../lib/capabilities';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { StackHeader } from '../../components/chrome/StackHeader';
import { Box, Col, ScreenScroll } from '../../components/layout';
import { useConvMeta } from '../../modules/messaging';
import { MemberPicker, useMemberPicker } from './MemberPicker';

export default function AddMembers(): React.ReactElement {
  const router = useRouter();
  const { convId } = useLocalSearchParams<{ convId: string }>();
  const dark = useEffectiveColorScheme() === 'dark';
  const { bg, border, primary } = usePalette();
  const insets = useSafeAreaInsets();

  const picker = useMemberPicker();
  const { members } = picker;
  const [submitting, setSubmitting] = useState(false);
  const { memberAddrs } = useConvMeta(convId);

  const onSubmit = useCallback(async (): Promise<void> => {
    if (members.length === 0 || submitting || !convId) return;
    setSubmitting(true);
    try {
      await addGroupMembers(convId, members.map(m => m.address));
      router.back();
      capabilities.toast(members.length === 1 ? 'Member added' : `${members.length} members added`);
    } catch (err) {
      capabilities.toast((err as Error)?.message ?? "Couldn't add members");
      setSubmitting(false);
    }
  }, [members, submitting, convId, router]);

  return (
    <Col surface="surface" flex={1}>
      <StackHeader title="Add members" />

      <ScreenScroll
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
>
        <MemberPicker state={picker} dark={dark} exclude={memberAddrs}/>
      </ScreenScroll>

      <Box padding={{ top: 16, right: 16, bottom: 16 + insets.bottom, left: 16 }} style={{ borderTopWidth: 1, borderTopColor: border }}>
        <Button
          size="lg"
          fullWidth
          pill
          dark={dark}
          loading={submitting}
          disabled={members.length === 0}
          onPress={() => { void onSubmit(); }}
          tintBg={primary}
          tintFg={bg}
          label={members.length> 0 ? `Add to group (${members.length})` : 'Add to group'}
/>
      </Box>
    </Col>
  );
}
