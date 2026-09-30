import { useEffect, useState } from 'react';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image, View } from 'react-native';

export type VideoFit = 'contain' | 'cover';

export interface VideoPlayerProps {
  src: string;
  poster?: string;
  controls?: boolean;
  background?: string;
  aspectRatio?: number;
  fit?: VideoFit;
}

export function VideoPlayer(props: VideoPlayerProps): React.ReactElement {
  const { src, poster, controls = true, background = '#000000', aspectRatio = 16 / 9, fit = 'contain' } = props;
  const player = useVideoPlayer({ uri: src });
  const [showPoster, setShowPoster] = useState(poster !== undefined);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const sub = player.addListener('playingChange', ({ isPlaying }) => {
      if (isPlaying) setShowPoster(false);
    });
    return () => { sub.remove(); };
  }, [player]);

  return (
    <View
      style={{
        width: '100%',
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: background,
      }}
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
      {poster !== undefined && showPoster ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        >
          <Image source={{ uri: poster }} resizeMode={fit} style={{ width: '100%', height: '100%' }} />
        </View>
      ) : null}
    </View>
  );
}
