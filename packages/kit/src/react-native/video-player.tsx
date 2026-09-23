import { useEffect, useState } from 'react';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image, View } from 'react-native';

export interface VideoPlayerProps {
  src: string;
  poster?: string;
  controls?: boolean;
}

export function VideoPlayer(props: VideoPlayerProps): React.ReactElement {
  const { src, poster, controls = true } = props;
  const player = useVideoPlayer({ uri: src });
  const [showPoster, setShowPoster] = useState(poster !== undefined);

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
        backgroundColor: '#000000',
      }}
    >
      <VideoView
        player={player}
        style={{ width: '100%', aspectRatio: 16 / 9 }}
        nativeControls={controls}
        contentFit="contain"
        fullscreenOptions={{ enable: true }}
        playsInline
      />
      {poster !== undefined && showPoster ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        >
          <Image source={{ uri: poster }} resizeMode="contain" style={{ width: '100%', height: '100%' }} />
        </View>
      ) : null}
    </View>
  );
}
