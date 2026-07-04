
import { VideoPlayer } from '@stage-labs/kit/react-native/video-player';
import { Box } from './layout';

export function MessengerVideoAttachment({ uri }: { uri: string }): React.ReactElement {
  return (
    <Box margin={{ bottom: 6 }}>
      <Box width={220} radius="md" background="#000">
        <VideoPlayer src={uri} controls />
      </Box>
    </Box>
  );
}
