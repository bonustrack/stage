
import { KitRenderer } from '@stage-labs/kit/react-native/kit-renderer';
import type { WidgetActionRegistry, WidgetRoot } from '@stage-labs/kit/kit';
import { voiceMessage, VOICE_PLAY } from '@stage-labs/views';
import { Box } from './layout';

interface Props { uri: string }

export function VoiceMessage({ uri }: Props): React.ReactElement {
  const node: WidgetRoot = {
    type: 'Basic',
    children: [voiceMessage({ src: uri })],
  };
  const registry: WidgetActionRegistry = { [VOICE_PLAY]: () => undefined };
  return (
    <Box margin={{ bottom: 6 }} style={{ alignSelf: 'flex-start' }}>
      <KitRenderer node={node} registry={registry} />
    </Box>
  );
}
