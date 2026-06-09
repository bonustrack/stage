/** About sub-page of the System menu — back-arrow header + the AboutPanel body.
 *  Reached via /system → "About" row → /system/about. */

import { Scroll as ScrollView } from '@metro-labs/kit/scroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Col } from '../layout';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { SystemHeader } from './SystemHeader';
import { AboutPanel } from './AboutPanel';

export function AboutPage(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, bg, border } = usePalette();
  const sub = fg;
  const rowBg = border;
  const insets = useSafeAreaInsets();

  return (
    <Col flex={1} style={{ backgroundColor: bg }}>
      <SystemHeader title="About" dark={dark} fg={fg} head={head} border={border} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <AboutPanel dark={dark} head={head} sub={sub} border={border} rowBg={rowBg} />
      </ScrollView>
    </Col>
  );
}
