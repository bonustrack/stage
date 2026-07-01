
import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import { basicRoot, videoMessage } from '@stage-labs/views';
import { Box } from './layout';

export function MessengerVideoAttachment({ uri }: { uri: string }): React.ReactElement {
  const node = basicRoot(videoMessage({ src: uri }));
  return (
    <Box margin={{ bottom: 6 }}>
      <ViewHost node={node} />
    </Box>
  );
}
