/** Animated kaleidoscope splash - the launch / app-loading screen.
 *
 *  FAITHFUL PORT of bloom.mocha.app. The Mocha app is a client-side canvas/SVG
 *  kaleidoscope generator: it tiles a single vector graphic into N mirror-
 *  symmetric wedge sectors around the screen centre. We reproduce its exact
 *  render algorithm, its exact default graphic path, and its exact default
 *  colours (green field #056117, lime graphic #B5FF6B, 14 sectors, scale 1.4,
 *  rotation 62 deg). See kaleidoscope-geometry.ts for the extracted constants
 *  and the algorithm transcription.
 *
 *  Render (per sector, matching the app's renderSector):
 *    rotate sector by i * 360/sectors, clip to a wedge, mirror even sectors
 *    (scale(-1,1) -> kaleidoscope reflection), then tiling-rotate / offset /
 *    rotate / scale the graphic and draw it centred.
 *
 *  MOTION: a rigid global spin reads as a pinwheel. A real kaleidoscope morphs
 *  because the SOURCE graphic moves WITHIN the mirrored wedges. So we animate the
 *  per-sector source params over time (offsetDistance slides the graphic in/out -
 *  the key morph; tilingRotation + inner rotation drift; a gentle scale breath),
 *  with the whole-wheel rotation kept slow + secondary. Since even sectors are
 *  mirrored, moving the source makes neighbouring reflections converge/diverge =
 *  the classic kaleidoscope transformation. The real bloom.mocha.app keyframes
 *  these same params (rotation/tilingRotation/globalRotation/scale); we drive
 *  them with mutually-prime sinusoids so the pattern loops seamlessly.
 *
 *  Driven by a PURE-JS requestAnimationFrame loop (NO react-native-reanimated):
 *  each frame bumps React state and re-renders, so it animates regardless of the
 *  installed dev-client's reanimated native/JS mismatch (which freezes worklets).
 *  Rotation is a plain transform prop on the wheel <G>; re-rendering each frame
 *  makes it update. Hot-reloads, no APK rebuild.
 *
 *  Rendered by app/_layout.tsx while fonts load (the `!loaded` branch); it
 *  unmounts the instant fonts resolve. Loops forever, so it is also safe to drop
 *  into a standalone preview page. The `bg` prop overrides the flat backdrop. */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Box } from './layout';
import Svg, { Path, G, ClipPath, Defs, Rect } from 'react-native-svg';
import {
  LOGO_PATH,
  LOGO_W,
  LOGO_H,
  MOCHA_DEFAULTS,
  wedgeClipPath,
} from './kaleidoscope-geometry';

const VB = 100; // viewBox is 0 0 VB VB, centre at (VB/2, VB/2)
const CENTER = VB / 2;
const FRAME_MS = 33; // ~30fps re-render; plenty smooth for a splash

// Animation periods (ms). The real bloom.mocha.app exposes rotation /
// tilingRotation / globalRotation / scale as keyframed params; the default
// preset is static (it is an editor), so the canonical "motion" is whatever the
// author keyframes. We drive the same params with slow, mutually-prime sinusoids
// so the mirrored reflections perpetually converge / diverge (the real
// kaleidoscope morph) instead of rigidly spinning like a pinwheel.
const GLOBAL_MS = 64000; // whole-wheel drift (secondary, very slow)
const OFFSET_MS = 11000; // graphic slides toward / away from centre (key morph)
const TILING_MS = 17000; // per-sector tiling rotation drift
const INNER_MS = 23000; // inner graphic rotation drift
const SCALE_MS = 13000; // gentle scale breathing

const D = MOCHA_DEFAULTS;
const SECTOR_DEG = 360 / D.sectors;
// App: effective graphic width = LOGO_W * (canvas/2048) * logoSize * scale.
// Map that onto our VB-unit canvas (canvas == VB) so the tiling matches.
const FIT = (VB / 2048) * D.logoSize * D.scale;
// Wedge clip reaches past the corners (half-diagonal of the VB box).
const CLIP = wedgeClipPath(D.sectors, VB * 0.72);

// Oscillation extents, tuned so the pattern stays full + organic, never empty.
const OFFSET_AMP = 16; // VB units the graphic drifts in/out from centre
const OFFSET_BASE = 6; // never sits dead-centre; keeps a lively core
const TILING_AMP = 26; // deg of tiling-rotation sway
const INNER_AMP = 18; // deg of inner-graphic sway around its 62deg base
const SCALE_AMP = 0.12; // +/- fraction of the breathing scale pulse

// Smooth 0..1 phase for a given period.
const phase = (now: number, period: number): number => (now % period) / period;
const wave = (now: number, period: number): number =>
  Math.sin(phase(now, period) * Math.PI * 2);

export function KaleidoscopeSplash({ bg }: { bg: string }): React.ReactElement {
  const { width, height } = useWindowDimensions();
  const [now, setNow] = useState(0);
  const startRef = useRef(0);
  const lastRef = useRef(0);

  useEffect(() => {
    let raf = 0;
    const tick = (t: number): void => {
      if (!startRef.current) startRef.current = t;
      if (t - lastRef.current >= FRAME_MS) {
        lastRef.current = t;
        setNow(t - startRef.current);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Slow whole-wheel drift (secondary). Linear so it never reverses, but slow
  // enough that the morph below - not the spin - dominates the eye.
  const spin = phase(now, GLOBAL_MS) * 360;

  // Time-varying SOURCE params. Because even sectors are mirrored, animating the
  // source makes neighbouring reflections converge / diverge => the classic
  // kaleidoscope in/out morph rather than a rigid pinwheel.
  const offset = OFFSET_BASE + OFFSET_AMP * (0.5 + 0.5 * wave(now, OFFSET_MS));
  const tiling = TILING_AMP * wave(now, TILING_MS);
  const innerRot = D.rotation + INNER_AMP * wave(now, INNER_MS);
  const breathe = FIT * (1 + SCALE_AMP * wave(now, SCALE_MS));

  // Square stage sized to the larger screen dimension, absolutely centred, so
  // the kaleidoscope centre lands exactly on the screen centre at any aspect
  // ratio while still covering edge to edge (flat bg fills any thin margin).
  const edge = Math.max(width, height);
  const stage = { width: edge, height: edge, left: (width - edge) / 2, top: (height - edge) / 2 };

  // Per-sector graphic transform in the sector's local frame (origin already at
  // centre + rotated by the parent <G>). Mirrors the app's renderSector tail:
  // mirror even sectors, offset, rotate, scale, then centre the graphic.
  const logoTransform = (i: number): string => {
    const mirror = i % 2 === 0 ? ' scale(-1, 1)' : '';
    // tiling rotation is applied at the sector frame (before the offset slide),
    // matching the app's `rotate(tilingRotation)` ahead of `translate(offset,0)`.
    return (
      `${mirror} rotate(${tiling})` +
      ` translate(${offset}, 0)` +
      ` rotate(${innerRot})` +
      ` scale(${breathe})` +
      ` translate(${-LOGO_W / 2}, ${-LOGO_H / 2})`
    );
  };

  return (
    <Box style={[StyleSheet.absoluteFill, { backgroundColor: bg }]} pointerEvents="none">
      <Box style={[styles.stage, stage]}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${VB} ${VB}`} preserveAspectRatio="xMidYMid slice">
          <Defs>
            <ClipPath id="wedge">
              <Path d={CLIP} />
            </ClipPath>
          </Defs>
          <Rect x={0} y={0} width={VB} height={VB} fill={D.bgColor} />
          <G transform={`rotate(${spin}, ${CENTER}, ${CENTER})`}>
            {Array.from({ length: D.sectors }).map((_, i) => (
              <G key={i} transform={`translate(${CENTER}, ${CENTER}) rotate(${i * SECTOR_DEG})`}>
                <G clipPath="url(#wedge)">
                  <G transform={logoTransform(i)}>
                    <Path d={LOGO_PATH} fill={D.graphicColor} />
                  </G>
                </G>
              </G>
            ))}
          </G>
        </Svg>
      </Box>
    </Box>
  );
}

const styles = StyleSheet.create({
  stage: { position: 'absolute' },
});

export default KaleidoscopeSplash;
