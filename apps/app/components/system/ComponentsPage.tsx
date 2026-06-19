/**
 * @file Components sub-page of Settings: a header plus theme switcher above the
 *  app-level components (ComponentsSections) rendered with sample data, mirroring
 *  KitPage but showcasing app components rather than kit primitives.
 */

import { Scroll as ScrollView } from '@metro-labs/kit/scroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Col } from '../layout';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { SystemHeader } from './SystemHeader';
import { ThemeSwitcher } from './ThemeSwitcher';
import { ComponentsSections } from './ComponentsSections';

/** Renders the Components gallery page of the system design section. */
export function ComponentsPage(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, border } = usePalette();
  const sub = fg;
  const rowBg = border;
  const insets = useSafeAreaInsets();

  return (
    <Col surface="surface" flex={1}>
      <SystemHeader title="Components" dark={dark} fg={fg} head={head} border={border}/>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 + insets.bottom }}
>
        <ThemeSwitcher dark={dark} head={head} sub={sub} border={border} rowBg={rowBg}/>
        <ComponentsSections dark={dark} head={head} sub={sub} border={border} rowBg={rowBg}/>
      </ScrollView>
    </Col>
  );
}
