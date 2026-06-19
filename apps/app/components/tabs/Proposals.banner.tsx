/**
 * @file Proposals.banner — the Home strip under the topnav showing the pending-
 *  poll count and linking to /proposals; hidden when the count (from the shared
 *  proposalsStore, session-skips filtered) is zero.
 */

import { useRouter } from 'expo-router';
import { Pressable } from '@metro-labs/kit/pressable';
import { Icon } from '@metro-labs/kit/icon';
import { Text } from '@metro-labs/kit/text';
import { Row } from '../layout';
import { usePalette } from '../../lib/theme';
import { useProposalCount } from './Proposals.hook';

/** Banner that surfaces the active proposal count and links to the proposals screen. */
export function ProposalsBanner(): React.ReactElement | null {
  const router = useRouter();
  const pal = usePalette();
  const count = useProposalCount();

  // Hidden when nothing pending / everything skipped this session.
  if (count <= 0) return null;

  return (
    <Pressable onPress={() => { router.push('/proposals'); }}>
      <Row
        surface="surface"
        align="center"
        gap={10}
        padding={{ x: 16, y: 12 }}
        style={{ borderBottomWidth: 1, borderBottomColor: pal.border }}
>
        <Icon name="statusOnline" size={20} color={pal.link}/>
        <Text size="2xl" weight="semibold" color={pal.link} style={{ flex: 1 }}>
          {count === 1 ? '1 pending request' : `${count} pending requests`}
        </Text>
        <Icon name="chevronRight" size={18} color={pal.text}/>
      </Row>
    </Pressable>
  );
}
