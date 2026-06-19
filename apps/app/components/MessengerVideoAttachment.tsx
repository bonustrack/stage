/**
 * @file MessengerVideoAttachment: inline video message attachment played via expo-av with native controls.
 */

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
