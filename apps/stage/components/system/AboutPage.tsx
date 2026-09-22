
import { useSafeAreaInsets } from '../../lib/safeArea';
import { Col, ScreenScroll } from '../layout';
import { usePalette } from '../../lib/theme';
import { SettingsHeader } from '../chrome/SettingsHeader';
import { AboutPanel } from './AboutPanel';

export function AboutPage(): React.ReactElement {
  const { text: fg, link: head, border } = usePalette();
  const insets = useSafeAreaInsets();

  return (
    <Col surface="surface" flex={1}>
      <SettingsHeader title="About"/>
      <ScreenScroll contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <AboutPanel head={head} sub={fg} border={border}/>
      </ScreenScroll>
    </Col>
  );
}
