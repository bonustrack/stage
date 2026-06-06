/** Components sub-page of Settings — back-arrow header + the ComponentsGallery
 *  body. Reached via /settings → "Components" row → /settings/components.
 *  Mirrors KitPage's structure (SystemHeader + ScrollView + gallery), but
 *  showcases the APP-level components instead of the @metro-labs/kit primitives. */

import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box } from '../layout';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { SystemHeader } from './SystemHeader';
import { ComponentsGallery } from './ComponentsGallery';

export function ComponentsPage(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, bg, border } = usePalette();
  const sub = fg;
  const rowBg = border;
  const insets = useSafeAreaInsets();

  return (
    <Box style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      <SystemHeader title="Components" dark={dark} fg={fg} head={head} border={border} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
      >
        <ComponentsGallery dark={dark} head={head} sub={sub} border={border} rowBg={rowBg} />
      </ScrollView>
    </Box>
  );
}
