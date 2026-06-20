
import { useEffect, useMemo, useRef, useState } from 'react';

import { Pressable } from '@stage-labs/kit/pressable';
import { Text } from '@stage-labs/kit/text';
import { Icon } from '@stage-labs/kit/icon';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { Row, Col } from './layout';
import { waveformBars } from './VoiceMessage.bars';
import { useDecodedBars } from './VoiceMessage.barsCache';

const BAR_COUNT = 34;

const ACCENT = '#0a7cff';
const ON_ACCENT = '#ffffff';
const TRACK_H = 26;

interface Props { uri: string }

function fmt(ms: number | undefined): string {
  if (!ms || ms <= 0) return '0:00';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

export function VoiceMessage({ uri }: Props): React.ReactElement {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [barWidth, setBarWidth] = useState(0);
  const synthetic = useMemo(() => waveformBars(uri, BAR_COUNT), [uri]);
  const decoded = useDecodedBars(uri, BAR_COUNT);
  const bars = decoded ?? synthetic;

  useEffect(() => () => { void soundRef.current?.unloadAsync().catch(() => undefined); }, []);

  const onStatus = (st: AVPlaybackStatus): void => {
    if (!st.isLoaded) return;
    setPosition(st.positionMillis);
    if (st.durationMillis) setDuration(st.durationMillis);
    if (st.didJustFinish) {
      setPlaying(false);
      setPosition(0);
      void soundRef.current?.setPositionAsync(0).catch(() => undefined);
    } else {
      setPlaying(st.isPlaying);
    }
  };

  const toggle = async (): Promise<void> => {
    try {
      if (soundRef.current) {
        const st = await soundRef.current.getStatusAsync();
        if (st.isLoaded && st.isPlaying) await soundRef.current.pauseAsync();
        else await soundRef.current.playAsync();
        return;
      }
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true }, onStatus);
      soundRef.current = sound;
    } catch { }
  };

  const seekTo = (x: number): void => {
    if (!soundRef.current || duration <= 0 || barWidth <= 0) return;
    const fraction = Math.max(0, Math.min(1, x / barWidth));
    void soundRef.current.setPositionAsync(Math.floor(fraction * duration));
  };

  const progress = duration> 0 ? Math.min(position / duration, 1) : 0;
  const label = playing || position> 0 ? fmt(position) : fmt(duration);

  return (
    <Row radius="2xl" background={ACCENT} maxWidth={280} minWidth={200} padding={{ x: 9, y: 7 }} margin={{ bottom: 6 }} align="center" gap={10} style={{ alignSelf: 'flex-start' }}>
      <Pressable onPress={() => void toggle()} hitSlop={8} style={{
        width: 34, height: 34, borderRadius: 17, backgroundColor: ON_ACCENT,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={playing ? 'pause' : 'play'} size={18} color={ACCENT}/>
      </Pressable>
      <Pressable
        style={{ flex: 1, height: TRACK_H, justifyContent: 'center' }}
        onLayout={(ev) => { setBarWidth(ev.nativeEvent.layout.width); }}
        onPress={(ev) => { seekTo(ev.nativeEvent.locationX); }}
>
        <Row height={TRACK_H} align="center" gap={2}>
          {bars.map((h, i) => {
            const filled = i / bars.length <= progress;
            return (
              <Col height={Math.max(3, h * TRACK_H)} radius="2xs" background={ON_ACCENT} flex={1}
                key={i}
                style={{ opacity: filled ? 1 : 0.45 }}
/>
            );
          })}
        </Row>
      </Pressable>
      <Text size="xs" color={ON_ACCENT} style={{ minWidth: 34, textAlign: 'right' }}>{label}</Text>
    </Row>
  );
}
