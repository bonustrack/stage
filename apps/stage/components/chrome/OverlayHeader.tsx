
import type { ReactNode } from 'react';
import { Row, pinnedTop, PAGE_GUTTER } from '../layout';
import { BackButton } from './ScreenHeader';

export function OverlayHeader({ onBack, backColor, safeTop, trailing }: {
  onBack: () => void;
  backColor: string;
  safeTop: number;
  trailing?: ReactNode;
}): React.ReactElement {
  return (
      <Row
        align="center"
        justify="between"
        height={44 + safeTop}
        padding={{ x: PAGE_GUTTER, top: safeTop }}
        style={pinnedTop(2)}
      >
        <BackButton onBack={onBack} backColor={backColor} hitSlop={10} padding={6} />
        {trailing}
      </Row>
  );
}
