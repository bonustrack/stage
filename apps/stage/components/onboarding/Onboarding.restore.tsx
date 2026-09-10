import { fontSize } from '@stage-labs/kit/tokens';
import { Title } from '@stage-labs/kit/react-native/title';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { Textarea } from '@stage-labs/kit/react-native/textarea';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Col, Box, Row } from '../layout';
import { usePalette, DANGER } from '../../lib/theme';
import { applyCompletion, currentToken, invalidWords, suggestWords } from './RecoveryPhrase.model';

type Pal = ReturnType<typeof usePalette>;

function SuggestionChips({ words, pal, onPick }: {
  words: string[]; pal: Pal; onPick: (word: string) => void;
}): React.ReactElement | null {
  if (words.length === 0) return null;
  return (
    <Row gap={8} wrap padding={{ top: 10 }}>
      {words.map((word) => (
        <Pressable
          key={word}
          onPress={() => { onPick(word); }}
          hitSlop={6}
          style={({ pressed }) => ({
            paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
            borderWidth: 1, borderColor: pal.border,
            backgroundColor: pressed ? pal.border : 'transparent',
          })}
        >
          <Text size="sm" color={pal.primary}>{word}</Text>
        </Pressable>
      ))}
    </Row>
  );
}

function phraseHint(phrase: string, err: string): { text: string; danger: boolean } | null {
  if (err) return { text: err, danger: true };
  const invalid = invalidWords(phrase);
  if (invalid.length > 0) return { text: `Not in the word list: ${invalid.join(', ')}`, danger: true };
  const count = phrase.trim().split(/\s+/).filter((w) => w.length > 0).length;
  return count > 0 ? { text: `${count} of 12 to 24 words`, danger: false } : null;
}

export function RestoreStep({ pal, dark, busy, phrase, err, onChange, onNext, onBack }: {
  pal: Pal; dark: boolean; busy: boolean; phrase: string; err: string;
  onChange: (t: string) => void; onNext: () => void; onBack: () => void;
}): React.ReactElement {
  const token = currentToken(phrase);
  const suggestions = suggestWords(token.word);
  const hint = phraseHint(phrase, err);
  return (
    <Col flex={1} justify="between">
      <Box padding={{ top: 8 }}>
        <Title level={2} color={pal.primary}>Restore wallet</Title>
        <Text size="sm" color={pal.sub} style={{ marginTop: 8, marginBottom: 14 }}>
          Enter your 12-24 word recovery phrase. Words complete themselves once the first letters are unambiguous.
        </Text>
        <Textarea
          value={phrase}
          onChangeText={onChange}
          placeholder="word1 word2 word3 ..."
          placeholderTextColor={pal.sub}
          dark={dark}
          inputProps={{ autoCapitalize: 'none', autoCorrect: false }}
          style={{
            color: pal.text, fontFamily: 'Menlo', fontSize: fontSize('sm'),
            minHeight: 110, height: undefined,
            borderWidth: 1, borderColor: pal.border, borderRadius: 12,
            paddingHorizontal: 12, paddingVertical: 12,
            textAlignVertical: 'top', backgroundColor: 'transparent',
          }}
        />
        <SuggestionChips words={suggestions} pal={pal} onPick={(word) => { onChange(applyCompletion(phrase, word)); }} />
        {hint === null ? null : (
          <Text size="xs" color={hint.danger ? DANGER : pal.sub} style={{ marginTop: 8 }}>{hint.text}</Text>
        )}
      </Box>
      <Col gap={10}>
        <Button dark={dark} size="lg" fullWidth tintBg={pal.primary} tintFg={pal.bg}
          label="Continue" disabled={busy || !phrase.trim()} onPress={onNext} />
        <Button dark={dark} variant="ghost" size="lg" fullWidth label="Back" disabled={busy} onPress={onBack} />
      </Col>
    </Col>
  );
}
