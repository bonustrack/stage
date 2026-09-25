import { Platform } from 'react-native';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box, Row, pinnedBottom, PAGE_GUTTER } from '../layout';
import { MENU_SHADOW } from '../menuStyle';
import { usePalette } from '../../lib/theme';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { useToastRequest } from '../../lib/toastHost';
import { useBottomChromeHeight } from '../../lib/bottomChrome';
import { DROPDOWN_MENU } from '@stage-labs/kit/react-native/dropdown-menu';

const TOAST_LAYER = 70;
const NATIVE_BOTTOM_GAP = 96;

function useToastBottom(): number {
  const insets = useSafeAreaInsets();
  const chrome = useBottomChromeHeight();
  return Platform.OS === 'web' ? Math.max(insets.bottom, chrome) + PAGE_GUTTER : insets.bottom + NATIVE_BOTTOM_GAP;
}

export function ToastHost(): React.ReactElement | null {
  const toast = useToastRequest();
  const pal = usePalette();
  const bottom = useToastBottom();
  if (toast === null) return null;
  return (
    <Row
      justify="center"
      padding={{ x: PAGE_GUTTER }}
      pointerEvents="none"
      style={[pinnedBottom(TOAST_LAYER), { bottom }]}
    >
      <Box
        key={toast.id}
        background={pal.link}
        radius={DROPDOWN_MENU.radius}
        padding={{ x: 16, y: 10 }}
        style={{ maxWidth: 420, ...MENU_SHADOW }}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <Text size="xl" color={pal.bg}>{toast.message}</Text>
      </Box>
    </Row>
  );
}
