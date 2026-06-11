/** Home proposals banner - a minimal strip under the topnav (above the label
 *  bar) showing the number of pending polls; tapping opens the /proposals page.
 *
 *  Hidden when there are zero pending proposals OR all have been skipped this
 *  session (the count comes from the shared proposalsStore, which already filters
 *  session-skipped ids). The count read is cheap (useProposalCount only
 *  re-renders when the number changes) so it's safe on Home's frequent renders. */

import { useRouter } from 'expo-router';
import { Pressable } from '@metro-labs/kit/pressable';
import { Icon } from '@metro-labs/kit/icon';
import { Text } from '@metro-labs/kit/text';
import { Row } from '../layout';
import { usePalette } from '../../lib/theme';
import { useProposalCount } from './Proposals.hook';

export function ProposalsBanner(): React.ReactElement | null {
  const router = useRouter();
  const pal = usePalette();
  const count = useProposalCount();

  // Hidden when nothing pending / everything skipped this session.
  if (count <= 0) return null;

  return (
    <Pressable onPress={() => router.push('/proposals')}>
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
