import { useSyncExternalStore } from 'react';
import { VideoPlayer, type VideoPlayerProps } from '@stage-labs/kit/react-native/video-player';
import { callOwnsAudio, subscribeCallAudio } from '../lib/calls.audio.core';

export function CallAwareVideo(props: VideoPlayerProps): React.ReactElement | null {
  const owned = useSyncExternalStore(subscribeCallAudio, callOwnsAudio);
  return owned ? null : <VideoPlayer {...props}/>;
}
