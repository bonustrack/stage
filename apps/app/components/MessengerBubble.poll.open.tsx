/** Open free-text answer block for a poll question (AskUserQuestion open type):
 *  a Kit-styled input + send Button, with the submitted answers listed below.
 *  Submitting an empty box retracts the local user's prior answer. Split out of
 *  MessengerBubble.poll.tsx to keep each file under the lint line cap. */

import { useState } from 'react';
import { fontSize } from '@metro-labs/kit/tokens';
import { Input } from '@metro-labs/kit/input';
import { Text } from '@metro-labs/kit/text';
import { Button } from '@metro-labs/kit/button';
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
  // Borderless input: neutral overlay fill + radius so it still reads as an
  // input, but no visible outline. Body text in the palette text token.
  const inputBg = pal.inputBg;
  return (
    <Box style={{ alignSelf: 'stretch', gap: 6, marginTop: 2 }}>
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
            flex: 1, color: pal.text, fontSize: fontSize('lg'), fontFamily: 'Calibre-Medium',
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
        <Box
          key={`${qi}-${voter}`}
          style={{
            alignSelf: 'stretch', paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius,
            backgroundColor: voter === mine
              ? withAlpha(pal.link, dark ? 0.18 : 0.14)
              : (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
          }}
        >
          <Text size="md" style={{ color: pal.text, fontFamily: 'Calibre-Medium' }}>
            {voter === mine ? 'You: ' : ''}{a.text}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
