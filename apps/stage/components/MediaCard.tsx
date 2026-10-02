import type { ReactNode } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box, Col, Row } from './layout';
import { usePalette } from '../lib/theme';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';
import { mediaMaxWidth } from './bubble/imageBox.model';
import { bubbleLinkProps } from './bubble/linkProps';
import { openInBubbleLink } from '../lib/safeOpenLink';

interface Props {
  onPress?: () => void;
  url?: string;
  aspectRatio?: number;
  children: React.ReactNode;
}

export function MediaCard({ onPress, url, aspectRatio = 1, children }: Props): React.ReactElement {
  const { border, bg } = usePalette();
  const style = {
    width: '100%' as const,
    aspectRatio,
    borderRadius: BLOCK_RADIUS_DEFAULT,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: bg,
    overflow: 'hidden' as const,
  };
  const press = url ? bubbleLinkProps(url, openInBubbleLink) : onPress ? { onPress } : null;
  return (
    <Box width="100%" maxWidth={mediaMaxWidth(aspectRatio)}>
      {press ? (
        <Pressable
          {...press}
          style={({ pressed }) => [style, { opacity: pressed ? 0.85 : 1 }]}
        >
          {children}
        </Pressable>
      ) : <Box style={style}>{children}</Box>}
    </Box>
  );
}

const TABULAR_NUMS = { fontVariant: ['tabular-nums' as const] };

export function IconTileRow({ icon, title, titleColor, subtitle, tabular = false, testID, children }: {
  icon: ReactNode; title: string; titleColor: string; subtitle?: string; tabular?: boolean; testID?: string; children?: ReactNode;
}): React.ReactElement {
  return (
    <Row testID={testID} align="center" gap={12}>
      <Box width={44} height={44} radius="md" align="center" justify="center" surface="raised">
        {icon}
      </Box>
      <Col flex={1} minWidth={0} gap={2}>
        <Text size="2xs" weight="semibold" color={titleColor} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text size="3xs" role="secondary" numberOfLines={1} style={tabular ? TABULAR_NUMS : undefined}>{subtitle}</Text> : null}
      </Col>
      {children}
    </Row>
  );
}
