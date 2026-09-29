import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { StackHeader } from '../../components/chrome/StackHeader';
import { Col, ScreenScroll } from '../../components/layout';
import { AddMembersForm } from '../../components/channel/AddMembers';

export default function AddMembers(): React.ReactElement {
  const router = useRouter();
  const { convId } = useLocalSearchParams<{ convId: string }>();
  const insets = useSafeAreaInsets();

  return (
    <Col surface="surface" flex={1}>
      <StackHeader title="Add members" />
      <ScreenScroll
        contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        {convId ? <AddMembersForm convId={convId} onDone={() => { router.back(); }}/> : null}
      </ScreenScroll>
    </Col>
  );
}
