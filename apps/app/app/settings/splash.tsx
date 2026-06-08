/** Settings → Experimental → Splash screen route - a full-screen on-demand
 *  preview of the animated kaleidoscope launch splash, so the animation can be
 *  replayed any time without relaunching the app. Reached via /settings →
 *  Experimental → "Splash screen" row. The kaleidoscope loops continuously on
 *  its own (no splash-hide handoff here); dismiss via the header back arrow or
 *  the app's swipe-back gesture. */

import { Box } from '../../components/layout';
import { SystemHeader } from '../../components/system/SystemHeader';
import { KaleidoscopeSplash } from '../../components/KaleidoscopeSplash';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';

export default function SettingsSplashRoute(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, bg, border } = usePalette();
  return (
    <Box style={{ flex: 1, backgroundColor: bg }}>
      <SystemHeader title="Splash screen" dark={dark} fg={fg} head={head} border={border} />
      <Box style={{ flex: 1 }}>
        <KaleidoscopeSplash bg={bg} />
      </Box>
    </Box>
  );
}
