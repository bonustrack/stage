/** Animated kaleidoscope splash - the launch / app-loading screen.
 *
 *  A full-bleed, N-fold mirror-symmetric vector bloom (react-native-svg) that
 *  slowly rotates and morphs. Bloom-style: sharp triangular petals + slim
 *  shards radiating from a scalloped flower centre, cycling through flat vivid
 *  colours with Less's teal kept in the palette. No gradients, no shadows.
 *
 *  The SVG covers the ENTIRE viewport edge to edge (xMidYMid slice + petals
 *  that reach past the corners), including behind the status bar / notch.
 *
 *  Driven by a PURE-JS requestAnimationFrame loop (NO react-native-reanimated):
 *  each frame updates React state and re-renders the SVG on the JS thread, so
 *  the animation runs regardless of the native reanimated module (the installed
 *  dev-client had a reanimated native/JS mismatch that froze every worklet).
 *  Rotation is a plain `rotation` prop on the <G> wheel; because the component
 *  re-renders from state every frame, the prop actually updates. Morph + colour
 *  are recomputed in plain JS each frame. Hot-reloads, no APK rebuild.
 *
 *  Rendered by app/_layout.tsx while fonts load (the `!loaded` branch); it
 *  unmounts the instant fonts resolve. Loops forever, so it is also safe to drop
 *  into a standalone preview page. */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Box } from './layout';
import Svg, { Path, Circle, G } from 'react-native-svg';
import {
  CENTER,
  SEGMENTS,
  PALETTE,
  REACH_MIN,
  REACH_MAX,
  cycleColor,
  wedgePaths,
  flowerPath,
} from './kaleidoscope-geometry';

const SPIN_MS = 16000; // one full rotation
const MORPH_MS = 5200; // reach breathe period (ping-pong)
const HUE_MS = 4200; // colour cycle period (ping-pong)
const FRAME_MS = 33; // ~30fps re-render; plenty smooth for a splash

export function KaleidoscopeSplash({ bg }: { bg: string }): React.ReactElement {
  const { width, height } = useWindowDimensions();
  // Single frame counter -> drives angle / morph / colour, all derived below.
  const [now, setNow] = useState(0);
  const startRef = useRef(0);
  const lastRef = useRef(0);

  useEffect(() => {
    let raf = 0;
    const tick = (t: number): void => {
      if (!startRef.current) startRef.current = t;
      // Throttle re-renders to ~FRAME_MS while still using rAF for smoothness.
      if (t - lastRef.current >= FRAME_MS) {
        lastRef.current = t;
        setNow(t - startRef.current);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Continuous rotation 0..360 (plain prop -> updates because we re-render).
  const angle = ((now % SPIN_MS) / SPIN_MS) * 360;
  // Ping-pong 0..1 for morph + colour via a triangle-ish wave from sin.
  const morphT = (Math.sin((now / MORPH_MS) * Math.PI * 2) + 1) / 2;
  const hueT = (Math.sin((now / HUE_MS) * Math.PI * 2) + 1) / 2;

  const reach = REACH_MIN + (REACH_MAX - REACH_MIN) * morphT;
  const { tri, triAlt, shard } = wedgePaths(reach);
  const triFill = cycleColor(PALETTE.petalA, hueT);
  const triAltFill = cycleColor(PALETTE.petalB, hueT);
  const shardFill = cycleColor(PALETTE.shard, hueT);
  const flower = flowerPath(13, 8);

  // One square stage sized to the LARGER screen dimension and absolutely
  // centred (negative offsets). The square's centre == the exact screen centre
  // on any aspect ratio, and since the edge >= both dims it still covers the
  // screen edge to edge (flat bg shows in any thin margin). Every layer shares
  // the same square + viewBox 0 0 100 100, so the field, the wheel's rotation
  // origin, and the flower centre all collapse onto (50,50) == screen centre.
  // The wheel spins around that same point (no orbit).
  const edge = Math.max(width, height);
  const stage = { width: edge, height: edge, left: (width - edge) / 2, top: (height - edge) / 2 };

  return (
    <Box style={[StyleSheet.absoluteFill, { backgroundColor: bg }]} pointerEvents="none">
      <Box style={[styles.stage, stage]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          <Circle cx={CENTER} cy={CENTER} r={71} fill={PALETTE.field} />
          <G rotation={angle} origin={`${CENTER}, ${CENTER}`}>
            {Array.from({ length: SEGMENTS }).map((_, i) => (
              <G key={i} rotation={(i / SEGMENTS) * 360} origin={`${CENTER}, ${CENTER}`}>
                <Path d={tri} fill={triFill} />
                <Path d={triAlt} fill={triAltFill} opacity={0.85} />
                <Path d={shard} fill={shardFill} opacity={0.9} />
              </G>
            ))}
          </G>
          <Circle cx={CENTER} cy={CENTER} r={20} fill={PALETTE.field} opacity={0.9} />
          <Path d={flower} fill={shardFill} opacity={0.95} />
          <Circle cx={CENTER} cy={CENTER} r={6} fill={PALETTE.field} />
        </Svg>
      </Box>
    </Box>
  );
}

const styles = StyleSheet.create({
  stage: { position: 'absolute' },
});

export default KaleidoscopeSplash;
