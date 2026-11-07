import { useCallback, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';
import { KeyboardStickyView, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useReportBottomChrome } from '../layout/bottomChrome';
import { useSafeAreaInsets } from '../layout/safeArea';
import { useMemberListOpen } from '../../lib/memberList';
import { useEffectiveColorScheme } from '../../lib/theme';
import { useWebTabRail } from '../layout/webLayout';
import { TOPNAV_HEIGHT } from '../Topnav';
import { Column, PANE_LEFT_PAD, RIGHT_PANE_PAD, viewportFill } from '../layout';
import { FooterPin } from './FooterPin';

export function useConversationSidebarShown(): boolean {
  const open = useMemberListOpen();
  const wide = useWebTabRail();
  return wide && open;
}

export function useChatColumnFill(bottomInset: number): StyleProp<ViewStyle> {
  const top = useSafeAreaInsets().top + TOPNAV_HEIGHT;
  const shown = useConversationSidebarShown();
  return [viewportFill(), PANE_LEFT_PAD, shown ? RIGHT_PANE_PAD : null, { paddingTop: top, paddingBottom: bottomInset }];
}

export function ChatColumnSpinner({ bottomInset }: { bottomInset: number }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  return (
    <Column surface="surface" weight={1} align="center" justify="center" style={useChatColumnFill(bottomInset)}>
      <Spinner size={24} color={dark ? '#ffffff' : '#000000'} />
    </Column>
  );
}

let measuredFooterHeight = 0;

interface FooterHeight {
  height: number;
  onHeight: (height: number) => void;
}

export function useFooterHeight(): FooterHeight {
  const [height, setHeight] = useState(measuredFooterHeight);
  const onHeight = useCallback((measured: number) => {
    measuredFooterHeight = measured;
    setHeight(measured);
  }, []);
  return { height, onHeight };
}

export function ChatColumn({ style, children }: { style?: StyleProp<ViewStyle>; children?: React.ReactNode }): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { height: keyboard } = useReanimatedKeyboardAnimation();
  const lift = useAnimatedStyle(() => ({ marginBottom: Math.max(0, -keyboard.value - insets.bottom) }));
  return <Reanimated.View style={[{ flex: 1 }, style, lift]}>{children}</Reanimated.View>;
}

export function ComposerDock({ children }: { children: React.ReactNode }): React.ReactElement {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardStickyView offset={{ opened: insets.bottom }}>
      <Column>
        {children}
        <Column height={insets.bottom} surface="raised" />
      </Column>
    </KeyboardStickyView>
  );
}

export function FooterDock({
  children,
  height,
  onHeight,
  memberList,
}: {
  children: React.ReactNode;
  height: number;
  onHeight: (h: number) => void;
  memberList: boolean;
}): React.ReactElement {
  useReportBottomChrome(height);
  return (
    <FooterPin onHeight={onHeight} memberList={memberList}>
      {children}
    </FooterPin>
  );
}
