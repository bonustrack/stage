import { Video, type VideoProps } from '@stage-labs/kit/react-native/video';
import { callOwnsAudio, subscribeCallAudio } from '../lib/calls.audio.core';
import { useStoreValue } from '../lib/storeCore';

export function CallAwareVideo(props: VideoProps): React.ReactElement | null {
  const owned = useStoreValue(subscribeCallAudio, callOwnsAudio);
  return owned ? null : <Video {...props} />;
}
