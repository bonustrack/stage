import { useCallback, useMemo, useState } from 'react';
import type { LayoutChangeEvent, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Frame } from '@stage-labs/kit/react-native/frame';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import { Box } from '../layout';
import { View } from '../layout/native';
import { GradientFade } from '../GradientFade';
import { useEffectiveColorScheme, usePalette, withAlpha } from '../../lib/theme';
import { convIdOfLine } from '@stage-labs/client/xmtp/line';
import { ATTACHMENT_MAX_HEIGHT, ATTACHMENT_MAX_WIDTH } from '../bubble/imageBox.model';
import {
  FRAME_PREVIEW_BORDER, FRAME_PREVIEW_FADE, FRAME_PREVIEW_FILL, frameBackdrop, frameCardModel, frameInputOf,
  frameLinkOf, framePreviewClipped,
} from './frame.model';

const FADE_OVERLAY: ViewStyle = { position: 'absolute', left: 0, right: 0, bottom: 0 };
const PRESS_OVERLAY: ViewStyle = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };
const PRESSED_TINT = 0.15;

const previewOnly = (): void => undefined;

export function FramePreview({ frame, line, messageId, disabled }: {
  frame: FrameContent; line: string; messageId: string; disabled?: boolean;
}): React.ReactElement {
  const router = useRouter();
  const pal = usePalette();
  const scheme = useEffectiveColorScheme();
  const widget = useMemo(() => frameInputOf(frame), [frame]);
  const title = useMemo(() => frameCardModel(frame).title, [frame]);
  const backdrop = useMemo(() => frameBackdrop(frame, scheme, pal), [frame, scheme, pal]);
  const [height, setHeight] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => { setHeight(e.nativeEvent.layout.height); }, []);
  const convId = convIdOfLine(line);
  const tile: ViewStyle = {
    maxHeight: ATTACHMENT_MAX_HEIGHT,
    overflow: 'hidden',
    borderRadius: BLOCK_RADIUS_DEFAULT,
    borderWidth: FRAME_PREVIEW_BORDER,
    borderColor: pal.border,
    backgroundColor: backdrop,
  };
  const pressedTint: ViewStyle = { backgroundColor: withAlpha(pal.bg, PRESSED_TINT) };
  return (
    <Box margin={{ top: 4, bottom: 6 }} maxWidth={ATTACHMENT_MAX_WIDTH} style={{ alignSelf: 'stretch' }}>
      <View style={tile}>
        <View pointerEvents="none" aria-hidden onLayout={onLayout}>
          <Frame widget={widget} dark={scheme === 'dark'} disabled={disabled} onAction={previewOnly} fill={FRAME_PREVIEW_FILL} />
        </View>
        {framePreviewClipped(height) ? (
          <Box pointerEvents="none" style={FADE_OVERLAY}>
            <GradientFade color={backdrop} height={FRAME_PREVIEW_FADE} solid="bottom" />
          </Box>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${title}`}
          disabled={convId === null}
          onPress={() => { if (convId !== null) router.push(frameLinkOf(convId, messageId)); }}
          style={({ pressed }) => (pressed ? [PRESS_OVERLAY, pressedTint] : PRESS_OVERLAY)}
        />
      </View>
    </Box>
  );
}
