import { Text } from '@stage-labs/kit/react-native/text';
import { GROUP_WAITING_NOTICE } from '@stage-labs/client/xmtp/clientErrors';
import { usePalette } from '../../lib/theme';
import { Box, Col, PAGE_GUTTER } from '../layout';

export function GroupWaitingNotice(): React.ReactElement {
  const { border, text: fg } = usePalette();
  return (
    <Box surface="toolbar" style={{ borderTopWidth: 1, borderTopColor: border }}>
      <Col width={'100%'} padding={{ x: PAGE_GUTTER, top: 14, bottom: 14 }} align="stretch" style={{ alignSelf: 'stretch' }}>
        <Text color={fg} style={{ textAlign: 'center', opacity: 0.8 }}>{GROUP_WAITING_NOTICE}</Text>
      </Col>
    </Box>
  );
}
