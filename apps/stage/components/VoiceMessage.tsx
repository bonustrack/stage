
import { useMemo } from 'react';
import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import type { PayloadHandlers } from '@stage-labs/kit/kit';
import { basicRoot, voiceMessage, VOICE_PLAY } from '@stage-labs/views';
import { VOICE_BAR_COUNT, voiceWaveformBars } from '@stage-labs/client/xmtp/voice';
import { Box } from './layout';
import { useDecodedBars } from './VoiceMessage.barsCache';

interface Props { uri: string }

export function VoiceMessage({ uri }: Props): React.ReactElement {
  const synthetic = useMemo(() => voiceWaveformBars(uri, VOICE_BAR_COUNT), [uri]);
  const decoded = useDecodedBars(uri, VOICE_BAR_COUNT);
  const bars = decoded ?? synthetic;

  const node = basicRoot(voiceMessage({ src: uri, bars, barCount: VOICE_BAR_COUNT }));
  const actions: PayloadHandlers = { [VOICE_PLAY]: () => undefined };
  return (
    <Box margin={{ bottom: 6 }} style={{ alignSelf: 'flex-start' }}>
      <ViewHost node={node} actions={actions} />
    </Box>
  );
}
