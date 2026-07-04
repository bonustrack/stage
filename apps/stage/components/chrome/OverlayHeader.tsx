
import type { ReactNode } from 'react';
import { GesturePressable } from '@stage-labs/kit/react-native/gesture-pressable';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { resolveColorToken } from '@stage-labs/kit/tokens';
import { Box, Row } from '../layout';

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
      style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 }}
    >
      <GesturePressable onPress={onBack} hitSlop={10}>
        <Box padding={6}>
          <Icon
            name="arrowLeft"
            size={22}
            color={resolveColorToken(backColor, scheme)}
            dark={scheme === 'dark'}
          />
        </Box>
      </GesturePressable>
      {trailing}
    </Row>
  );
}
