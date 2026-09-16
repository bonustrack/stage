
import { useState } from 'react';
import { FormField } from '../FormField';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { Row, Box } from '../layout';
import { usePalette, useBlockRadius, withAlpha } from '../../lib/theme';

export function OpenAnswerBlock({ qi, dark, answers, mine, onSubmit }: {
  qi: number; dark: boolean;
  answers?: Map<string, { text: string; ts: string }>;
  mine?: string; onSubmit: (text: string) => void;
}): React.ReactElement {
  const pal = usePalette();
  const radius = useBlockRadius();
  const [draft, setDraft] = useState('');
  const list = answers ? [...answers.entries()].sort((a, b) => a[1].ts.localeCompare(b[1].ts)) : [];
  const submit = (): void => { onSubmit(draft); setDraft(''); };
  return (
    <Box margin={{ top: 2 }} gap={6} style={{ alignSelf: 'stretch' }}>
      <Row align="center" gap={8} style={{ alignSelf: 'stretch' }}>
        <Box flex={1}>
          <FormField label="Your answer" placeholder="Type your answer" value={draft} onChangeText={setDraft} onSubmit={submit}
            inputProps={{ returnKeyType: 'send' }} />
        </Box>
        <Button
          size="md"
          dark={dark}
          disabled={draft.trim().length === 0}
          onPress={submit}
          label="Send"
/>
      </Row>
      {list.map(([voter, a]) => (
        <Box radius={radius} background={voter === mine
              ? withAlpha(pal.link, dark ? 0.18 : 0.14)
              : (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)')} padding={{ x: 12, y: 7 }}
          key={`${qi}-${voter}`}
          style={{ alignSelf: 'stretch' }}
>
          <Text size="lg" color={pal.text}>
            {voter === mine ? 'You: ' : ''}{a.text}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
