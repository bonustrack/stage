import type { ReactNode } from 'react';
import { Row, pinnedTop, PAGE_GUTTER } from '../layout';
import { RoundIconButton } from '../RoundIconButton';
import { IconArrowLeft } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowLeft';

export function OverlayHeader({ onBack, background, safeTop, trailing }: {
  onBack: () => void;
  background: string;
  safeTop: number;
  trailing?: ReactNode;
}): React.ReactElement {
  return (
      <Row
        align="center"
        justify="between"
        padding={{ x: PAGE_GUTTER, top: safeTop + PAGE_GUTTER }}
        style={pinnedTop(2)}
      >
        <RoundIconButton icon={IconArrowLeft} label="Back" background={background} onPress={onBack} />
        {trailing}
      </Row>
  );
}
