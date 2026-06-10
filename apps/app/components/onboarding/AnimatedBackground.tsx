/** ANIMATED ONBOARDING BACKGROUND - dithered-portrait flipbook (Rodenbroeker).
 *
 *  Full-bleed background behind the onboarding carousel. It plays a 1-bit (pure
 *  black + white) dithered flipbook of a real ANIMATED portrait reel - the same
 *  Tim Rodenbroeker p5 technique (step a source on a grid, sample one pixel of
 *  luminance per cell, quantize to a 1-bit cell). The face, the horizontal
 *  smear/stretch bands and the ragged separator all read exactly like the
 *  reference, because the frames are derived from the actual reference animation.
 *
 *  KEY DIFFERENCE vs the earlier version: the motion is REAL, inherited from a
 *  crisp animated SOURCE (an mp4/gif), not synthesized (no pan/threshold-breathe
 *  baked over a single degraded still). Each output frame is one source frame
 *  run through the grid->1-bit-Bayer->nearest-neighbor-upscale transform, so the
 *  source stays crisp and the animation is genuine.
 *
 *  MECHANISM (offline, see gen_dither.py):
 *   - source animation -> per sampled frame -> downsample onto a 176x90 grid
 *     (area-average per cell, NO crop: the grid keeps the source's exact aspect)
 *     -> global autocontrast + gamma so the face stays punchy -> 1-bit Bayer
 *     (4x4) ordered dither (strictly #000/#fff) -> nearest-neighbor upscale with
 *     DISTINCT x/y factors (4x14 px per cell) so the cells are hard-edged
 *     RECTANGLES (taller than wide), giving a 704x1260 frame that matches the
 *     source's exact 464x832 (0.5577) proportions - no square cells, no crop.
 *   - SEAMLESS LOOP: the generator detects the source's true loop period and
 *     samples the 36 frames evenly across exactly ONE loop, so frame 35 -> 0
 *     wraps with no pop (the 35->0 diff is within the interior step range).
 *
 *  TECHNIQUE: pre-rendered flipbook (architecture A). The dithered frames ship
 *  as bundled PNG assets - real face / true 1-bit B&W / hard cells pixel-perfect
 *  by construction. NO native dependency, NO new APK - a pure-JS
 *  requestAnimationFrame loop over stacked Kit <Image>s with opacity toggling
 *  (flicker-free, all frames pre-decoded), hot-reloadable like the JS splash.
 *  (A live on-device Skia renderer that samples gif frames per draw is possible
 *  for runtime flexibility, but it is a native dep = needs an APK rebuild before
 *  the served branch can use it; not needed here - the offline transform already
 *  matches the reference at full fidelity.)
 *
 *  Frames are generated offline by gen_dither.py into
 *  apps/app/assets/onboarding-dither. 36 frames (one seamless loop), ~144KB.
 *  Re-run: python3 apps/app/components/onboarding/gen_dither.py
 *  (drop a crisp animated source at .../onboarding/source.mp4 first). */

import { useEffect, useRef, useState } from 'react';

import { Dimensions, type ImageStyle } from 'react-native';
// Image is imported only to resolve bundled require() assets to URIs for Kit's
// <Image src> (which takes a uri string); not used as a render component.
// eslint-disable-next-line no-restricted-imports
import { Image as RNImage } from 'react-native';
import { Image } from '@metro-labs/kit/image';
import { Box } from '../layout';

/** All flipbook frames, bundled via require() so they decode locally (no network,
 *  no per-frame decode flicker). Resolved to asset URIs for Kit's <Image src>.
 *  NB: this require() list is exhaustive and explicit (one literal per frame) -
 *  do NOT collapse it into a spread/generated array; the dev-client preview ships
 *  plain unminified JS (CI exports with --no-minify --no-bytecode) which Hermes
 *  compiles on-device, and a malformed/truncated array literal here surfaces as a
 *  fatal "Compiling JS failed: ']' expected at end of array literal" on launch. */
const FRAME_URIS: string[] = [
  require('../../assets/onboarding-dither/f000.png'),
  require('../../assets/onboarding-dither/f001.png'),
  require('../../assets/onboarding-dither/f002.png'),
  require('../../assets/onboarding-dither/f003.png'),
  require('../../assets/onboarding-dither/f004.png'),
  require('../../assets/onboarding-dither/f005.png'),
  require('../../assets/onboarding-dither/f006.png'),
  require('../../assets/onboarding-dither/f007.png'),
  require('../../assets/onboarding-dither/f008.png'),
  require('../../assets/onboarding-dither/f009.png'),
  require('../../assets/onboarding-dither/f010.png'),
  require('../../assets/onboarding-dither/f011.png'),
  require('../../assets/onboarding-dither/f012.png'),
  require('../../assets/onboarding-dither/f013.png'),
  require('../../assets/onboarding-dither/f014.png'),
  require('../../assets/onboarding-dither/f015.png'),
  require('../../assets/onboarding-dither/f016.png'),
  require('../../assets/onboarding-dither/f017.png'),
  require('../../assets/onboarding-dither/f018.png'),
  require('../../assets/onboarding-dither/f019.png'),
  require('../../assets/onboarding-dither/f020.png'),
  require('../../assets/onboarding-dither/f021.png'),
  require('../../assets/onboarding-dither/f022.png'),
  require('../../assets/onboarding-dither/f023.png'),
  require('../../assets/onboarding-dither/f024.png'),
  require('../../assets/onboarding-dither/f025.png'),
  require('../../assets/onboarding-dither/f026.png'),
  require('../../assets/onboarding-dither/f027.png'),
  require('../../assets/onboarding-dither/f028.png'),
  require('../../assets/onboarding-dither/f029.png'),
  require('../../assets/onboarding-dither/f030.png'),
  require('../../assets/onboarding-dither/f031.png'),
  require('../../assets/onboarding-dither/f032.png'),
  require('../../assets/onboarding-dither/f033.png'),
  require('../../assets/onboarding-dither/f034.png'),
  require('../../assets/onboarding-dither/f035.png'),
].map((mod) => RNImage.resolveAssetSource(mod as number).uri);

/** Playback rate. The portrait pans one full L->R cycle over the 36 frames;
 *  ~12fps gives a calm ~3s traversal and is cheap on JS. */
const FPS = 12;
const FRAME_MS = 1000 / FPS;

/** Full-screen pixel dimensions for every frame.
 *
 *  CRITICAL (the "blank background" fix): each frame is handed to RN's <Image>
 *  as `source={{ uri }}` (a resolved-asset URI string), NOT as the raw
 *  `require()` module. A `{uri}` source has NO intrinsic size, so an
 *  absolutely-positioned Image relying only on `top/left/right/bottom:0` can be
 *  measured as 0x0 in an OTA/standalone bundle (where the URI is not the dev
 *  localhost asset that carries width/height) - the frame then never paints and
 *  the whole background reads as blank. Pinning concrete screen px (with
 *  `resizeMode:'cover'`) makes the layout deterministic, so the rectangular
 *  frames always fill the screen regardless of their 704x1264 aspect. */
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/** Absolute-fill (anchored top-left) + explicit screen size, typed for Kit
 *  Image (ImageStyle, not the View-typed StyleSheet.absoluteFill). */
const FILL: ImageStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: SCREEN_W,
  height: SCREEN_H,
};

export interface AnimatedBackgroundProps {
  /** 0..1 overall opacity so onboarding content stays readable on top. */
  opacity?: number;
}

/** Full-bleed looping dithered-portrait background. All frames are mounted once
 *  and stacked; we only flip which one is opaque each tick (no source swapping,
 *  no remount) so playback is flicker-free. */
export function AnimatedBackground({ opacity = 0.5 }: AnimatedBackgroundProps): React.ReactElement {
  const [frame, setFrame] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);

  useEffect(() => {
    const tick = (now: number): void => {
      if (now - lastRef.current >= FRAME_MS) {
        lastRef.current = now;
        setFrame((f) => (f + 1) % FRAME_URIS.length);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <Box pointerEvents="none" background="#000000"
      style={{ position: 'absolute', top: 0, left: 0, width: SCREEN_W, height: SCREEN_H, opacity }}
    >
      {FRAME_URIS.map((uri, i) => (
        <Image key={uri} src={uri} fit="cover" style={{ ...FILL, opacity: i === frame ? 1 : 0 }}/>
      ))}
    </Box>
  );
}
