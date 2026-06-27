
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { Audio, type AVPlaybackStatus } from 'expo-av';
import { Icon } from './icon';

const DEFAULT_BAR_COUNT = 34;

export interface AudioPlayerProps {
  src: string;
  duration?: number;
  onPlay?: () => void;
  dark?: boolean;
  waveform?: boolean;
  bars?: number[];
  barCount?: number;
  accent?: string;
  onAccent?: string;
}

const WAVE_TRACK_H = 26;

function fmt(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface AudioState {
  playing: boolean;
  position: number;
  duration: number;
  toggle: () => Promise<void>;
  seek: (fraction: number) => void;
}

function useAudio(src: string, onPlay?: () => void): AudioState {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    return () => {
      void soundRef.current?.unloadAsync();
      soundRef.current = null;
    };
  }, []);

  function onStatus(status: AVPlaybackStatus): void {
    if (!status.isLoaded) return;
    setPosition(status.positionMillis);
    if (status.durationMillis) setDuration(status.durationMillis);
    if (status.didJustFinish) {
      setPlaying(false);
      setPosition(0);
      void soundRef.current?.setPositionAsync(0);
    } else {
      setPlaying(status.isPlaying);
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

  function seek(fraction: number): void {
    if (!soundRef.current || duration <= 0) return;
    const clamped = Math.max(0, Math.min(1, fraction));
    void soundRef.current.setPositionAsync(Math.floor(clamped * duration));
  }

  return { playing, position, duration, toggle, seek };
}

function WaveformPlayer(props: AudioPlayerProps): React.ReactElement {
  const { src, onPlay, accent = '#0a7cff', onAccent = '#ffffff' } = props;
  const count = props.barCount ?? DEFAULT_BAR_COUNT;
  const { playing, position, duration, toggle, seek } = useAudio(src, onPlay);
  const [barWidth, setBarWidth] = useState(0);
  const bars = useMemo(
    () =>
      props.bars && props.bars.length > 0
        ? props.bars
        : new Array<number>(count).fill(0.5),
    [props.bars, count],
  );

  const progress = duration > 0 ? Math.min(position / duration, 1) : 0;
  const fallbackMs = (props.duration ?? 0) * 1000 || duration;
  const label = playing || position > 0 ? fmt(position) : fmt(fallbackMs);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void toggle();
        }}
        hitSlop={8}
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: onAccent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={playing ? 'pause' : 'play'} size={18} color={accent} />
      </Pressable>
      <Pressable
        style={{ flex: 1, height: WAVE_TRACK_H, justifyContent: 'center' }}
        onLayout={(ev) => {
          setBarWidth(ev.nativeEvent.layout.width);
        }}
        onPress={(ev) => {
          if (barWidth > 0) seek(ev.nativeEvent.locationX / barWidth);
        }}
      >
        <View style={{ height: WAVE_TRACK_H, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          {bars.map((h, i) => {
            const filled = i / bars.length <= progress;
            return (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: Math.max(3, h * WAVE_TRACK_H),
                  borderRadius: 1,
                  backgroundColor: onAccent,
                  opacity: filled ? 1 : 0.45,
                }}
              />
            );
          })}
        </View>
      </Pressable>
      <RNText
        style={{
          color: onAccent,
          fontSize: 13,
          minWidth: 34,
          textAlign: 'right',
          fontFamily: 'Calibre-Regular',
        }}
      >
        {label}
      </RNText>
    </View>
  );
}

function BasicPlayer(props: {
  src: string;
  duration?: number;
  onPlay?: () => void;
  dark: boolean;
}): React.ReactElement {
  const { src, duration, onPlay, dark } = props;
  const { playing, position, duration: liveDuration, toggle } = useAudio(src, onPlay);
  const lengthMs = liveDuration > 0 ? liveDuration : (duration ?? 0) * 1000;
  const progress = lengthMs > 0 ? Math.min(position / lengthMs, 1) : 0;

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

export function AudioPlayer(props: AudioPlayerProps): React.ReactElement {
  if (props.waveform) return <WaveformPlayer {...props} />;
  const { src, duration, onPlay, dark = false } = props;
  return <BasicPlayer src={src} duration={duration} onPlay={onPlay} dark={dark} />;
}
