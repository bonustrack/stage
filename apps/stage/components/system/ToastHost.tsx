import { Text } from '@stage-labs/kit/react-native/text';
import { Box, Row, pinnedBottom, PAGE_GUTTER } from '../layout';
import { OVERLAY_SHADOW } from '@stage-labs/kit/overlay.styles';
import { usePalette } from '../../lib/theme';
import { useToastRequest } from '../../lib/toastHost';
import { useFloatingBottom } from '../layout/floatingBottom';
import { DROPDOWN_MENU } from '@stage-labs/kit/react-native/menu';

const TOAST_LAYER = 70;

export function ToastHost(): React.ReactElement | null {
  const toast = useToastRequest();
  const pal = usePalette();
  const bottom = useFloatingBottom();
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
        style={{ maxWidth: 420, ...OVERLAY_SHADOW }}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <Text size="sm" color={pal.bg}>{toast.message}</Text>
      </Box>
    </Row>
  );
}
