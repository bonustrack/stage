/**
 * @file SystemHeader — shared back-arrow + title topnav for the System menu and
 *  its sub-pages; paints the toolbar surface and absorbs the top safe-area inset
 *  so consumers must not add their own paddingTop wrapper.
 */

import { Pressable } from '@metro-labs/kit/pressable';

import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Row, Col } from '../layout';
import { Icon } from '@metro-labs/kit/icon';
import { Title } from '@metro-labs/kit/title';

/** Renders the header bar for a system design section page. */
export function SystemHeader({ title, fg, head, border, right }: {
  title: string; dark: boolean; fg: string; head: string; border: string;
  right?: React.ReactNode;
}): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <Box surface="toolbar" padding={{ top: insets.top }}>
      <Row padding={{ x: 12, top: 8, bottom: 10 }} align="center" gap={8} style={{ borderBottomWidth: 1, borderBottomColor: border }}>
        <Pressable onPress={() => { router.back(); }} hitSlop={8} style={{ padding: 4 }}>
          <Icon name="arrowLeft" size={22} color={fg}/>
        </Pressable>
        <Title size="sm" color={head}>{title}</Title>
        {right ? <Col flex={1} align="end">{right}</Col> : null}
      </Row>
    </Box>
  );
}
