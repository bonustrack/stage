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
  const gated = consent === 'unknown' || consent === 'denied';
  const onAction = useCallback(async (action: FrameAction, source: FrameActionSource): Promise<void> => {
    try {
      await xmtpSendFrameAction(line, frameActionContent(messageId, action, source.label));
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
      {gated ? <Text size="sm" role="secondary">Accept this conversation to use this frame.</Text> : null}
    </Col>
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
  return (
    <Col surface="surface" flex={1}>
      <StackHeader title={frame === null ? 'Frame' : frameCardModel(frame).title} backTo={canGoBack ? undefined : chat} />
      <ScreenScroll
        contentContainerStyle={{ padding: PAGE_GUTTER, paddingBottom: PAGE_GUTTER + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <Box style={{ width: '100%', maxWidth: FRAME_MAX_WIDTH, alignSelf: 'center' }}>
          {frame !== null ? (
            <FrameBody frame={frame} convId={convId} line={line} messageId={messageId} onSent={leave} />
          ) : feed.status === 'loading' ? (
            <Box padding={24} align="center"><Spinner /></Box>
          ) : (
            <EmptyState title="This frame is not available." />
          )}
        </Box>
      </ScreenScroll>
    </Col>
  );
}
