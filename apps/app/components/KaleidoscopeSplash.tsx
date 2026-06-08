/** Animated kaleidoscope splash - the launch / app-loading screen.
 *
 *  A full-bleed, N-fold mirror-symmetric vector bloom (react-native-svg) that
 *  slowly rotates and morphs (reanimated). Bloom-style: sharp triangular petals
 *  + slim shards radiating from a scalloped flower centre, cycling through flat
 *  vivid colours with Less's teal kept in the palette. No gradients, no shadows.
 *
 *  The SVG covers the ENTIRE viewport edge to edge (xMidYMid slice + petals that
 *  reach past the corners), including behind the status bar / notch. Pure JS +
 *  svg + reanimated - no native module, so it hot-reloads (no APK rebuild).
 *
 *  Rendered by app/_layout.tsx while fonts load (the `!loaded` branch); it
 *  unmounts the instant fonts resolve. Loops forever, so it is also safe to drop
 *  into a standalone preview page. */
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Box } from './layout';
import Svg, { Path, Circle, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useDerivedValue,
  withRepeat,
  withTiming,
  interpolateColor,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import {
  CENTER,
  SEGMENTS,
  PALETTE,
  wedgeTriangle,
  wedgeShard,
  flowerPath,
} from './kaleidoscope-geometry';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Petals reach past the corners of a 100x100 viewBox (half-diagonal ~= 70.7)
 *  so the bloom bleeds edge to edge with `slice`. The reach breathes between
 *  these bounds to drive the morph. */
const REACH_MIN = 60;
const REACH_MAX = 78;

export function KaleidoscopeSplash({ bg }: { bg: string }): React.ReactElement {
  const { width, height } = useWindowDimensions();
  const spin = useSharedValue(0);
  const hue = useSharedValue(0);
  const morph = useSharedValue(0);

  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 16000, easing: Easing.linear }), -1, false);
    hue.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.ease) }), -1, true);
    morph.value = withRepeat(withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => {
      cancelAnimation(spin);
      cancelAnimation(hue);
      cancelAnimation(morph);
    };
  }, [spin, hue, morph]);

  const reach = useDerivedValue(() => REACH_MIN + (REACH_MAX - REACH_MIN) * morph.value);

  const wheelProps = useAnimatedProps(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));
  const triProps = useAnimatedProps(() => ({
    d: wedgeTriangle(reach.value),
    fill: interpolateColor(hue.value, [0, 0.5, 1], PALETTE.petalA),
  }));
  const triAltProps = useAnimatedProps(() => ({
    d: wedgeTriangle(reach.value * 0.82),
    fill: interpolateColor(hue.value, [0, 0.5, 1], PALETTE.petalB),
  }));
  const shardProps = useAnimatedProps(() => ({
    d: wedgeShard(reach.value),
    fill: interpolateColor(hue.value, [0, 0.5, 1], PALETTE.shard),
  }));
  const flowerProps = useAnimatedProps(() => ({
    fill: interpolateColor(hue.value, [0, 0.5, 1], PALETTE.shard),
  }));

  const flower = flowerPath(13, 8);

  return (
    <Box style={[StyleSheet.absoluteFill, { backgroundColor: bg }]}>
      <Svg
        width={width}
        height={height}
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
      >
        <Circle cx={CENTER} cy={CENTER} r={71} fill={PALETTE.field} />
        <AnimatedG animatedProps={wheelProps} origin={`${CENTER}, ${CENTER}`}>
          {Array.from({ length: SEGMENTS }).map((_, i) => (
            <G key={i} rotation={(i / SEGMENTS) * 360} origin={`${CENTER}, ${CENTER}`}>
              <AnimatedPath animatedProps={triProps} />
              <AnimatedPath animatedProps={triAltProps} opacity={0.85} />
              <AnimatedPath animatedProps={shardProps} opacity={0.9} />
            </G>
          ))}
        </AnimatedG>
        <Circle cx={CENTER} cy={CENTER} r={20} fill={PALETTE.field} opacity={0.9} />
        <AnimatedPath d={flower} animatedProps={flowerProps} opacity={0.95} />
        <Circle cx={CENTER} cy={CENTER} r={6} fill={PALETTE.field} />
      </Svg>
    </Box>
  );
}

export default KaleidoscopeSplash;
