
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { Audio, type AVPlaybackStatus } from 'expo-av';
import { Icon } from './icon';

export interface AudioPlayerProps {
  src: string;
  duration?: number;
  onPlay?: () => void;
  dark?: boolean;
}

function fmt(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function AudioPlayer(props: AudioPlayerProps): React.ReactElement {
  const { src, duration, onPlay, dark = false } = props;
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lengthMs, setLengthMs] = useState((duration ?? 0) * 1000);

  useEffect(() => {
    return () => {
      void soundRef.current?.unloadAsync();
      soundRef.current = null;
    };
  }, []);

  function onStatus(status: AVPlaybackStatus): void {
    if (!status.isLoaded) return;
    setPlaying(status.isPlaying);
    if (status.durationMillis) setLengthMs(status.durationMillis);
    if (status.durationMillis) {
      setProgress(status.positionMillis / status.durationMillis);
    }
    if (status.didJustFinish) {
      setPlaying(false);
      setProgress(0);
    }
  }

  async function toggle(): Promise<void> {
    if (soundRef.current === null) {
      onPlay?.();
      const { sound } = await Audio.Sound.createAsync(
        { uri: src },
        { shouldPlay: true },
        onStatus,
      );
      soundRef.current = sound;
      return;
    }
    if (playing) await soundRef.current.pauseAsync();
    else {
      onPlay?.();
      await soundRef.current.playAsync();
    }
  }

  const fg = dark ? '#ffffff' : '#000000';
  const trackBg = dark ? '#3a3c40' : '#d8d8da';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 10,
        borderRadius: 12,
        backgroundColor: dark ? '#1c1c1e' : '#f0f0f2',
      }}
    >
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void toggle();
        }}
      >
        <Icon name={playing ? 'pause' : 'play'} size={22} color={fg} />
      </Pressable>
      <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: trackBg }}>
        <View
          style={{
            width: `${Math.round(progress * 100)}%`,
            height: 4,
            borderRadius: 2,
            backgroundColor: fg,
          }}
        />
      </View>
      <RNText style={{ color: fg, fontSize: 13, fontFamily: 'Calibre-Medium' }}>
        {fmt(lengthMs)}
      </RNText>
    </View>
  );
}
