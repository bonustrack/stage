import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { Box, RIGHT_PANE_INSET, pinnedBottom } from '../layout';
import { useReportBottomChrome } from '../../lib/bottomChrome';
import { useSafeAreaInsets } from '../../lib/safeArea';

export function ChatColumn({ style, children }: {
  style?: StyleProp<ViewStyle>; children?: React.ReactNode;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { height: keyboard } = useReanimatedKeyboardAnimation();
  const lift = useAnimatedStyle(() => ({ marginBottom: Math.max(0, -keyboard.value - insets.bottom) }));
  return <Reanimated.View style={[{ flex: 1 }, style, lift]}>{children}</Reanimated.View>;
}

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
