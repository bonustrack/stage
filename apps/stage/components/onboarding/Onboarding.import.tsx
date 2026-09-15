import { useState } from 'react';
import type { AccountTransfer } from '@stage-labs/client/accounts/transfer';
import { fontSize } from '@stage-labs/kit/tokens';
import { Title } from '@stage-labs/kit/react-native/title';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { Textarea } from '@stage-labs/kit/react-native/textarea';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Col, Box, Row } from '../layout';
import { usePalette, DANGER } from '../../lib/theme';
import { QrScanner } from '../accounts/QrScanner';
import { parseImportInput } from '../accounts/ImportAccountPanel.model';
import {
  acceptTypedChar, applyCompletion, currentToken, invalidWords, looksLikePhrase, suggestWords,
} from './RecoveryPhrase.model';

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

function inputHint(text: string, err: string | null): { text: string; danger: boolean } | null {
  if (err !== null) return { text: err, danger: true };
  if (!looksLikePhrase(text)) return null;
  const invalid = invalidWords(text);
  if (invalid.length > 0) return { text: `Not in the word list: ${invalid.join(', ')}`, danger: true };
  const count = text.trim().split(/\s+/).filter((w) => w.length > 0).length;
  return count > 0 ? { text: `${count} of 12 to 24 words`, danger: false } : null;
}

export function ImportStep({ pal, dark, busy, onTransfer, onBack }: {
  pal: Pal; dark: boolean; busy: boolean;
  onTransfer: (transfer: AccountTransfer) => void; onBack: () => void;
}): React.ReactElement {
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const token = currentToken(text);
  const suggestions = looksLikePhrase(text) ? suggestWords(token.word) : [];
  const hint = inputHint(text, err);
  const submit = (raw: string): void => {
    const parsed = parseImportInput(raw);
    if (!parsed.ok) { setErr(parsed.error); return; }
    setErr(null);
    onTransfer(parsed.transfer);
  };
  const phraseField = (
    <>
      <Text size="sm" color={pal.sub} style={{ marginTop: 8, marginBottom: 14 }}>
        Enter your 12-24 word recovery phrase, or scan the code shown by Move to another device on your other device.
      </Text>
      <Textarea
        value={text}
        onChangeText={(t) => { setText((prev) => acceptTypedChar(prev, t)); setErr(null); }}
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
      <SuggestionChips words={suggestions} pal={pal} onPick={(word) => { setText(applyCompletion(text, word)); }} />
      {hint === null ? null : (
        <Text size="xs" color={hint.danger ? DANGER : pal.sub} style={{ marginTop: 8 }}>{hint.text}</Text>
      )}
    </>
  );
  return (
    <Col flex={1} justify="between" gap={24}>
      <Box padding={{ top: 8 }} gap={scanning ? 16 : 0}>
        <Title level={2} color={pal.primary}>Import wallet</Title>
        {scanning ? <QrScanner dark={dark} onScan={(code) => { setScanning(false); setText(code); submit(code); }} /> : phraseField}
      </Box>
      <Col gap={10}>
        {scanning ? (
          <Button dark={dark} variant="soft" color="primary" size="lg" fullWidth label="Stop scanning" disabled={busy}
            onPress={() => { setScanning(false); }} />
        ) : (
          <>
            <Button dark={dark} size="lg" fullWidth tintBg={pal.primary} tintFg={pal.bg}
              label="Continue" disabled={busy || text.trim().length === 0} onPress={() => { submit(text); }} />
            <Button dark={dark} variant="soft" color="primary" size="lg" fullWidth label="Scan QR code"
              iconStart={<Icon name="qrcode" size={20} color={pal.primary} />}
              disabled={busy} onPress={() => { setScanning(true); }} />
          </>
        )}
        <Button dark={dark} variant="ghost" size="lg" fullWidth label="Back" disabled={busy} onPress={onBack} />
      </Col>
    </Col>
  );
}
