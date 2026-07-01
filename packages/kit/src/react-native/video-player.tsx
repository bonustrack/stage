
import { Video, ResizeMode } from 'expo-av';
import { View } from 'react-native';

export interface VideoPlayerProps {
  src: string;
  poster?: string;
  controls?: boolean;
}

export function VideoPlayer(props: VideoPlayerProps): React.ReactElement {
  const { src, poster, controls = true } = props;
  return (
    <View
      style={{
        width: '100%',
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#000000',
      }}
    >
      <Video
        source={{ uri: src }}
        posterSource={poster ? { uri: poster } : undefined}
        usePoster={poster !== undefined}
        style={{ width: '100%', aspectRatio: 16 / 9 }}
        useNativeControls={controls}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={false}
      />
    </View>
  );
}
