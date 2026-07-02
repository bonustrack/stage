
import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import type { PayloadHandlers } from '@stage-labs/kit/kit';
import { banner, listRoot, navigateAction, BANNER_PRESS } from '@stage-labs/views';
import { capabilities } from '../../lib/capabilities';
import { Box } from '../layout';
import { usePalette } from '../../lib/theme';
import { useProposalCount } from './Proposals.hook';

export function ProposalsBanner(): React.ReactElement | null {
  const pal = usePalette();
  const count = useProposalCount();

  if (count <= 0) return null;

  const node = listRoot(banner({
    icon: 'statusOnline',
    label: count === 1 ? '1 pending request' : `${count} pending requests`,
  }));
  const actions: PayloadHandlers = {
    ...navigateAction(BANNER_PRESS, capabilities, () => '/proposals'),
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
