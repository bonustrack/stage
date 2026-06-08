/** Animated kaleidoscope splash — the launch / app-loading screen.
 *
 *  A radial, N-fold-symmetric vector kaleidoscope (react-native-svg) that slowly
 *  rotates and cycles its colours (reanimated). Matches the brand reference: sharp
 *  triangular petals + slim shards radiating from a scalloped flower centre, in a
 *  deep-magenta / hot-pink palette with a teal accent (Less's colour). Pure JS +
 *  svg + reanimated — no native module, so it hot-reloads (no APK rebuild).
 *
 *  Rendered by app/_layout.tsx while fonts load (the `!loaded` branch). Keeps the
 *  existing cold-start hide timing: it unmounts the instant fonts resolve. */
import { useEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import { Box } from './layout';
import Svg, { Path, Circle, G, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withTiming,
  interpolateColor,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Brand palette: deep magenta field, hot-pink shards, teal accent. The colour
 *  cycle blends petal fill across these three so the wheel breathes through the
 *  brand hues rather than sitting on one. */
const FIELD = '#5E1442';
const PETALS = ['#F77FE8', '#FF4FB6', '#19C2B0'];
const SEGMENTS = 12; // N-fold rotational symmetry

/** One wedge of the kaleidoscope: a sharp outer triangle + a slim inner shard,
 *  drawn once and rotated SEGMENTS times around the centre. Coordinates are in a
 *  100x100 viewBox centred at (50,50). */
const WEDGE_TRIANGLE = 'M50 50 L62 6 L38 6 Z';
const WEDGE_SHARD = 'M50 50 L54 20 Q50 14 46 20 Z';

/** Scalloped flower centre — a ring of arcs forming a soft petal-edged disc. */
function flowerPath(r: number, petals: number): string {
  const cx = 50, cy = 50;
  let d = '';
  for (let i = 0; i < petals; i++) {
    const a0 = (i / petals) * Math.PI * 2;
    const a1 = ((i + 1) / petals) * Math.PI * 2;
    const am = (a0 + a1) / 2;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const bulge = r * 1.32;
    const xm = cx + bulge * Math.cos(am), ym = cy + bulge * Math.sin(am);
    d += i === 0 ? `M${x0.toFixed(2)} ${y0.toFixed(2)} ` : '';
    d += `Q${xm.toFixed(2)} ${ym.toFixed(2)} ${x1.toFixed(2)} ${y1.toFixed(2)} `;
  }
  return d + 'Z';
}

export function KaleidoscopeSplash({ bg }: { bg: string }): React.ReactElement {
  const { width, height } = useWindowDimensions();
  const size = Math.min(width, height) * 0.92;
  const spin = useSharedValue(0);
  const hue = useSharedValue(0);

  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 14000, easing: Easing.linear }), -1, false);
    hue.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => { cancelAnimation(spin); cancelAnimation(hue); };
  }, [spin, hue]);

  const wheelProps = useAnimatedProps(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));
  const triFill = useAnimatedProps(() => ({
    fill: interpolateColor(hue.value, [0, 0.5, 1], PETALS),
  }));
  const shardFill = useAnimatedProps(() => ({
    fill: interpolateColor(hue.value, [0, 0.5, 1], [PETALS[2], PETALS[0], PETALS[1]]),
  }));

  const flower = flowerPath(15, 8);

  return (
    <Box style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="field" cx="50%" cy="50%" r="55%">
            <Stop offset="0%" stopColor={FIELD} stopOpacity={0.0} />
            <Stop offset="100%" stopColor={FIELD} stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={50} fill={FIELD} />
        <AnimatedG animatedProps={wheelProps} origin="50, 50">
          {Array.from({ length: SEGMENTS }).map((_, i) => (
            <G key={i} rotation={(i / SEGMENTS) * 360} origin="50, 50">
              <AnimatedPath animatedProps={triFill} d={WEDGE_TRIANGLE} />
              <AnimatedPath animatedProps={shardFill} d={WEDGE_SHARD} opacity={0.9} />
            </G>
          ))}
        </AnimatedG>
        <Circle cx={50} cy={50} r={28} fill="url(#field)" opacity={0.85} />
        <AnimatedPath animatedProps={triFill} d={flower} opacity={0.95} />
        <Circle cx={50} cy={50} r={7} fill={FIELD} opacity={0.6} />
      </Svg>
    </Box>
  );
}

export default KaleidoscopeSplash;
