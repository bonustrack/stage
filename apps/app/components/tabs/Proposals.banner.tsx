
import { useRouter } from 'expo-router';
import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import type { PayloadHandlers } from '@stage-labs/kit/kit';
import { banner, listRoot, BANNER_PRESS } from '@stage-labs/views';
import { Box } from '../layout';
import { usePalette } from '../../lib/theme';
import { useProposalCount } from './Proposals.hook';

export function ProposalsBanner(): React.ReactElement | null {
  const router = useRouter();
  const pal = usePalette();
  const count = useProposalCount();

  if (count <= 0) return null;

  const node = listRoot(banner({
    icon: 'statusOnline',
    label: count === 1 ? '1 pending request' : `${count} pending requests`,
  }));
  const actions: PayloadHandlers = {
    [BANNER_PRESS]: () => { router.push('/proposals'); },
  };

  return (
    <Box
      surface="surface"
      padding={{ x: 16, y: 12 }}
      style={{ borderBottomWidth: 1, borderBottomColor: pal.border }}
    >
      <ViewHost node={node} actions={actions} />
    </Box>
  );
}
