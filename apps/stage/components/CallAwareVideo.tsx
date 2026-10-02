import { VideoPlayer, type VideoPlayerProps } from '@stage-labs/kit/react-native/video-player';
import { callOwnsAudio, subscribeCallAudio } from '../lib/calls.audio.core';
import { useStoreValue } from '../lib/storeCore';

export function CallAwareVideo(props: VideoPlayerProps): React.ReactElement | null {
  const owned = useStoreValue(subscribeCallAudio, callOwnsAudio);
  return owned ? null : <VideoPlayer {...props}/>;
}
