import { useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Text } from '@stage-labs/kit/react-native/text';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { Frame, type FrameAction, type FrameActionSource, type FrameNavigation } from '@stage-labs/kit/react-native/frame';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import { StackHeader } from '../chrome/StackHeader';
import { EmptyState } from '../chrome/EmptyState';
import { Box, Col, PAGE_GUTTER, ScreenScroll } from '../layout';
import { View } from '../layout/native';
import { lineOfConv, useConvConsentState, useXmtpFeed, xmtpSendFrameAction } from '../../modules/messaging';
import { useEffectiveColorScheme } from '../../lib/theme';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { capabilities } from '../../lib/capabilities';
import { openInBubbleLink } from '../../lib/safeOpenLink';
import { report } from '../../lib/errorPolicy';
import { frameActionContent, frameInputOf, frameOf } from './frame.model';
import { useFillViewport } from './useFillViewport';
import { useFrameScreens } from './useFrameScreens';

const FILL_STYLE = { flexGrow: 1 } as const;

function FrameBody({ frame, convId, line, messageId, onSent, insetBottom, navigation }: {
  frame: FrameContent; convId: string; line: string; messageId: string; onSent: () => void; insetBottom: number;
  navigation: FrameNavigation;
}): React.ReactElement {
  const consent = useConvConsentState(convId);
  const dark = useEffectiveColorScheme() === 'dark';
  const gated = consent !== 'allowed';
  const notice = consent === 'unknown' || consent === 'denied';
  const viewport = useFillViewport();
  const widget = useMemo(() => frameInputOf(frame), [frame]);
  const onAction = useCallback(async (action: FrameAction, source: FrameActionSource): Promise<void> => {
    const content = frameActionContent(messageId, action, source.label);
    if (content === null) {
      capabilities.toast('This answer is too long to send.');
      return;
    }
    try {
      await xmtpSendFrameAction(line, content);
      onSent();
    } catch (err) {
      report('frame.action', err);
      capabilities.toast('Could not send. Try again.');
    }
  }, [line, messageId, onSent]);
  return (
    <View ref={viewport.ref} onLayout={viewport.onLayout} style={{ flexGrow: 1, minHeight: viewport.minHeight }}>
      <Frame widget={widget} dark={dark} disabled={gated} onAction={onAction} navigation={navigation}
        fill={{ padding: PAGE_GUTTER, insetBottom: notice ? 0 : insetBottom }}
        onOpenUrl={(url) => { openInBubbleLink(url); }} />
      {notice ? (
        <Box padding={{ top: 12, x: PAGE_GUTTER, bottom: PAGE_GUTTER + insetBottom }}>
          <Text size="3xs" role="secondary">Accept this conversation to use this frame.</Text>
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
  const frame = useMemo(() => frameOf(feed.events.find((e) => e.id === messageId)), [feed.events, messageId]);
  const chat = `/channel/${convId}`;
  const canGoBack = router.canGoBack();
  const leave = useCallback(() => {
    if (canGoBack) router.back();
    else router.replace(chat);
  }, [router, canGoBack, chat]);
  const screens = useFrameScreens(frame, leave);
  return (
    <Col surface="surface" flex={1}>
      <StackHeader title={screens.title} backTo={canGoBack ? undefined : chat} onBack={screens.onBack} />
      <ScreenScroll ref={screens.scrollRef} contentContainerStyle={FILL_STYLE} keyboardShouldPersistTaps="handled">
        {frame !== null ? (
          <FrameBody frame={frame} convId={convId} line={line} messageId={messageId} onSent={leave}
            insetBottom={insets.bottom} navigation={screens.navigation} />
        ) : (
          <Box padding={PAGE_GUTTER}>
            {feed.status === 'loading' ? <Box padding={24} align="center"><Spinner /></Box> : (
              <EmptyState title="This frame is not available." />
            )}
          </Box>
        )}
      </ScreenScroll>
    </Col>
  );
}
