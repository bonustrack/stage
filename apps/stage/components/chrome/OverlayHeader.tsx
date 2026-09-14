
import type { ReactNode } from 'react';
import { GesturePressable } from '@stage-labs/kit/react-native/gesture-pressable';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { resolveColorToken } from '@stage-labs/kit/tokens';
import { Box, Row, pinnedTop } from '../layout';

export function OverlayHeader({ onBack, backColor, safeTop, trailing }: {
  onBack: () => void;
  backColor: string;
  safeTop: number;
  trailing?: ReactNode;
}): React.ReactElement {
  const scheme = useKitScheme();
  return (
      <Row
        align="center"
        justify="between"
        height={44 + safeTop}
        padding={{ x: 14, top: safeTop }}
        style={pinnedTop(2)}
      >
        <GesturePressable onPress={onBack} hitSlop={10}>
          <Box padding={6}>
            <Icon
              name="arrowLeft"
              size={24}
              color={resolveColorToken(backColor, scheme)}
              dark={scheme === 'dark'}
            />
          </Box>
        </GesturePressable>
        {trailing}
      </Row>
  );
}
