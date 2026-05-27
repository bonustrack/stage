/** Top-fade or bottom-fade gradient strip.
 *
 *  Implemented as a stack of thin solid slices with stepped opacity rather than a
 *  react-native-svg `LinearGradient`. On Android, react-native-svg gradients render
 *  unreliably here: alpha baked into `stopColor` (rgba) gets dropped — the fade
 *  collapses to a solid same-colour bar (invisible over a matching background) —
 *  and percentage `Rect` dims inside an auto-sized absolute container can compute
 *  to 0, so nothing draws at all. Stepped `View`s are plain RN core: they always
 *  render and give a clean linear 0→100% opacity ramp on every device. */

import { View } from 'react-native';

interface Props {
  bg: string;
  /** 'down' (default): transparent at top → solid at bottom (sits above composer).
   *  'up':              solid at top → transparent at bottom (sits below status bar). */
  direction?: 'up' | 'down';
  height?: number;
  /** Absolute positioning offsets relative to the wrapping View. */
  top?: number;
  bottom?: number;
}

/** Slice count across the strip — 12 over a 24px strip (2px each) reads as smooth. */
const SLICES = 12;

export function ComposerGradient({ bg, direction = 'down', height = 24, top, bottom }: Props): React.ReactElement {
  const sliceH = height / SLICES;
  return (
    <View pointerEvents="none" style={{
      position: 'absolute', left: 0, right: 0, height,
      ...(top !== undefined ? { top } : {}),
      ...(bottom !== undefined ? { bottom } : {}),
    }}>
      {Array.from({ length: SLICES }, (_, i) => {
        /** Slice midpoint as a 0→1 fraction, top→bottom. 'down' ramps opacity up
         *  (transparent top → solid bottom); 'up' ramps it down. */
        const t = (i + 0.5) / SLICES;
        const opacity = direction === 'down' ? t : 1 - t;
        return <View key={i} style={{ height: sliceH, backgroundColor: bg, opacity }} />;
      })}
    </View>
  );
}
