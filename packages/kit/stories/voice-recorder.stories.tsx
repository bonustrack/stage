import { useEffect, useState } from 'react';
import type { Story } from '../gallery/story';
import { VoiceRecorder, type VoiceRecorderProps } from '../src/react-native/voice-recorder';
import { Icon } from '../src/react-native/icon';
import { Pressable } from '../src/react-native/pressable';
import { Box, Col } from '../src/react-native/box';
import { Text } from '../src/react-native/text';
import { semanticPalette } from '../src/tokens';
import { number, useDark } from './_controls';

export default { title: 'Voice Recorder' };

export const Controls: Story<Pick<VoiceRecorderProps, 'slideThresholdPx'>> = (args) => {
  const dark = useDark();
  const p = semanticPalette(dark ? 'dark' : 'light');
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [log, setLog] = useState('Hold the microphone to record, slide left to cancel');
  useEffect(() => {
    if (!recording) { setSecs(0); setLevels([]); return undefined; }
    const id = setInterval(() => { setSecs((s) => s + 0.1); setLevels((l) => [...l.slice(-39), Math.random()]); }, 100);
    return (): void => { clearInterval(id); };
  }, [recording]);
  return (
    <Col gap={12}>
      <Text role="secondary" size="sm">{log}</Text>
      <Box surface="sunken" radius="xl" padding={8}>
        <VoiceRecorder
          {...args}
          recording={recording} levels={levels} recordSecs={secs} dark={dark}
          fg={p.textColor} head={p.textColor} sub={p.subColor} bg={p.bgColor} chipBg={p.inputBgColor} primary={p.primaryColor}
          inputSlot={<Text role="secondary">Message</Text>}
          leftControls={<Icon name="plus" size={22} dark={dark} />}
          rightAction={<Pressable><Icon name="microphone" size={22} dark={dark} /></Pressable>}
          onStart={() => { setRecording(true); setLog('recording'); }}
          onCancel={() => { setRecording(false); setLog('cancelled'); }}
          onComplete={() => { setRecording(false); setLog('completed'); }}
        />
      </Box>
    </Col>
  );
};
Controls.args = { slideThresholdPx: 80 };
Controls.argTypes = { slideThresholdPx: number };
