/** Shared topnav for the System menu + its sub-pages — back arrow + title,
 *  mirroring the Accounts page. Paints `toolbarBg` and absorbs the top
 *  safe-area inset so the toolbar fill extends to the very top edge (behind
 *  the status-bar icons). Consumers should NOT add their own `paddingTop:
 *  insets.top` wrapper; this header owns the top inset now. */

import { Pressable } from '@metro-labs/kit/pressable';

import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Row, Col } from '../layout';
import { Icon } from '@metro-labs/kit/icon';
import { Title } from '@metro-labs/kit/title';
import { usePalette } from '../../lib/theme';

export function SystemHeader({ title, dark, fg, head, border, right }: {
  title: string; dark: boolean; fg: string; head: string; border: string;
  right?: React.ReactNode;
}): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toolbarBg } = usePalette();
  return (
    <Box style={{ backgroundColor: toolbarBg, paddingTop: insets.top }}>
      <Row style={{ alignItems: 'center', gap: 8,
        paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: border, }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
          <Icon name="arrowLeft" size={22} color={fg} />
        </Pressable>
        <Title size="sm" dark={dark} color={head}>{title}</Title>
        {right ? <Col flex={1} style={{ alignItems: 'flex-end' }}>{right}</Col> : null}
      </Row>
    </Box>
  );
}
