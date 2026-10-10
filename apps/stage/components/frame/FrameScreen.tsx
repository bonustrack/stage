import { useCallback, useMemo, useRef, useState, type RefObject } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { Text } from '@stage-labs/kit/react-native/text';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { Frame, type FrameActionHandler, type FrameNavigation } from '@stage-labs/kit/react-native/frame';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import { StackHeader } from '../chrome/StackHeader';
import { EmptyState } from '../chrome/EmptyState';
import { Box, Col, PAGE_GUTTER, ScreenScroll } from '../layout';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { useConvConsentState } from '../../modules/messaging/useConvConsent';
import { useXmtpFeed } from '../../lib/xmtp.feed';
import { useFrameMessage } from '../../lib/frameMessage';
import { useEffectiveColorScheme } from '../../lib/theme';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { openInBubbleLink } from '../../lib/safeOpenLink';
import { frameInputOf, frameOf, frameScreenTitle } from './frame.model';
import { useFrameStack, useTopOnScreenChange } from './frameStack';
import { useChatFrame } from './useFrameAction';
import { Platform, useWindowDimensions, BackHandler, View } from 'react-native';
import { documentScroll } from '../../lib/webLayout';
import { parseFrameDoc, type FrameNav } from '@stage-labs/kit/frame';
import type { ScreenScrollHandle } from '../layout/ScreenScroll.types';

function useFillViewport(): { ref: RefObject<View | null>; onLayout: () => void; minHeight?: number } {
  const ref = useRef<View>(null);
  const { height } = useWindowDimensions();
  const [top, setTop] = useState<number | null>(null);
  const onLayout = useCallback(() => {
    if (Platform.OS !== 'web') return;
    ref.current?.measureInWindow((_x, y) => { setTop(y + documentScroll().y); });
  }, []);
  return { ref, onLayout, minHeight: top === null ? undefined : Math.max(0, height - top) };
}

interface FrameScreens {
  title: string;
  navigation: FrameNavigation;
  onBack?: () => void;
  scrollRef: RefObject<ScreenScrollHandle | null>;
}

function useFrameScreens(frame: FrameContent | null, messageId: string, leave: () => void): FrameScreens {
  const parsed = useMemo(() => parseFrameDoc(frame === null ? undefined : frameInputOf(frame)), [frame]);
  const nav = useFrameStack(messageId, parsed.ok ? parsed.doc.start : '');
  const { screen, depth, navigate: step } = nav;
  const back = useCallback((): boolean => {
    if (depth === 0) return false;
    step({ kind: 'back' });
    return true;
  }, [depth, step]);
  const navigate = useCallback((next: FrameNav): void => {
    if (next.kind === 'back' && depth === 0) leave();
    else step(next);
  }, [depth, step, leave]);
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', back);
    return () => { sub.remove(); };
  }, [back]));
  const scrollRef = useRef<ScreenScrollHandle>(null);
  useTopOnScreenChange(screen, () => { scrollRef.current?.scrollToOffset({ offset: 0, animated: false }); });
  const title = useMemo(() => (frame === null ? 'Frame' : frameScreenTitle(frame, parsed, screen)), [frame, parsed, screen]);
  return {
    title,
    navigation: { screen, depth, navigate },
    onBack: depth > 0 ? () => { back(); } : undefined,
    scrollRef,
  };
}

const FILL_STYLE = { flexGrow: 1 } as const;

function FrameBody({ frame, convId, onAction, insetBottom, navigation }: {
  frame: FrameContent; convId: string; onAction: FrameActionHandler; insetBottom: number; navigation: FrameNavigation;
}): React.ReactElement {
  const consent = useConvConsentState(convId);
  const dark = useEffectiveColorScheme() === 'dark';
  const gated = consent !== 'allowed';
  const notice = consent === 'unknown' || consent === 'denied';
  const viewport = useFillViewport();
  const widget = useMemo(() => frameInputOf(frame), [frame]);
  return (
    <View ref={viewport.ref} onLayout={viewport.onLayout} style={{ flexGrow: 1, minHeight: viewport.minHeight }}>
      <Frame widget={widget} dark={dark} disabled={gated} onAction={onAction} navigation={navigation}
        fill={{ padding: PAGE_GUTTER, insetBottom: notice ? 0 : insetBottom }}
        onOpenUrl={(url) => { openInBubbleLink(url); }} />
      {notice ? (
        <Box padding={{ top: 12, x: PAGE_GUTTER, bottom: PAGE_GUTTER + insetBottom }}>
          <Text size="2xs" role="secondary">Accept this conversation to use this frame.</Text>
        </Box>
      ) : null}
    </View>
  );
}

export function FrameScreen({ convId, messageId }: { convId: string; messageId: string }): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const line = lineOfConv(convId);
  const feed = useXmtpFeed(line, true);
  const fromFeed = useMemo(() => frameOf(feed.events.find((e) => e.id === messageId)), [feed.events, messageId]);
  const lookup = fromFeed === null && feed.status !== 'loading';
  const stored = useFrameMessage(convId, messageId, lookup);
  const sent = fromFeed ?? (stored?.state === 'ready' ? stored.frame : null);
  const chat = `/channel/${convId}`;
  const canGoBack = router.canGoBack();
  const leave = useCallback(() => {
    if (canGoBack) router.back();
    else router.replace(chat);
  }, [router, canGoBack, chat]);
  const { frame, onAction } = useChatFrame(sent, line, messageId, leave);
  const screens = useFrameScreens(frame, messageId, leave);
  return (
    <Col surface="surface" flex={1}>
      <StackHeader title={screens.title} backTo={canGoBack ? undefined : chat} onBack={screens.onBack} />
      <ScreenScroll ref={screens.scrollRef} contentContainerStyle={FILL_STYLE} keyboardShouldPersistTaps="handled">
        {frame !== null ? (
          <FrameBody frame={frame} convId={convId} onAction={onAction} insetBottom={insets.bottom} navigation={screens.navigation} />
        ) : (
          <Box padding={PAGE_GUTTER}>
            {feed.status === 'loading' || (lookup && stored === undefined) ? <Box padding={24} align="center"><Spinner /></Box> : (
              <EmptyState title="This frame is not available." />
            )}
          </Box>
        )}
      </ScreenScroll>
    </Col>
  );
}
