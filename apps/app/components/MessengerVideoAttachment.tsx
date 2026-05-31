/** Inline video attachment — plays via expo-av `Video` with native controls.
 *  `uri` is either a decrypted local `file://` (remote/multi-remote, resolved by
 *  RemoteAttachmentResolver) or a local `file://`/`data:` (optimistic local send).
 *  Not autoplay; CONTAIN fit; capped height with rounded corners for bubble parity. */

import { Video, ResizeMode } from 'expo-av';
import { Box } from './layout';

export function MessengerVideoAttachment({ uri }: { uri: string }): React.ReactElement {
  return (
    <Box style={{ width: 220, borderRadius: 10, overflow: 'hidden', marginBottom: 6, backgroundColor: '#000' }}>
      <Video
        source={{ uri }}
        style={{ width: '100%', height: 280 }}
        useNativeControls
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={false}
      />
    </Box>
  );
}
