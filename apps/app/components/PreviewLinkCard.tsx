
import { Linking } from 'react-native';

import { ChatKitRenderer } from '@stage-labs/kit/react-native/chatkit-renderer';
import type { WidgetActionRegistry, WidgetRoot } from '@stage-labs/kit/chatkit';
import { previewLinkCard, LINK_OPEN } from '@stage-labs/views';
import { previewLinkOf } from '../lib/previewLinkDetect';

export function PreviewLinkCard({ url }: {
  url: string; dark?: boolean;
}): React.ReactElement | null {
  const ref = previewLinkOf(url);
  if (!ref) return null;

  const node: WidgetRoot = {
    type: 'ListView',
    children: [
      previewLinkCard({
        url: ref.url,
        title: 'Open preview build',
        subtitle: `EAS Update · ${ref.shortGroup}`,
      }),
    ],
  };
  const registry: WidgetActionRegistry = {
    [LINK_OPEN]: (action) => {
      const target = action.payload.url;
      if (typeof target === 'string') void Linking.openURL(target);
    },
  };
  return <ChatKitRenderer node={node} registry={registry} />;
}
