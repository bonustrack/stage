import { useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Text } from '@stage-labs/kit/react-native/text';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { Frame, type FrameAction, type FrameActionSource } from '@stage-labs/kit/react-native/frame';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import { StackHeader } from '../chrome/StackHeader';
import { EmptyState } from '../chrome/EmptyState';
import { Box, Col, PAGE_GUTTER, ScreenScroll } from '../layout';
import { lineOfConv, useConvConsentState, useXmtpFeed, xmtpSendFrameAction } from '../../modules/messaging';
import { useEffectiveColorScheme } from '../../lib/theme';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { capabilities } from '../../lib/capabilities';
import { openInBubbleLink } from '../../lib/safeOpenLink';
import { report } from '../../lib/errorPolicy';
import { frameActionContent, frameCardModel, frameOf } from './frame.model';

const FRAME_MAX_WIDTH = 720;

function FrameBody({ frame, convId, line, messageId, onSent }: {
  frame: FrameContent; convId: string; line: string; messageId: string; onSent: () => void;
}): React.ReactElement {
  const consent = useConvConsentState(convId);
  const dark = useEffectiveColorScheme() === 'dark';
  const gated = consent !== 'allowed';
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
    <Col gap={12}>
      <Frame widget={frame.widget} dark={dark} disabled={gated} onAction={onAction}
        onOpenUrl={(url) => { openInBubbleLink(url); }} />
      {consent === 'unknown' || consent === 'denied' ? (
        <Text size="sm" role="secondary">Accept this conversation to use this frame.</Text>
      ) : null}
    </Col>
  );
}

export function FrameScreen({ convId, messageId }: { convId: string; messageId: string }): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const line = lineOfConv(convId);
  const feed = useXmtpFeed(line, true);
  const frame = useMemo(() => frameOf(feed.events.find((e) => e.id === messageId)), [feed.events, messageId]);
  const title = useMemo(() => (frame === null ? 'Frame' : frameCardModel(frame).title), [frame]);
  const chat = `/channel/${convId}`;
  const canGoBack = router.canGoBack();
  const leave = useCallback(() => {
    if (canGoBack) router.back();
    else router.replace(chat);
  }, [router, canGoBack, chat]);
  return (
    <Col surface="surface" flex={1}>
      <StackHeader title={title} backTo={canGoBack ? undefined : chat} />
      <ScreenScroll
        contentContainerStyle={{ padding: PAGE_GUTTER, paddingBottom: PAGE_GUTTER + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <Col align="center">
        <Box width="100%" maxWidth={FRAME_MAX_WIDTH}>
          {frame !== null ? (
            <FrameBody frame={frame} convId={convId} line={line} messageId={messageId} onSent={leave} />
          ) : feed.status === 'loading' ? (
            <Box padding={24} align="center"><Spinner /></Box>
          ) : (
            <EmptyState title="This frame is not available." />
          )}
        </Box>
        </Col>
      </ScreenScroll>
    </Col>
  );
}
