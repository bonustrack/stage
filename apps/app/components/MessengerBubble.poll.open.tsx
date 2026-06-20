
import { useState } from 'react';
import { fontSize } from '@stage-labs/kit/tokens';
import { Input } from '@stage-labs/kit/input';
import { Text } from '@stage-labs/kit/text';
import { Button } from '@stage-labs/kit/button';
import { Row, Box } from './layout';
import { usePalette, useBlockRadius, withAlpha } from '../lib/theme';

export function OpenAnswerBlock({ qi, sub, dark, answers, mine, onSubmit }: {
  qi: number; sub: string; dark: boolean;
  answers?: Map<string, { text: string; ts: string }>;
  mine?: string; onSubmit: (text: string) => void;
}): React.ReactElement {
  const pal = usePalette();
  const radius = useBlockRadius();
  const [draft, setDraft] = useState('');
  const list = answers ? [...answers.entries()].sort((a, b) => a[1].ts.localeCompare(b[1].ts)) : [];
  const submit = (): void => { onSubmit(draft); setDraft(''); };
  const inputBg = pal.inputBg;
  return (
    <Box margin={{ top: 2 }} gap={6} style={{ alignSelf: 'stretch' }}>
      <Row align="center" gap={8} style={{ alignSelf: 'stretch' }}>
        <Input
          value={draft}
          onChangeText={setDraft}
          onSubmit={submit}
          placeholder="Type your answer"
          placeholderTextColor={sub}
          dark={dark}
          inputProps={{ returnKeyType: 'send' }}
          style={{
            flex: 1, color: pal.text, fontSize: fontSize('xl'), fontFamily: 'Calibre-Medium',
            paddingHorizontal: 12, paddingVertical: 9, borderRadius: radius,
            borderWidth: 0, backgroundColor: inputBg, minHeight: 0,
          }}
/>
        <Button
          variant="primary"
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
