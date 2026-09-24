import { Text } from '@stage-labs/kit/react-native/text';
import { Box, Row, pinnedEdges, PAGE_GUTTER } from '../layout';
import { MENU_SHADOW } from '../menuStyle';
import { usePalette } from '../../lib/theme';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { useToastRequest } from '../../lib/toastHost';
import { DROPDOWN_MENU } from '@stage-labs/kit/react-native/dropdown-menu';

const TOAST_LAYER = 70;
const TOAST_BOTTOM_GAP = 96;

export function ToastHost(): React.ReactElement | null {
  const toast = useToastRequest();
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  if (toast === null) return null;
  return (
    <Row
      justify="center"
      padding={{ x: PAGE_GUTTER }}
      pointerEvents="none"
      style={pinnedEdges({ bottom: insets.bottom + TOAST_BOTTOM_GAP, left: 0, right: 0 }, TOAST_LAYER)}
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
