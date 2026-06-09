/** Animated 1-bit dither background for the onboarding flow.
 *
 *  Matches the reference reel: a full-bleed, pure black/white grid of square
 *  tiles whose on/off state flows and dissolves over time, like a halftone /
 *  threshold-dither image slowly morphing. No colour, no gradient - just high
 *  contrast monochrome blocks that ripple across the screen.
 *
 *  Implementation is pure-JS / no new native dep: a coarse grid of plain
 *  `Animated.View` tiles (react-native-reanimated). One shared clock drives a
 *  flowing scalar field; each tile derives its own opacity from a cheap
 *  sine-interference function of its (col,row) + the clock, so tiles light up
 *  and fade in travelling waves. All worklet math is inlined (no imported-helper
 *  calls inside worklets) per the reanimated cross-file-worklet gotcha.
 *
 *  A Skia version could run the exact per-pixel dither of a source image as a
 *  fragment shader (sharper, image-driven), but Skia is not a dep here; this
 *  tile-field is the closest pure-JS approximation and stays smooth because the
 *  tile count is bounded and only opacity (a cheap transform) animates. */

import { useMemo } from 'react';

import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useDerivedValue,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

export interface AnimatedBackgroundProps {
  /** true => white tiles on black; false => black tiles on white. */
  dark: boolean;
  /** Overall tile opacity ceiling (keep low so content stays readable). */
  intensity?: number;
}

/** Number of columns in the dither grid. Chunky blocks match the reference and
 *  keep the animated-view count bounded (cols * rows) so it stays smooth. */
const COLS = 14;

interface Cell {
  x: number;
  y: number;
  /** Stable per-tile phase offsets baked once (cheap, avoids per-frame trig). */
  pa: number;
  pb: number;
}

function Tile({
  cell,
  size,
  clock,
  tint,
  intensity,
}: {
  cell: Cell;
  size: number;
  clock: SharedValue<number>;
  tint: string;
  intensity: number;
}): React.ReactElement {
  // Derive this tile's brightness from interfering travelling waves. Inlined
  // worklet math (no cross-file helper calls).
  const level = useDerivedValue(() => {
    'worklet';
    const t = clock.value;
    const w1 = Math.sin(cell.pa + t * 1.7);
    const w2 = Math.sin(cell.pb + t * 1.1 + cell.pa * 0.5);
    const w3 = Math.sin((cell.pa + cell.pb) * 0.5 - t * 0.8);
    // combine + threshold into a soft 0..1 "lit" amount
    const v = (w1 + w2 + w3) / 3; // -1..1
    const lit = v > 0.15 ? 1 : v > -0.1 ? (v + 0.1) / 0.25 : 0;
    return lit;
  });

  const style = useAnimatedStyle(() => {
    'worklet';
    return { opacity: level.value * intensity };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: cell.x,
          top: cell.y,
          width: size,
          height: size,
          backgroundColor: tint,
        },
        style,
      ]}
    />
  );
}

export function AnimatedBackground({
  dark,
  intensity = 0.16,
}: AnimatedBackgroundProps): React.ReactElement {
  const { width, height } = useWindowDimensions();
  const tint = dark ? '#ffffff' : '#000000';

  const clock = useSharedValue(0);

  // Single repeating clock (0..2pi*N) drives every tile.
  useMemo(() => {
    clock.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 9000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [clock]);

  const { cells, size } = useMemo(() => {
    const cols = COLS;
    const sz = width / cols;
    const rows = Math.ceil(height / sz);
    const list: Cell[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        list.push({
          x: c * sz,
          y: r * sz,
          pa: c * 0.55 + r * 0.21,
          pb: c * 0.18 - r * 0.47,
        });
      }
    }
    return { cells: list, size: sz };
  }, [width, height]);

  return (
    <Animated.View style={StyleSheet.absoluteFill} pointerEvents="none">
      {cells.map((cell, i) => (
        <Tile
          key={i}
          cell={cell}
          size={size}
          clock={clock}
          tint={tint}
          intensity={intensity}
        />
      ))}
    </Animated.View>
  );
}
