import { useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleProp, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Frame, type FrameActionHandler } from '@stage-labs/kit/react-native/frame';
import { Scroll } from '@stage-labs/kit/react-native/scroll';
import { Text } from '@stage-labs/kit/react-native/text';
import { parseFrameDoc } from '@stage-labs/kit/frame';
import { OVERLAY_SHADOW } from '@stage-labs/kit/overlay.styles';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import { convIdOfLine } from '@stage-labs/client/xmtp/line';
import { IconArrowLeft } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowLeft';
import { IconFullScreen } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconFullScreen';
import { Box, Row } from '../layout';
import { GradientFade } from '../GradientFade';
import { HoverIconButton } from '../hover';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { openInBubbleLink } from '../../lib/safeOpenLink';
import { isCoarsePointer } from '../../lib/webLayout';
import { ATTACHMENT_MAX_WIDTH } from '../bubble/imageBox.model';
import {
  FRAME_PREVIEW_BAR, FRAME_PREVIEW_BORDER, FRAME_PREVIEW_FADE, FRAME_PREVIEW_FILL, frameBackdrop, frameInputOf,
  frameLinkOf, frameMoreBelow, framePreviewCap, frameScreenTitle,
} from './frame.model';
import { useFrameStack, useTopOnScreenChange } from './frameStack';
import { useFrameAction } from './useFrameAction';

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
      <Text value={title} size="sm" weight="semibold" color={pal.link} numberOfLines={1} style={{ flexShrink: 1 }}/>
    </Row>
  );
}

function FullScreenButton({ onPress }: { onPress: () => void }): React.ReactElement {
  const pal = usePalette();
  return (
    <Box surface="raised" radius="full" padding={6} style={FULL_SCREEN_SPOT}>
      <HoverIconButton icon={IconFullScreen} label="Full screen" color={pal.text} size={16} role="button" onPress={onPress}/>
    </Box>
  );
}

export function FrameSurface({ frame, stackId, onAction, disabled, fill = false, onFullScreen }: {
  frame: FrameContent; stackId: string; onAction?: FrameActionHandler; disabled?: boolean; fill?: boolean; onFullScreen?: () => void;
}): React.ReactElement {
  const pal = usePalette();
  const scheme = useEffectiveColorScheme();
  const widget = useMemo(() => frameInputOf(frame), [frame]);
  const parsed = useMemo(() => parseFrameDoc(widget), [widget]);
  const navigation = useFrameStack(stackId, parsed.ok ? parsed.doc.start : '');
  const { screen, depth, navigate } = navigation;
  const backdrop = useMemo(() => frameBackdrop(frame, scheme, pal, screen), [frame, scheme, pal, screen]);
  const fade = useScrollFade(screen);
  const [hovered, setHovered] = useState(false);
  const layout = tileLayout(fill, depth);
  const tile: ViewStyle = {
    overflow: 'hidden',
    borderRadius: BLOCK_RADIUS_DEFAULT,
    borderWidth: FRAME_PREVIEW_BORDER,
    borderColor: pal.border,
    backgroundColor: backdrop,
    ...layout.tile,
  };
  return (
    <Box style={tile} onPointerEnter={() => { setHovered(true); }} onPointerLeave={() => { setHovered(false); }}>
      {depth > 0 ? <FrameBar title={frameScreenTitle(frame, parsed, screen)} onBack={() => { navigate({ kind: 'back' }); }}/> : null}
      <Scroll
        ref={fade.ref} showsVerticalScrollIndicator={false} style={layout.scroll}
        onLayout={fade.onLayout} onContentSizeChange={fade.onContentSizeChange} onScroll={fade.onScroll}
        scrollEventThrottle={32} keyboardShouldPersistTaps="handled" nestedScrollEnabled={fill}
      >
        <Frame
          widget={widget} dark={scheme === 'dark'} disabled={disabled} onAction={onAction} navigation={navigation}
          fill={FRAME_PREVIEW_FILL} onOpenUrl={(url) => { openInBubbleLink(url); }}
        />
      </Scroll>
      {fade.more ? (
        <Box pointerEvents="none" style={FADE_OVERLAY}>
          <GradientFade color={backdrop} height={FRAME_PREVIEW_FADE} solid="bottom"/>
        </Box>
      ) : null}
      {onFullScreen !== undefined && (depth > 0 || hovered || isCoarsePointer()) ? <FullScreenButton onPress={onFullScreen}/> : null}
    </Box>
  );
}

export function FrameTile({ frame, line, messageId, disabled, fill = false, onSent }: {
  frame: FrameContent; line: string; messageId: string; disabled?: boolean; fill?: boolean; onSent?: () => void;
}): React.ReactElement {
  const router = useRouter();
  const onAction = useFrameAction(line, messageId, onSent);
  const convId = convIdOfLine(line);
  return (
    <FrameSurface
      frame={frame} stackId={messageId} onAction={onAction} disabled={disabled} fill={fill}
      onFullScreen={convId === null ? undefined : () => { router.push(frameLinkOf(convId, messageId)); }}
    />
  );
}

export function FramePreview({ frame, line, messageId, disabled }: {
  frame: FrameContent; line: string; messageId: string; disabled?: boolean;
}): React.ReactElement {
  return (
    <Box margin={{ top: 4, bottom: 6 }} maxWidth={ATTACHMENT_MAX_WIDTH} style={{ alignSelf: 'stretch' }}>
      <FrameTile frame={frame} line={line} messageId={messageId} disabled={disabled} />
    </Box>
  );
}
