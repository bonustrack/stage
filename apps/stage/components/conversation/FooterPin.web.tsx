import { Column, RIGHT_PANE_INSET, pinnedBottom } from '../layout';
import type { FooterPinProps } from './FooterPin';

export function FooterPin({ children, onHeight, memberList }: FooterPinProps): React.ReactElement {
  return (
    <Column
      style={[pinnedBottom(2), memberList ? RIGHT_PANE_INSET : null]}
      onLayout={(e) => {
        onHeight(e.nativeEvent.layout.height);
      }}
    >
      {children}
    </Column>
  );
}
