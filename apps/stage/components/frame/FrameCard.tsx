import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import { IconCrop } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCrop';
import { IconChevronRight } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconChevronRight';
import { Box, Col, Row } from '../layout';
import { usePalette } from '../../lib/theme';
import { convIdOfLine } from '../../modules/messaging';
import { frameCardModel, frameLinkOf } from './frame.model';

const ICON_TILE = 40;

export function FrameCard({ frame, line, messageId }: {
  frame: FrameContent; line: string; messageId: string;
}): React.ReactElement {
  const router = useRouter();
  const pal = usePalette();
  const model = useMemo(() => frameCardModel(frame), [frame]);
  const convId = convIdOfLine(line);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${model.title}`}
      disabled={convId === null}
      pressedOpacity={0.85}
      onPress={() => { if (convId !== null) router.push(frameLinkOf(convId, messageId)); }}
      style={{ alignSelf: 'stretch' }}
    >
      <Row gap={12} align="center" padding={12} radius={BLOCK_RADIUS_DEFAULT} style={{ borderWidth: 1, borderColor: pal.border }}>
        <Box size={ICON_TILE} radius="md" background={pal.inputBg} align="center" justify="center">
          <Glyph icon={IconCrop} size={20} color={pal.link} />
        </Box>
        <Col flex={1} gap={2}>
          <Text weight="semibold" size="xl" numberOfLines={1}>{model.title}</Text>
          {model.description ? (
            <Text size="md" color={pal.text} numberOfLines={2}>{model.description}</Text>
          ) : null}
        </Col>
        <Glyph icon={IconChevronRight} size={18} color={pal.text} />
      </Row>
    </Pressable>
  );
}
