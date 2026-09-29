import { Redirect, useLocalSearchParams } from 'expo-router';
import { channelProfileLinkOf } from '../../lib/conversationLink';

export default function LegacyChannelProfileRedirect(): React.ReactElement {
  const { convId } = useLocalSearchParams<{ convId: string }>();
  return <Redirect href={channelProfileLinkOf(convId ?? '')} />;
}
