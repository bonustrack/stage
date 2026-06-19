/** Inline video attachment — plays via expo-av `Video` with native controls.
 *  `uri` is either a decrypted local `file://` (remote/multi-remote, resolved by
 *  RemoteAttachmentResolver) or a local `file://`/`data:` (optimistic local send).
 *  Not autoplay; CONTAIN fit; capped height with rounded corners for bubble parity. */

import { Video, ResizeMode } from 'expo-av';
import { Box } from './layout';

/** Renders an inline video message attachment with native playback controls. */
export function MessengerVideoAttachment({ uri }: { uri: string }): React.ReactElement {
  return (
    <Box width={220} radius="md" background={'#000'} margin={{ bottom: 6 }} style={{ overflow: 'hidden' }}>
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
