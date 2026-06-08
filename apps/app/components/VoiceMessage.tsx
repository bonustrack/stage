/** Facebook-Messenger-style voice message player for conversation bubbles:
 *  a rounded accent pill holding a circular play/pause button, a tappable
 *  waveform (representative bars that fill with playback progress), and the
 *  elapsed / total duration. Playback uses expo-av (same lib the composer's
 *  recorder uses). Any audio attachment renders through this. */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable } from '@metro-labs/kit/pressable';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { Box } from './layout';
import { waveformBars } from './VoiceMessage.bars';
import { useDecodedBars } from './VoiceMessage.barsCache';

/** Bar count — shared by the synthetic placeholder and the real decode so the
 *  swap from placeholder to true waveform doesn't reflow the track. */
const BAR_COUNT = 34;

/** Messenger's outgoing-bubble blue. Used for the pill so the player reads as
 *  a voice message regardless of the flat Discord-style row theming around it. */
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
  /** Synthetic placeholder shown until the on-device decode resolves; the real
   *  PCM-derived bars replace it once `useDecodedBars` returns (and fall back to
   *  this synthetic shape if decode fails or the native module is unavailable). */
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
    } catch { /** Network / decode error — stay idle; tap to retry. */ }
  };

  const seekTo = (x: number): void => {
    if (!soundRef.current || duration <= 0 || barWidth <= 0) return;
    const fraction = Math.max(0, Math.min(1, x / barWidth));
    void soundRef.current.setPositionAsync(Math.floor(fraction * duration));
  };

  /** 0..1 playback progress; controls how many bars are "filled". */
  const progress = duration > 0 ? Math.min(position / duration, 1) : 0;
  /** Show elapsed while playing, otherwise total (mirrors Messenger). */
  const label = playing || position > 0 ? fmt(position) : fmt(duration);

  return (
    <Box style={{
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 7, paddingHorizontal: 9, borderRadius: 22,
      backgroundColor: ACCENT, marginBottom: 6, alignSelf: 'flex-start',
      maxWidth: 280, minWidth: 200,
    }}>
      <Pressable onPress={() => void toggle()} hitSlop={8} style={{
        width: 34, height: 34, borderRadius: 17, backgroundColor: ON_ACCENT,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={playing ? 'pause' : 'play'} size={18} color={ACCENT} />
      </Pressable>
      <Pressable
        style={{ flex: 1, height: TRACK_H, justifyContent: 'center' }}
        onLayout={(ev) => setBarWidth(ev.nativeEvent.layout.width)}
        onPress={(ev) => seekTo(ev.nativeEvent.locationX)}
      >
        <Box style={{
          flexDirection: 'row', alignItems: 'center', height: TRACK_H, gap: 2,
        }}>
          {bars.map((h, i) => {
            const filled = i / bars.length <= progress;
            return (
              <Box
                key={i}
                style={{
                  flex: 1,
                  height: Math.max(3, h * TRACK_H),
                  borderRadius: 2,
                  backgroundColor: ON_ACCENT,
                  opacity: filled ? 1 : 0.45,
                }}
              />
            );
          })}
        </Box>
      </Pressable>
      <Text style={{
        color: ON_ACCENT, fontSize: 12, minWidth: 34, textAlign: 'right',
        fontFamily: 'Calibre-Medium',
      }}>{label}</Text>
    </Box>
  );
}
