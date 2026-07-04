
import { useMemo } from 'react';
import { AudioPlayer } from '@stage-labs/kit/react-native/audio-player';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { VOICE_ACCENT, VOICE_ON_ACCENT } from '@views';
import { VOICE_BAR_COUNT, voiceWaveformBars } from '@stage-labs/client/xmtp/voice';
import { Box, Row } from './layout';
import { useDecodedBars } from './VoiceMessage.barsCache';

interface Props { uri: string }

export function VoiceMessage({ uri }: Props): React.ReactElement {
  const scheme = useKitScheme();
  const synthetic = useMemo(() => voiceWaveformBars(uri, VOICE_BAR_COUNT), [uri]);
  const decoded = useDecodedBars(uri, VOICE_BAR_COUNT);
  const bars = decoded ?? synthetic;

  return (
    <Box margin={{ bottom: 6 }} style={{ alignSelf: 'flex-start' }}>
      <Row
        radius="2xl"
        background={VOICE_ACCENT[scheme]}
        maxWidth={280}
        minWidth={200}
        padding={{ x: 9, y: 7 }}
        align="center"
      >
        <AudioPlayer
          src={uri}
          dark={scheme === 'dark'}
          waveform
          bars={bars}
          barCount={VOICE_BAR_COUNT}
          accent={VOICE_ACCENT[scheme]}
          onAccent={VOICE_ON_ACCENT[scheme]}
        />
      </Row>
    </Box>
  );
}
