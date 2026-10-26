import { useRef, useState } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleProp, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@stage-labs/kit/react-native/text';
import { OVERLAY_SHADOW } from '@stage-labs/kit/overlay.styles';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import { convIdOfLine } from '@stage-labs/client/xmtp/line';
import { IconArrowLeft } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowLeft';
import { IconFullScreen } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconFullScreen';
import { WidgetHeader } from '../dashboard/widgetParts';
import { GradientFade } from '../GradientFade';
import { HoverIconButton } from '../hover';
import { usePalette } from '../../lib/theme';
import { isCoarsePointer } from '../../lib/webLayout';
import { ATTACHMENT_MAX_WIDTH } from '../bubble/imageBox.model';
import {
  FRAME_PREVIEW_BAR, FRAME_PREVIEW_BORDER, FRAME_PREVIEW_FADE, FRAME_PREVIEW_PADDING, frameLinkOf, frameLocked,
  frameMoreBelow, framePreviewCap, frameScreenTitle, type FrameMessageHandler,
} from './frame.model';
import { FrameView } from './FrameView';
import { ChatFrameMenu } from './FrameMenu';
import { useFrameStack, useTopOnScreenChange } from './frameStack';
import { useChatFrame } from './useFrameAction';
import { List } from '@stage-labs/kit/react-native/list';
import { Column, Row } from '../layout';

const FADE_OVERLAY: ViewStyle = { position: 'absolute', left: 0, right: 0, bottom: 0 };
const BUTTON_INSET = 6;
const FULL_SCREEN_SPOT: ViewStyle = { position: 'absolute', top: BUTTON_INSET, right: BUTTON_INSET, ...OVERLAY_SHADOW };
const SCROLL_STYLE: ViewStyle = { flexGrow: 0, flexShrink: 1 };
const FILL_STYLE: ViewStyle = { flex: 1 };

function tileLayout(fill: boolean, depth: number): { tile: ViewStyle; scroll: StyleProp<ViewStyle> } {
  return fill ? { tile: FILL_STYLE, scroll: FILL_STYLE } : { tile: {}, scroll: [SCROLL_STYLE, { maxHeight: framePreviewCap(depth) }] };
}

function useScrollFade(screen: string): {
  ref: React.RefObject<ScrollView | null>;
  more: boolean;
  onLayout: (e: LayoutChangeEvent) => void;
  onContentSizeChange: (width: number, height: number) => void;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
} {
  const ref = useRef<ScrollView>(null);
  const view = useRef({ content: 0, viewport: 0, offset: 0 });
  const [more, setMore] = useState(false);
  const update = (patch: Partial<typeof view.current>): void => {
    view.current = { ...view.current, ...patch };
    setMore(frameMoreBelow(view.current));
  };
  useTopOnScreenChange(screen, () => { ref.current?.scrollTo({ y: 0, animated: false }); });
  return {
    ref,
    more,
    onLayout: (e) => { update({ viewport: e.nativeEvent.layout.height }); },
    onContentSizeChange: (_width, height) => { update({ content: height }); },
    onScroll: (e) => { update({ offset: e.nativeEvent.contentOffset.y }); },
  };
}

function FrameBar({ title, onBack }: { title: string; onBack: () => void }): React.ReactElement {
  const pal = usePalette();
  return (
    <Row
      align="center" gap={6} height={FRAME_PREVIEW_BAR} background={pal.bg}
      padding={{ left: 10, right: FRAME_PREVIEW_BAR + BUTTON_INSET }}
      border={{ bottom: { width: FRAME_PREVIEW_BORDER, color: pal.border } }}
    >
      <HoverIconButton icon={IconArrowLeft} label="Back" color={pal.link} size={18} role="button" onPress={onBack}/>
      <Text text={title} size="sm" fontWeight="semibold" color={pal.link} numberOfLines={1} style={{ flexShrink: 1 }}/>
    </Row>
  );
}

function FullScreenButton({ onPress }: { onPress: () => void }): React.ReactElement {
  const pal = usePalette();
  return (
    <Column surface="raised" radius="full" padding={6} style={FULL_SCREEN_SPOT}>
      <HoverIconButton icon={IconFullScreen} label="Full screen" color={pal.text} size={16} role="button" onPress={onPress}/>
    </Column>
  );
}

export function FrameSurface({ frame, stackId, sessionKey = stackId, onMessage, untilTap, disabled, fill = false, onFullScreen }: {
  frame: FrameContent; stackId: string; sessionKey?: string; onMessage?: FrameMessageHandler; untilTap?: boolean;
  disabled?: boolean; fill?: boolean; onFullScreen?: () => void;
}): React.ReactElement {
  const pal = usePalette();
  const navigation = useFrameStack(stackId, frame);
  const { screen, depth, navigate } = navigation;
  const fade = useScrollFade(screen);
  const [hovered, setHovered] = useState(false);
  const layout = tileLayout(fill, depth);
  const tile: ViewStyle = {
    overflow: 'hidden',
    borderRadius: BLOCK_RADIUS_DEFAULT,
    borderWidth: FRAME_PREVIEW_BORDER,
    borderColor: pal.border,
    backgroundColor: pal.bg,
    ...layout.tile,
  };
  return (
    <Column style={tile} onPointerEnter={() => { setHovered(true); }} onPointerLeave={() => { setHovered(false); }}>
      {depth > 0 ? <FrameBar title={frameScreenTitle(frame, screen)} onBack={() => { navigate({ kind: 'close' }); }}/> : null}
      <List
        ref={fade.ref} showsVerticalScrollIndicator={false} style={layout.scroll}
        onLayout={fade.onLayout} onContentSizeChange={fade.onContentSizeChange} onScroll={fade.onScroll}
        scrollEventThrottle={32} keyboardShouldPersistTaps="handled" nestedScrollEnabled={fill}
      >
        <FrameView frame={frame} sessionKey={sessionKey} disabled={disabled} onMessage={onMessage} untilTap={untilTap}
          navigation={navigation} padding={FRAME_PREVIEW_PADDING} />
      </List>
      {fade.more ? (
        <Column pointerEvents="none" style={FADE_OVERLAY}>
          <GradientFade color={pal.bg} height={FRAME_PREVIEW_FADE} solid="bottom"/>
        </Column>
      ) : null}
      {onFullScreen !== undefined && (depth > 0 || hovered || isCoarsePointer()) ? <FullScreenButton onPress={onFullScreen}/> : null}
    </Column>
  );
}

export function FrameTile({ frame, line, messageId, disabled, fill = false, menu = false, onSent }: {
  frame: FrameContent; line: string; messageId: string; disabled?: boolean; fill?: boolean; menu?: boolean; onSent?: () => void;
}): React.ReactElement {
  const router = useRouter();
  const chat = useChatFrame(frame, line, messageId, onSent);
  const convId = convIdOfLine(line);
  return (
    <>
      {menu && convId !== null ? (
        <ChatFrameMenu
          frame={frame} convId={convId} messageId={messageId} onRefresh={disabled === true ? undefined : chat.refresh}
          trigger={(open) => <WidgetHeader title={chat.node?.host} onMenu={open} />}
        />
      ) : null}
      <FrameSurface
        frame={chat.frame ?? frame} stackId={messageId} sessionKey={chat.sessionKey} onMessage={chat.onMessage}
        untilTap={chat.node !== null} disabled={disabled} fill={fill}
        onFullScreen={convId === null ? undefined : () => { router.push(frameLinkOf(convId, messageId)); }}
      />
    </>
  );
}

export function FramePreview({ frame, line, messageId, consentAllowed }: {
  frame: FrameContent; line: string; messageId: string; consentAllowed?: boolean;
}): React.ReactElement {
  return (
    <Column margin={{ top: 4, bottom: 6 }} maxWidth={ATTACHMENT_MAX_WIDTH} style={{ alignSelf: 'stretch' }}>
      <FrameTile frame={frame} line={line} messageId={messageId} disabled={frameLocked(frame, consentAllowed)} menu />
    </Column>
  );
}
