
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { proposalsEmptyLabel, proposalsPositionLabel } from '@views';
import { capabilities } from '../../lib/capabilities';
import { Col, Box } from '../layout';
import { ScreenHeader } from '../chrome/ScreenHeader';
import { usePalette, useEffectiveColorScheme } from '../../lib/theme';
import { useProposals } from './Proposals.hook';
import { ProposalCard } from './Proposals.card';

export function ProposalsScreen(): React.ReactElement {
  const pal = usePalette();
  const dark = useEffectiveColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const head = pal.link;
  const border = pal.border;
  const { current, loading, position, total, advance, refresh } = useProposals();

  return (
    <Col flex={1} surface="surface">
      <ScreenHeader
        title="Pending requests"
        titleStyle={{ kind: 'title', size: 'sm' }}
        onBack={() => { capabilities.back(); }}
        backColor={head}
        safeTop={insets.top}
        surface={pal.toolbarBg}
        borderColor={border}
      />

      {current ? (
        <Col flex={1} surface="surface">
          <Box padding={{ x: 16, top: 12 }}>
            <Text size="xs" color={pal.text} style={{ opacity: 0.6 }}>
              {proposalsPositionLabel(position, total)}
            </Text>
          </Box>
          <ProposalCard key={current.key} proposal={current} onAdvance={advance}/>
        </Col>
      ) : (
        <Col flex={1} surface="surface" align="center" justify="center" padding={{ x: 24 }}>
          <Box align="center" gap={12}>
            <Text size="3xl" color={pal.text} style={{ opacity: 0.85 }}>
              {proposalsEmptyLabel(loading)}
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
