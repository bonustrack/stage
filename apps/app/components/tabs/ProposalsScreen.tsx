/** Proposals tab — works through pending polls across all non-archived chats,
 *  oldest-first, one at a time.
 *
 *  A "pending proposal" is a channel whose LATEST message is a poll (see
 *  Proposals.queue). The screen shows ONE proposal card at a time
 *  (Proposals.card) with vote/skip/open + a composer; acting on it advances to
 *  the next. When the queue is exhausted it shows a minimal empty state.
 *
 *  Mounted as a swipe-tab body (SwipeTabs.config PAGES) — it takes the optional
 *  `panRef` like the other tab bodies, though the card's own scroll/composer
 *  don't need to coordinate with the pager here. */

import { Text } from '@metro-labs/kit/text';
import { Button } from '@metro-labs/kit/button';
import { Col, Box } from '../layout';
import { usePalette, useEffectiveColorScheme } from '../../lib/theme';
import { useProposals } from './Proposals.hook';
import { ProposalCard } from './Proposals.card';

/** No props are read here — the pager passes a `panRef`, but Proposals has no
 *  inner horizontal scrollable that needs to coordinate with the swipe gesture,
 *  so the page ignores it (the param is omitted; assignable to the PAGES type). */
export function ProposalsScreen(): React.ReactElement {
  const pal = usePalette();
  const dark = useEffectiveColorScheme() === 'dark';
  const { current, loading, position, total, advance, refresh } = useProposals();

  if (current) {
    /** Key by convId so advancing remounts the card (fresh feed per channel). */
    return (
      <Col flex={1} surface="surface">
        <Box padding={{ x: 16, top: 12 }}>
          <Text size="xs" color={pal.text} style={{ opacity: 0.6 }}>
            {position} of {total}
          </Text>
        </Box>
        <ProposalCard key={current.convId} proposal={current} onAdvance={advance}/>
      </Col>
    );
  }

  return (
    <Col flex={1} surface="surface" align="center" justify="center" padding={{ x: 24 }}>
      <Box align="center" gap={12}>
        <Text size="3xl" color={pal.text} style={{ opacity: 0.85 }}>
          {loading ? 'Loading proposals…' : 'No pending proposals'}
        </Text>
        {!loading ? (
          <Button variant="secondary" size="md" dark={dark} onPress={refresh} label="Refresh"/>
        ) : null}
      </Box>
    </Col>
  );
}
