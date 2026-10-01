import { useLocalSearchParams } from 'expo-router';
import { FrameScreen } from '../../components/frame/FrameScreen';
import { EmptyState } from '../../components/chrome/EmptyState';

export default function FrameRoute(): React.ReactElement {
  const { convId, id } = useLocalSearchParams<{ convId?: string; id?: string }>();
  if (!convId || !id) return <EmptyState title="This frame is not available." />;
  return <FrameScreen convId={convId} messageId={id} />;
}
