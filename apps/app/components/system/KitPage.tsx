/** Kit sub-page of the System menu — back-arrow header + the KitGallery body.
 *  Reached via /system → "Kit" row → /system/kit. */

import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box } from '../layout';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { SystemHeader } from './SystemHeader';
import { KitGallery } from './KitGallery';
import { KitGitHubLink } from './KitGitHubLink';

export function KitPage(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { fg, head, sub, bg, border, rowBg } = usePalette();
  const insets = useSafeAreaInsets();

  return (
    <Box style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      <SystemHeader title="Kit" dark={dark} fg={fg} head={head} border={border} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
      >
        <KitGitHubLink dark={dark} head={head} sub={sub} border={border} rowBg={rowBg} />
        <KitGallery dark={dark} head={head} sub={sub} border={border} rowBg={rowBg} />
      </ScrollView>
    </Box>
  );
}
