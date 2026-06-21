
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Title } from '@stage-labs/kit/react-native/title';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { Col, Row, Box } from '../layout';
import { usePalette, useEffectiveColorScheme } from '../../lib/theme';
import { useProposals } from './Proposals.hook';
import { ProposalCard } from './Proposals.card';

export function ProposalsScreen(): React.ReactElement {
  const pal = usePalette();
  const dark = useEffectiveColorScheme() === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const head = pal.link;
  const border = pal.border;
  const { current, loading, position, total, advance, refresh } = useProposals();

  return (
    <Col flex={1} surface="surface">
      {}
      <Row surface="toolbar" padding={{ x: 12, top: 8 + insets.top, bottom: 10 }} align="center" gap={8} style={{ borderBottomWidth: 1, borderBottomColor: border }}>
        <Pressable onPress={() => { router.back(); }} hitSlop={8} style={{ padding: 4 }}>
          <Icon name="arrowLeft" size={22} color={head}/>
        </Pressable>
        <Title size="sm">
          Pending requests
        </Title>
      </Row>

      {current ? (
        <Col flex={1} surface="surface">
          <Box padding={{ x: 16, top: 12 }}>
            <Text size="xs" color={pal.text} style={{ opacity: 0.6 }}>
              {position} of {total}
            </Text>
          </Box>
          <ProposalCard key={current.key} proposal={current} onAdvance={advance}/>
        </Col>
      ) : (
        <Col flex={1} surface="surface" align="center" justify="center" padding={{ x: 24 }}>
          <Box align="center" gap={12}>
            <Text size="3xl" color={pal.text} style={{ opacity: 0.85 }}>
              {loading ? 'Loading requests…' : 'No pending requests'}
            </Text>
            {!loading ? (
              <Button variant="secondary" size="md" dark={dark} onPress={refresh} label="Refresh"/>
            ) : null}
          </Box>
        </Col>
      )}
    </Col>
  );
}
