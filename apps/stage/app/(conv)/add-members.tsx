
import { useCallback, useState } from 'react';

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { addGroupMembers } from '../../modules/messaging';
import { capabilities } from '../../lib/capabilities';
import { useEffectiveColorScheme } from '../../lib/theme';
import { StackHeader } from '../../components/chrome/StackHeader';
import { Col, ScreenScroll } from '../../components/layout';
import { useConvMeta } from '../../modules/messaging';
import { MemberPicker, MemberPickerFooter, useMemberPicker } from '../../components/group/MemberPicker';

export default function AddMembers(): React.ReactElement {
  const router = useRouter();
  const { convId } = useLocalSearchParams<{ convId: string }>();
  const dark = useEffectiveColorScheme() === 'dark';
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

      <MemberPickerFooter count={members.length} busy={submitting} verb="Add to group" onPress={() => { void onSubmit(); }} />
    </Col>
  );
}
