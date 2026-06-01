/** CollapsibleSection — a lightweight accordion section for the Kit gallery.
 *
 *  Tappable header (kit Title + a chevron that flips up/down) toggles whether
 *  its children render. Conditional render only — no LayoutAnimation, no new
 *  dependency. Local useState keeps each section independent. */

import { useState } from 'react';
import { Pressable } from 'react-native';
import { Box, Row } from '../layout';
import { Title } from '@metro-labs/kit/title';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';

export interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  dark: boolean;
  head: string;
  sub: string;
  /** Whether the section starts expanded. Default false. */
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection(props: CollapsibleSectionProps): React.ReactElement {
  const { title, subtitle, dark, head, sub, defaultOpen = false, children } = props;
  const [open, setOpen] = useState<boolean>(defaultOpen);

  return (
    <Box style={{ marginTop: 26 }}>
      <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button">
        <Row align="center" gap={8}>
          <Icon name={open ? 'chevronUp' : 'chevronDown'} size={18} color={head} />
          <Box style={{ flex: 1 }}>
            <Title dark={dark} level={2} color={head}>{title}</Title>
            <Text dark={dark} color={sub} variant="caption" weight="medium">
              {subtitle ?? '@metro-labs/kit'}
            </Text>
          </Box>
        </Row>
      </Pressable>
      {open ? <Box style={{ marginTop: 4 }}>{children}</Box> : null}
    </Box>
  );
}
