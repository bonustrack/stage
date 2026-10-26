import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { StackHeader } from '../../components/chrome/StackHeader';
import { AddMembersForm } from '../../components/channel/AddMembers';
import { Column, ScreenScroll } from '../../components/layout';

export default function AddMembers(): React.ReactElement {
  const router = useRouter();
  const { convId } = useLocalSearchParams<{ convId: string }>();
  const insets = useSafeAreaInsets();

  return (
    <Column surface="surface" weight={1}>
      <StackHeader title="Add members" />
      <ScreenScroll
        contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        {convId ? <AddMembersForm convId={convId} onDone={() => { router.back(); }}/> : null}
      </ScreenScroll>
    </Column>
  );
}
