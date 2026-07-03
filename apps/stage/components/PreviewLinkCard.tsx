
import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import type { PayloadHandlers } from '@stage-labs/kit/kit';
import { listRoot, openUrlAction, previewLinkCard } from '@stage-labs/views';
import { capabilities } from '../lib/capabilities';
import { previewLinkOf } from '../lib/previewLinkDetect';

export function PreviewLinkCard({ url }: {
  url: string; dark?: boolean;
}): React.ReactElement | null {
  const ref = previewLinkOf(url);
  if (!ref) return null;

  const node = listRoot(
    previewLinkCard({
      url: ref.url,
      title: 'Open preview build',
      subtitle: `EAS Update · ${ref.shortGroup}`,
    }),
  );
  const actions: PayloadHandlers = {
    ...openUrlAction(capabilities),
  };
  return <ViewHost node={node} actions={actions} />;
}
