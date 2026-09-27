import { useMemo, useRef, useState } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Box } from '../layout';
import { seekFraction } from './audioCard.model';

const HIT_HEIGHT = 24;
const TRACK_HEIGHT = 4;
const THUMB_SIZE = 14;
const KEY_STEP = 0.05;

export interface SeekBarColors { track: string; fill: string; thumb: string; thumbBorder: string }

export function AudioSeekBar({ progress, enabled, label, colors, onScrub, onSeek }: {
  progress: number; enabled: boolean; label: string; colors: SeekBarColors;
  onScrub: (fraction: number | null) => void; onSeek: (fraction: number) => void;
}): React.ReactElement {
  const widthRef = useRef(0);
  const [width, setWidth] = useState(0);
  const handlers = useRef({ onScrub, onSeek });
  handlers.current = { onScrub, onSeek };
  const gesture = useMemo(() => {
    const at = (x: number): number => seekFraction(x - THUMB_SIZE / 2, widthRef.current - THUMB_SIZE);
    const scrub = (x: number): void => { handlers.current.onScrub(at(x)); };
    const commit = (x: number): void => { handlers.current.onSeek(at(x)); };
    const release = (): void => { handlers.current.onScrub(null); };
    return Gesture.Pan()
      .enabled(enabled)
      .minDistance(0)
      .shouldCancelWhenOutside(false)
      .onBegin((e) => { runOnJS(scrub)(e.x); })
      .onUpdate((e) => { runOnJS(scrub)(e.x); })
      .onEnd((e) => { runOnJS(commit)(e.x); })
      .onFinalize(() => { runOnJS(release)(); });
  }, [enabled]);
  const left = progress * Math.max(0, width - THUMB_SIZE);
  return (
    <GestureDetector gesture={gesture}>
      <Box
        testID="audio-seek"
        flex={1}
        height={HIT_HEIGHT}
        justify="center"
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => { onSeek(progress + (e.nativeEvent.actionName === 'increment' ? KEY_STEP : -KEY_STEP)); }}
        onLayout={(e) => { widthRef.current = e.nativeEvent.layout.width; setWidth(e.nativeEvent.layout.width); }}
        style={enabled ? { cursor: 'pointer' } : undefined}
      >
        <Box height={TRACK_HEIGHT} radius={TRACK_HEIGHT / 2} background={colors.track} pointerEvents="none">
          <Box width={left + THUMB_SIZE / 2} height={TRACK_HEIGHT} radius={TRACK_HEIGHT / 2} background={colors.fill}/>
        </Box>
        <Box
          width={THUMB_SIZE}
          height={THUMB_SIZE}
          radius={THUMB_SIZE / 2}
          background={colors.thumb}
          pointerEvents="none"
          style={{
            position: 'absolute', left, top: (HIT_HEIGHT - THUMB_SIZE) / 2,
            borderWidth: 1, borderColor: colors.thumbBorder,
            shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2,
          }}
        />
      </Box>
    </GestureDetector>
  );
}
