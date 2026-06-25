
import { KitRenderer } from '@stage-labs/kit/react-native/kit-renderer';
import type { WidgetRoot } from '@stage-labs/kit/kit';
import { videoMessage } from '@stage-labs/views';
import { Box } from './layout';

export function MessengerVideoAttachment({ uri }: { uri: string }): React.ReactElement {
  const node: WidgetRoot = { type: 'Basic', children: [videoMessage({ src: uri })] };
  return (
    <Box margin={{ bottom: 6 }}>
      <KitRenderer node={node} />
    </Box>
  );
}
