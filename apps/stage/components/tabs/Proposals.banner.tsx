
import { Icon } from '@stage-labs/kit/react-native/icon';
import { ListView, ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { resolveColorToken } from '@stage-labs/kit/tokens';
import { capabilities } from '../../lib/capabilities';
import { Box, Col, Row } from '../layout';
import { usePalette } from '../../lib/theme';
import { useProposalCount } from './Proposals.hook';

export function ProposalsBanner(): React.ReactElement | null {
  const pal = usePalette();
  const scheme = useKitScheme();
  const dark = scheme === 'dark';
  const count = useProposalCount();

  if (count <= 0) return null;

  const label = count === 1 ? '1 pending request' : `${count} pending requests`;

  return (
    <Box
      surface="surface"
      padding={{ x: 16, y: 12 }}
      style={{ borderBottomWidth: 1, borderBottomColor: pal.border }}
    >
      <ListView dark={dark}>
        <ListViewItem
          align="center"
          gap={10}
          dark={dark}
          onPress={() => { capabilities.navigate('/proposals'); }}
        >
          <Row align="center" gap={10} flex={1}>
            <Icon name="statusOnline" size={20} color={resolveColorToken('link', scheme)} dark={dark} />
            <Col flex={1}>
              <Text value={label} weight="semibold" size="lg" color="link" truncate />
            </Col>
            <Icon name="chevronRight" size={16} color={resolveColorToken('secondary', scheme)} dark={dark} />
          </Row>
        </ListViewItem>
      </ListView>
    </Box>
  );
}
