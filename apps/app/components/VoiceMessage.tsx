
import { useMemo } from 'react';
import { KitRenderer } from '@stage-labs/kit/react-native/kit-renderer';
import type { WidgetActionRegistry, WidgetRoot } from '@stage-labs/kit/kit';
import { voiceMessage, VOICE_PLAY } from '@stage-labs/views';
import { VOICE_BAR_COUNT, voiceWaveformBars } from '@stage-labs/client/xmtp/voice';
import { Box } from './layout';
import { useDecodedBars } from './VoiceMessage.barsCache';

interface Props { uri: string }

export function VoiceMessage({ uri }: Props): React.ReactElement {
  const synthetic = useMemo(() => voiceWaveformBars(uri, VOICE_BAR_COUNT), [uri]);
  const decoded = useDecodedBars(uri, VOICE_BAR_COUNT);
  const bars = decoded ?? synthetic;

  const node: WidgetRoot = {
    type: 'Basic',
    children: [voiceMessage({ src: uri, bars, barCount: VOICE_BAR_COUNT })],
  };
  const registry: WidgetActionRegistry = { [VOICE_PLAY]: () => undefined };
  return (
    <Box margin={{ bottom: 6 }} style={{ alignSelf: 'flex-start' }}>
      <KitRenderer node={node} registry={registry} />
    </Box>
  );
}
