import { Platform } from 'react-native';
import { Box, RIGHT_PANE_INSET, pinnedBottom } from '../layout';
import { useReportBottomChrome } from '../../lib/bottomChrome';

export function FooterDock({ children, height, onHeight, memberList }: {
  children: React.ReactNode; height: number; onHeight: (h: number) => void; memberList: boolean;
}): React.ReactElement {
  useReportBottomChrome(height);
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <Box style={[pinnedBottom(2), memberList ? RIGHT_PANE_INSET : null]} onLayout={(e) => { onHeight(e.nativeEvent.layout.height); }}>
      {children}
    </Box>
  );
}
