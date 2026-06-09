/** Components sub-page of Settings - back-arrow header + theme switcher, then the
 *  app-level components rendered directly (ComponentsSections) with sample data.
 *  Reached via /settings -> "Components" row. Mirrors KitPage's structure but
 *  showcases the APP-level components instead of the @metro-labs/kit primitives. */

import { Scroll as ScrollView } from '@metro-labs/kit/scroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Col } from '../layout';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { SystemHeader } from './SystemHeader';
import { ThemeSwitcher } from './ThemeSwitcher';
import { ComponentsSections } from './ComponentsSections';

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
