
import { Pressable } from '@stage-labs/kit/pressable';

import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Row, Col } from '../layout';
import { Icon } from '@stage-labs/kit/icon';
import { Title } from '@stage-labs/kit/title';

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
