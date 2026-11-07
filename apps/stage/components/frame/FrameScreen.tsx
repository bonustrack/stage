import { useCallback, useMemo, useRef } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { Text } from '@stage-labs/kit/react-native/text';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import { StackHeader } from '../chrome/StackHeader';
import { EmptyState } from '../chrome/EmptyState';
import { menuPointBelowEnd } from '../AnchoredMenu';
import { HoverIconButton } from '../hover';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { useConvConsentState } from '../../lib/messaging/useConvConsent';
import { useXmtpFeed } from '../../lib/feed/useXmtpFeed';
import { frameLocked, frameOf } from '../../lib/frames/frame.model';
import { useFrameMessage } from '../../lib/frames/frameMessage';
import type { FrameNav } from '../../lib/frames/frameStacks';
import { conversationLinkOf } from '../../lib/links';
import { usePalette } from '../../lib/theme';
import type { XmtpConsent } from '../../lib/xmtp.types';
import { useSafeAreaInsets } from '../layout/safeArea';
import { frameScreenTitle } from './frame.model';
import { FrameView, type FrameNavigation } from './FrameView';
import { ChatFrameMenu } from './FrameMenu';
import { useFrameStack, useTopOnScreenChange } from './frameStack';
import { useChatFrame, type ChatFrame } from './useFrameAction';
import { Platform, BackHandler, View } from 'react-native';
import { useFillViewport } from './fillViewport';
import type { ScreenScrollHandle } from '../layout/ScreenScroll.types';
import { IconDotGrid1x3Vertical } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconDotGrid1x3Vertical';
import { Column, PAGE_GUTTER, ScreenScroll } from '../layout';

function useFrameScreens(frame: FrameContent | null, stackKey: string, leave: () => void) {
  const { screen, depth, navigate: step } = useFrameStack(stackKey, frame);
  const back = useCallback((): boolean => {
    if (depth === 0) return false;
    step({ kind: 'close' });
    return true;
  }, [depth, step]);
  const navigate = useCallback(
    (next: FrameNav): void => {
      if (next.kind === 'close' && depth === 0) leave();
      else step(next);
    },
    [depth, step, leave],
  );
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', back);
      return () => {
        sub.remove();
      };
    }, [back]),
  );
  const scrollRef = useRef<ScreenScrollHandle>(null);
  useTopOnScreenChange(screen, () => {
    scrollRef.current?.scrollToOffset({ offset: 0, animated: false });
  });
  const title = useMemo(() => (frame === null ? 'Frame' : frameScreenTitle(frame, screen)), [frame, screen]);
  return {
    title,
    navigation: { screen, depth, navigate },
    onBack:
      depth > 0
        ? () => {
            back();
          }
        : undefined,
    scrollRef,
  };
}

const FILL_STYLE = { flexGrow: 1 } as const;

function FramePageMenu({
  frame,
  convId,
  messageId,
  locked,
  onRefresh,
}: {
  frame: FrameContent | null;
  convId: string;
  messageId: string;
  locked: boolean;
  onRefresh: () => void;
}): React.ReactElement | null {
  const { text } = usePalette();
  if (frame === null) return null;
  return (
    <ChatFrameMenu
      frame={frame}
      convId={convId}
      messageId={messageId}
      onRefresh={locked ? undefined : onRefresh}
      trigger={(open) => (
        <Column margin={{ left: 'auto' }}>
          <HoverIconButton
            icon={IconDotGrid1x3Vertical}
            label="More"
            color={text}
            placement="below"
            role="button"
            onPress={(e) => {
              open(menuPointBelowEnd(e));
            }}
          />
        </Column>
      )}
    />
  );
}

function FrameBody({
  chat,
  frame,
  consent,
  locked,
  insetBottom,
  navigation,
}: {
  chat: ChatFrame;
  frame: FrameContent;
  consent: XmtpConsent | null | undefined;
  locked: boolean;
  insetBottom: number;
  navigation: FrameNavigation;
}): React.ReactElement {
  const notice = consent === 'unknown' || consent === 'denied';
  const fill = useRef<View>(null);
  const viewport = useFillViewport(fill);
  return (
    <View ref={fill} onLayout={viewport.onLayout} style={{ flexGrow: 1, minHeight: viewport.minHeight }}>
      <FrameView
        frame={frame}
        sessionKey={chat.keys.session}
        disabled={locked}
        onMessage={chat.onMessage}
        untilTap={chat.node !== null}
        navigation={navigation}
        padding={{ x: PAGE_GUTTER, top: PAGE_GUTTER, bottom: PAGE_GUTTER + (notice ? 0 : insetBottom) }}
      />
      {notice ? (
        <Column padding={{ top: 12, x: PAGE_GUTTER, bottom: PAGE_GUTTER + insetBottom }}>
          <Text size="2xs" color="secondary">
            Accept this conversation to use this frame.
          </Text>
        </Column>
      ) : null}
    </View>
  );
}

function useSentFrame(convId: string, messageId: string): { line: string; sent: FrameContent | null; loading: boolean } {
  const line = lineOfConv(convId);
  const feed = useXmtpFeed(line, true);
  const fromFeed = useMemo(() => frameOf(feed.events.find((e) => e.id === messageId)), [feed.events, messageId]);
  const lookup = fromFeed === null && feed.status !== 'loading';
  const stored = useFrameMessage(convId, messageId, lookup);
  const sent = fromFeed ?? (stored?.state === 'ready' ? stored.frame : null);
  return { line, sent, loading: feed.status === 'loading' || (lookup && stored === undefined) };
}

export function FrameScreen({ convId, messageId }: { convId: string; messageId: string }): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { line, sent, loading } = useSentFrame(convId, messageId);
  const chatLink = useMemo(() => conversationLinkOf(convId), [convId]);
  const canGoBack = router.canGoBack();
  const leave = useCallback(() => {
    if (canGoBack) router.back();
    else router.replace(chatLink);
  }, [router, canGoBack, chatLink]);
  const chatFrame = useChatFrame(sent, line, messageId, leave);
  const { frame, refresh } = chatFrame;
  const consent = useConvConsentState(convId);
  const locked = sent !== null && frameLocked(sent, consent === 'allowed');
  const screens = useFrameScreens(frame, chatFrame.keys.stack, leave);
  const menu = <FramePageMenu frame={sent} convId={convId} messageId={messageId} locked={locked} onRefresh={refresh} />;
  return (
    <Column surface="surface" weight={1}>
      <StackHeader title={screens.title} backTo={canGoBack ? undefined : chatLink} onBack={screens.onBack} trailing={menu} />
      <ScreenScroll ref={screens.scrollRef} contentContainerStyle={FILL_STYLE} keyboardShouldPersistTaps="handled">
        {frame !== null ? (
          <FrameBody
            chat={chatFrame}
            frame={frame}
            consent={consent}
            locked={locked}
            insetBottom={insets.bottom}
            navigation={screens.navigation}
          />
        ) : (
          <Column padding={PAGE_GUTTER}>
            {loading ? (
              <Column padding={24} align="center">
                <Spinner />
              </Column>
            ) : (
              <EmptyState title="This frame is not available." />
            )}
          </Column>
        )}
      </ScreenScroll>
    </Column>
  );
}
