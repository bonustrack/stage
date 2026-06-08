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
 *    (scale(-1,1) -> kaleidoscope reflection), then translate/rotate/scale the
 *    graphic and draw it centred. A slow globalRotation spins the whole wheel.
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
const SPIN_MS = 36000; // one full globalRotation (slow, like a screensaver)
const FRAME_MS = 33; // ~30fps re-render; plenty smooth for a splash

const D = MOCHA_DEFAULTS;
const SECTOR_DEG = 360 / D.sectors;
// App: effective graphic width = LOGO_W * (canvas/2048) * logoSize * scale.
// Map that onto our VB-unit canvas (canvas == VB) so the tiling matches.
const FIT = (VB / 2048) * D.logoSize * D.scale;
// Wedge clip reaches past the corners (half-diagonal of the VB box).
const CLIP = wedgeClipPath(D.sectors, VB * 0.72);

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

  // Continuous global rotation (plain prop -> updates because we re-render).
  const spin = ((now % SPIN_MS) / SPIN_MS) * 360;

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
    return (
      `${mirror} translate(${D.offsetDistance}, 0)` +
      ` rotate(${D.rotation})` +
      ` scale(${FIT})` +
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
