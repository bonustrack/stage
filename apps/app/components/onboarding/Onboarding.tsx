/** First-launch ONBOARDING screen - minimal.
 *
 *  A single full-screen view shown exactly once on a clean install. The root
 *  layout (app/_layout.tsx) gates the whole app behind this: until the persisted
 *  `onboarding.seen` flag is true the user sees this instead of the app, and
 *  tapping "Get started" flips the flag and lets them in.
 *
 *  All previous carousel content (slides, illustrations, paging dots, Skip) was
 *  stripped. What remains is the full-bleed animated 1-bit dithered-portrait
 *  background (AnimatedBackground) and a single solid "Get started" button
 *  pinned bottom-center, safe-area aware, with enough contrast to read over the
 *  black-and-white dither.
 *
 *  Self-contained: it owns no navigation, just an `onDone` callback the layout
 *  wires to "set seen + enter app". The Experimental "Replay onboarding" row
 *  resets the flag so this shows again for testing. */

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@metro-labs/kit/button';
import { Col, Box } from '../layout';
import { useEffectiveColorScheme } from '../../lib/theme';
import { AnimatedBackground } from './AnimatedBackground';

export interface OnboardingProps {
  /** Called when the user taps "Get started". The layout flips the persisted
   *  seen flag and lets the user into the app. */
  onDone: () => void;
}

export function Onboarding({ onDone }: OnboardingProps): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const insets = useSafeAreaInsets();

  return (
    <Col surface="surface" flex={1}>
      {/* Full-bleed animated dithered-portrait background (from #423). */}
      <AnimatedBackground opacity={1}/>

      {/* Single solid CTA, pinned bottom-center, readable over the B&W dither. */}
      <Box style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
        padding={{ x: 24, bottom: 16 + insets.bottom }}
      >
        <Button
          dark={dark}
          variant="primary"
          size="lg"
          fullWidth
          tintBg="#ffffff"
          tintFg="#000000"
          label="Get started"
          onPress={onDone}
        />
      </Box>
    </Col>
  );
}
