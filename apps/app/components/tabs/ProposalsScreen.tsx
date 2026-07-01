
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import type { PayloadHandlers } from '@stage-labs/kit/kit';
import { basicRoot, screenHeader, SCREEN_BACK } from '@stage-labs/views';
import { Col, Box } from '../layout';
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
  const headerNode = basicRoot(screenHeader({
    title: 'Pending requests',
    titleStyle: { kind: 'title', size: 'sm' },
    backColor: head,
    safeTop: insets.top,
    surface: pal.toolbarBg,
    borderColor: border,
  }));
  const headerActions: PayloadHandlers = {
    [SCREEN_BACK]: () => { router.back(); },
  };

  return (
    <Col flex={1} surface="surface">
      {}
      <ViewHost node={headerNode} actions={headerActions} />

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
