
import { useRouter } from 'expo-router';
import { KitRenderer } from '@stage-labs/kit/react-native/kit-renderer';
import type { WidgetActionRegistry, WidgetRoot } from '@stage-labs/kit/kit';
import { banner, BANNER_PRESS } from '@stage-labs/views';
import { Box } from '../layout';
import { usePalette } from '../../lib/theme';
import { useProposalCount } from './Proposals.hook';

export function ProposalsBanner(): React.ReactElement | null {
  const router = useRouter();
  const pal = usePalette();
  const count = useProposalCount();

  if (count <= 0) return null;

  const node: WidgetRoot = {
    type: 'ListView',
    children: [
      banner({
        icon: 'statusOnline',
        label: count === 1 ? '1 pending request' : `${count} pending requests`,
      }),
    ],
  };
  const registry: WidgetActionRegistry = {
    [BANNER_PRESS]: () => { router.push('/proposals'); },
  };

  return (
    <Box
      surface="surface"
      padding={{ x: 16, y: 12 }}
      style={{ borderBottomWidth: 1, borderBottomColor: pal.border }}
    >
      <KitRenderer node={node} registry={registry} />
    </Box>
  );
}
