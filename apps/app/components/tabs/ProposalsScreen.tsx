/** @file Proposals screen working through pending poll proposals oldest-first, one card at a time across all non-archived chats; opened as a pushed route from the Home banner, with count and queue from the shared proposalsStore via useProposals. */

import { Pressable } from '@metro-labs/kit/pressable';
import { Icon } from '@metro-labs/kit/icon';
import { Title } from '@metro-labs/kit/title';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@metro-labs/kit/text';
import { Button } from '@metro-labs/kit/button';
import { Col, Row, Box } from '../layout';
import { usePalette, useEffectiveColorScheme } from '../../lib/theme';
import { useProposals } from './Proposals.hook';
import { ProposalCard } from './Proposals.card';

/** Screen that lists governance proposals as cards. */
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
      {/* Topnav: back + title, mirroring the Menu / Accounts / Search pages. */}
      <Row surface="toolbar" padding={{ x: 12, top: 8 + insets.top, bottom: 10 }} align="center" gap={8} style={{ borderBottomWidth: 1, borderBottomColor: border }}>
        <Pressable onPress={() => { router.back(); }} hitSlop={8} style={{ padding: 4 }}>
          <Icon name="arrowLeft" size={22} color={head}/>
        </Pressable>
        <Title size="sm">
          Pending requests
        </Title>
      </Row>

      {current ? (
        /** Key by convId so advancing remounts the card (fresh feed per channel). */
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
