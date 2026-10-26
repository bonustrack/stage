import { useEffect, useRef, useState } from 'react';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image, View } from 'react-native';
import { BLOCK_RADIUS_DEFAULT } from '../tokens';
import { accessibilityProps, weightStyle, type A2uiCommonProps } from './a2ui-props';
import { useVideoSize, type VideoSize } from './video.size';

export type { VideoSize };

export type VideoFit = 'contain' | 'cover';

export interface VideoProps extends A2uiCommonProps {
  url: string;
  posterUrl?: string;
  controls?: boolean;
  background?: string;
  aspectRatio?: number;
  fit?: VideoFit;
  onVideoSize?: (size: VideoSize) => void;
}

function usePosterVisible(player: ReturnType<typeof useVideoPlayer>, posterUrl: string | undefined): boolean {
  const [showPoster, setShowPoster] = useState(posterUrl !== undefined);
  useEffect(() => {
    const sub = player.addListener('playingChange', ({ isPlaying }) => {
      if (isPlaying) setShowPoster(false);
    });
    return () => { sub.remove(); };
  }, [player]);
  return posterUrl !== undefined && showPoster;
}

export function Video(props: VideoProps): React.ReactElement {
  const {
    url, posterUrl, controls = true, background = '#000000', aspectRatio = 16 / 9, fit = 'contain', onVideoSize, weight, accessibility,
  } = props;
  const player = useVideoPlayer({ uri: url });
  const frame = useRef<View>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const showPoster = usePosterVisible(player, posterUrl);
  useVideoSize(player, frame, onVideoSize);

  return (
    <View
      ref={frame}
      {...accessibilityProps(accessibility)}
      style={{ width: '100%', borderRadius: BLOCK_RADIUS_DEFAULT, overflow: 'hidden', backgroundColor: background, ...weightStyle(weight) }}
    >
      <VideoView
        player={player}
        style={{ width: '100%', aspectRatio }}
        nativeControls={controls}
        contentFit={fullscreen ? 'contain' : fit}
        fullscreenOptions={{ enable: true }}
        onFullscreenEnter={() => { setFullscreen(true); }}
        onFullscreenExit={() => { setFullscreen(false); }}
        playsInline
      />
      {posterUrl !== undefined && showPoster ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
          <Image source={{ uri: posterUrl }} resizeMode={fit} style={{ width: '100%', height: '100%' }} />
        </View>
      ) : null}
    </View>
  );
}
