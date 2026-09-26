import { useState } from 'react';
import type { AccountTransfer } from '@stage-labs/client/accounts/transfer';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Row } from '../layout';
import { FormField } from '../FormField';
import { OnboardingCard } from './OnboardingCard';
import { usePalette, DANGER } from '../../lib/theme';
import { QrScanner } from '../accounts/QrScanner';
import { parseImportInput } from '../accounts/ImportAccountPanel.model';
import {
  replaceWordAt, typePhrase, wordAt, type PhraseTyping, invalidWords, looksLikePhrase, visibleSuggestions,
} from './RecoveryPhrase.model';
import { IconQrCode } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconQrCode';

function SuggestionChips({ words, onPick }: {
  words: string[]; onPick: (word: string) => void;
}): React.ReactElement | null {
  const pal = usePalette();
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

const IMPORT_ABOUT = 'Enter your 12-24 word recovery phrase, or scan the code shown by Link a device on your other device.';

const SCANNED_COPY = 'QR code scanned. Importing your account...';

export function ImportStep({ dark, busy, onTransfer }: {
  dark: boolean; busy: boolean;
  onTransfer: (transfer: AccountTransfer) => void;
}): React.ReactElement {
  const pal = usePalette();
  const [typing, setTyping] = useState<PhraseTyping>({ text: '', pending: '' });
  const text = typing.text;
  const setText = (value: string): void => { setTyping({ text: value, pending: '' }); };
  const [err, setErr] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [placeCursor, setPlaceCursor] = useState<number | null>(null);
  const span = wordAt(text, cursor);
  const suggestions = looksLikePhrase(text) ? visibleSuggestions(span.word) : [];
  const pickSuggestion = (word: string): void => {
    const next = replaceWordAt(text, span, word);
    setText(next.text);
    setCursor(next.cursor);
    setPlaceCursor(next.cursor);
  };
  const hint = inputHint(text, err);
  const submit = (raw: string): void => {
    const parsed = parseImportInput(raw);
    if (!parsed.ok) { setErr(parsed.error); return; }
    setErr(null);
    onTransfer(parsed.transfer);
  };
  const onScan = (code: string): void => {
    setScanning(false);
    const parsed = parseImportInput(code);
    setScanned(parsed.ok);
    submit(code);
  };
  const phraseField = (
    <>
      <FormField label="Recovery phrase" placeholder="word1 word2 word3 ..." multiline rows={4} value={text}
        onChangeText={(t) => { const next = typePhrase(typing, t); setTyping(next); if (t.startsWith(typing.text)) setCursor(next.text.length); setErr(null); }}
        inputProps={{
          autoCapitalize: 'none', autoCorrect: false,
          onSelectionChange: (e) => { setCursor(e.nativeEvent.selection.end); setPlaceCursor(null); },
          ...(placeCursor === null ? {} : { selection: { start: placeCursor, end: placeCursor } }),
        }} />
      <SuggestionChips words={suggestions} onPick={pickSuggestion} />
      {hint === null ? null : (
        <Text size="xs" color={hint.danger ? DANGER : pal.sub} style={{ marginTop: 8 }}>{hint.text}</Text>
      )}
    </>
  );
  const footer = (
    <>
      {scanning ? (
        <Button dark={dark} variant="soft" color="primary" size="lg" fullWidth pill label="Stop scanning" disabled={busy}
          onPress={() => { setScanning(false); }} />
      ) : (
        <>
          <Button dark={dark} size="lg" fullWidth pill tintBg={pal.primary} tintFg={pal.bg}
            label="Continue" disabled={busy || text.trim().length === 0} onPress={() => { submit(text); }} />
          <Button dark={dark} variant="soft" color="primary" size="lg" fullWidth pill label="Scan QR code"
            iconStart={<Glyph icon={IconQrCode} size={20} color={pal.primary} />}
            disabled={busy} onPress={() => { setScanned(false); setScanning(true); }} />
        </>
      )}
    </>
  );
  return (
    <OnboardingCard title="Import wallet" about={IMPORT_ABOUT} footer={footer}>
      {scanning ? <QrScanner dark={dark} onScan={onScan} /> : scanned ? (
        <Text size="md" color={pal.sub} textAlign="center">{SCANNED_COPY}</Text>
      ) : phraseField}
    </OnboardingCard>
  );
}
