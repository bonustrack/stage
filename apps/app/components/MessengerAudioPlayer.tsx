/** Inline audio player for messenger bubbles — lazy-loads via expo-av Audio.Sound. */

import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { HeroIcon } from './HeroIcon';

interface Props { uri: string; fg: string; sub: string }

function fmt(ms: number | undefined): string {
  if (!ms || ms <= 0) return '0:00';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

export function MessengerAudioPlayer({ uri, fg, sub }: Props): React.ReactElement {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => () => { void soundRef.current?.unloadAsync().catch(() => undefined); }, []);

  const onStatus = (st: AVPlaybackStatus): void => {
    if (!st.isLoaded) return;
    setPosition(st.positionMillis);
    if (st.durationMillis) setDuration(st.durationMillis);
    if (st.didJustFinish) {
      setPlaying(false);
      void soundRef.current?.setPositionAsync(0).catch(() => undefined);
    } else {
      setPlaying(st.isPlaying);
    }
  };

  const toggle = async (): Promise<void> => {
    if (soundRef.current) {
      const s = soundRef.current;
      const st = await s.getStatusAsync();
      if (st.isLoaded && st.isPlaying) await s.pauseAsync();
      else await s.playAsync();
      return;
    }
    const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true }, onStatus);
    soundRef.current = sound;
  };

  /** Progress as a 0..1 fraction; falls back to 0 until first status callback. */
  const progress = duration > 0 ? Math.min(position / duration, 1) : 0;

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10,
      backgroundColor: 'rgba(0,0,0,0.12)', marginBottom: 6, minWidth: 220,
    }}>
      <Pressable onPress={() => void toggle()} hitSlop={8}>
        <HeroIcon name={playing ? 'pause' : 'play'} size={24} color={fg} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <View style={{ height: 3, backgroundColor: sub, opacity: 0.4, borderRadius: 2 }}>
          <View style={{ height: 3, width: `${progress * 100}%`, backgroundColor: fg, borderRadius: 2 }} />
        </View>
      </View>
      <Text style={{ color: fg, fontSize: 11, opacity: 0.6, minWidth: 36, textAlign: 'right' }}>
        {playing ? fmt(position) : fmt(duration || position)}
      </Text>
    </View>
  );
}
