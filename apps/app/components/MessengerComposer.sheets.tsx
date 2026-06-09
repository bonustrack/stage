/** Builder sheets for the MessengerComposer: poll, signature-request, and
 *  payment-request. Extracted from MessengerComposer.tsx for readability; the
 *  JSX + behavior are identical — state is owned by the parent and threaded via
 *  props. */

import { Pressable } from '@metro-labs/kit/pressable';
import { fontSize } from '@metro-labs/kit/tokens';
import { Input } from '@metro-labs/kit/input';
import { Textarea } from '@metro-labs/kit/textarea';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Button } from '@metro-labs/kit/button';
import { Box, Row, Col } from './layout';
import { AppModal } from './AppModal';
import { usePalette, useBlockRadius } from '../lib/theme';
import { type Palette } from './MessengerComposer.helpers';

export function PollSheet({
  open, onClose, palette, dark, question, setQuestion, header, setHeader,
  options, setOptions, multi, setMulti, onSend,
}: {
  open: boolean; onClose: () => void; palette: Palette; dark: boolean;
  question: string; setQuestion: (v: string) => void;
  header: string; setHeader: (v: string) => void;
  options: string[]; setOptions: React.Dispatch<React.SetStateAction<string[]>>;
  multi: boolean; setMulti: React.Dispatch<React.SetStateAction<boolean>>;
  onSend: () => void;
}): React.ReactElement {
  const { fg, sub, inputBg } = palette;
  const { primary, bg } = usePalette();
  const r = useBlockRadius();
  return (
    <AppModal visible={open} onClose={onClose}>
      <Col gap={12} pb={8}>
        <Input
          value={question}
          onChangeText={setQuestion}
          placeholder="Question"
          placeholderTextColor={sub}
          dark={dark}
          style={{ color: fg, backgroundColor: inputBg, borderRadius: r, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Calibre-Medium', fontSize: fontSize('lg'), minHeight: 0 }}
        />
        <Input
          value={header}
          onChangeText={setHeader}
          placeholder="Header (optional, e.g. LUNCH)"
          placeholderTextColor={sub}
          dark={dark}
          inputProps={{ maxLength: 12, autoCapitalize: 'characters' }}
          style={{ color: fg, backgroundColor: inputBg, borderRadius: r, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Calibre-Medium', fontSize: fontSize('sm'), minHeight: 0 }}
        />
        {options.map((opt, i) => (
          <Row key={i} align="center" gap={8}>
            <Input
              value={opt}
              onChangeText={t => setOptions(prev => prev.map((o, j) => (j === i ? t : o)))}
              placeholder={`Option ${i + 1}`}
              placeholderTextColor={sub}
              dark={dark}
              style={{ flex: 1, color: fg, backgroundColor: inputBg, borderRadius: r, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Calibre-Medium', fontSize: fontSize('lg'), minHeight: 0 }}
            />
            {options.length > 2 ? (
              <Pressable onPress={() => setOptions(prev => prev.filter((_, j) => j !== i))} hitSlop={8}>
                <Icon name="x" size={18} color={sub} />
              </Pressable>
            ) : null}
          </Row>
        ))}
        <Button
          variant="ghost"
          size="sm"
          dark={dark}
          onPress={() => setOptions(prev => [...prev, ''])}
          label="Add option"
          icon={<Icon name="plus" size={16} color={fg} />}
        />
        <Pressable
          onPress={() => setMulti(m => !m)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}
        >
          <Text size="md" color={fg}>Allow multiple choices</Text>
          <Box style={{
            width: 44, height: 26, borderRadius: 999, padding: 3,
            backgroundColor: multi ? '#c0a06e' : inputBg,
            alignItems: multi ? 'flex-end' : 'flex-start',
          }}>
            <Box style={{ width: 20, height: 20, borderRadius: 999, backgroundColor: '#ffffff' }} />
          </Box>
        </Pressable>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          dark={dark}
          onPress={onSend}
          label="Send poll"
          tintBg={primary}
          tintFg={bg}
          style={{ marginTop: 4 }}
        />
      </Col>
    </AppModal>
  );
}

export function SignatureSheet({
  open, onClose, palette, dark, kind, setKind, desc, setDesc,
  message, setMessage, json, setJson, onSend,
}: {
  open: boolean; onClose: () => void; palette: Palette; dark: boolean;
  kind: 'personal' | 'eip712'; setKind: (k: 'personal' | 'eip712') => void;
  desc: string; setDesc: (v: string) => void;
  message: string; setMessage: (v: string) => void;
  json: string; setJson: (v: string) => void;
  onSend: () => void;
}): React.ReactElement {
  const { fg, sub, inputBg, chipBg } = palette;
  const { primary, bg } = usePalette();
  const r = useBlockRadius();
  return (
    <AppModal visible={open} onClose={onClose}>
      <Col gap={12} pb={8}>
        <Row gap={8}>
          {([['personal', 'Message'], ['eip712', 'Typed data']] as const).map(([k, label]) => (
            <Pressable
              key={k}
              onPress={() => setKind(k)}
              style={{
                flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: r,
                borderWidth: 1, borderColor: kind === k ? '#c0a06e' : chipBg,
                backgroundColor: kind === k ? 'rgba(192,160,110,0.15)' : inputBg,
              }}
            >
              <Text weight="semibold" size="sm" color={kind === k ? '#c0a06e' : fg}>{label}</Text>
            </Pressable>
          ))}
        </Row>
        <Input
          value={desc}
          onChangeText={setDesc}
          placeholder="Description (e.g. Sign in to dapp)"
          placeholderTextColor={sub}
          dark={dark}
          style={{ color: fg, backgroundColor: inputBg, borderRadius: r, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Calibre-Medium', fontSize: fontSize('md'), minHeight: 0 }}
        />
        {kind === 'personal' ? (
          <Textarea
            value={message}
            onChangeText={setMessage}
            placeholder="Message to sign"
            placeholderTextColor={sub}
            dark={dark}
            style={{ color: fg, backgroundColor: inputBg, borderRadius: r, paddingHorizontal: 12, paddingVertical: 10, minHeight: 80, height: undefined, fontFamily: 'Calibre-Medium', fontSize: fontSize('md'), textAlignVertical: 'top' }}
          />
        ) : (
          <Textarea
            value={json}
            onChangeText={setJson}
            placeholder={'EIP-712 typed data JSON\n{ "domain": {…}, "types": {…}, "primaryType": "…", "message": {…} }'}
            placeholderTextColor={sub}
            dark={dark}
            inputProps={{ autoCapitalize: 'none', autoCorrect: false }}
            style={{ color: fg, backgroundColor: inputBg, borderRadius: r, paddingHorizontal: 12, paddingVertical: 10, minHeight: 160, height: undefined, fontFamily: 'Calibre-Medium', fontSize: fontSize('xs'), textAlignVertical: 'top' }}
          />
        )}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          dark={dark}
          onPress={onSend}
          label="Send request"
          tintBg={primary}
          tintFg={bg}
          style={{ marginTop: 4 }}
        />
      </Col>
    </AppModal>
  );
}

export function PaymentSheet({
  open, onClose, palette, dark, to, setTo, amount, setAmount, note, setNote, onSend,
}: {
  open: boolean; onClose: () => void; palette: Palette; dark: boolean;
  to: string; setTo: (v: string) => void;
  amount: string; setAmount: (v: string) => void;
  note: string; setNote: (v: string) => void;
  onSend: () => void;
}): React.ReactElement {
  const { fg, sub, inputBg } = palette;
  const { primary, bg } = usePalette();
  const r = useBlockRadius();
  return (
    <AppModal visible={open} onClose={onClose}>
      <Col gap={12} pb={8}>
        <Input
          value={to}
          onChangeText={setTo}
          placeholder="Recipient address (0x…)"
          placeholderTextColor={sub}
          dark={dark}
          inputProps={{ autoCapitalize: 'none', autoCorrect: false }}
          style={{ color: fg, backgroundColor: inputBg, borderRadius: r, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Calibre-Medium', fontSize: fontSize('sm'), minHeight: 0 }}
        />
        <Input
          value={amount}
          onChangeText={setAmount}
          placeholder="Amount (ETH)"
          placeholderTextColor={sub}
          inputType="number"
          dark={dark}
          inputProps={{ keyboardType: 'decimal-pad' }}
          style={{ color: fg, backgroundColor: inputBg, borderRadius: r, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Calibre-Medium', fontSize: fontSize('lg'), minHeight: 0 }}
        />
        <Input
          value={note}
          onChangeText={setNote}
          placeholder="Note (optional)"
          placeholderTextColor={sub}
          dark={dark}
          style={{ color: fg, backgroundColor: inputBg, borderRadius: r, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Calibre-Medium', fontSize: fontSize('lg'), minHeight: 0 }}
        />
        <Button
          variant="primary"
          size="lg"
          fullWidth
          dark={dark}
          onPress={onSend}
          label="Send request"
          tintBg={primary}
          tintFg={bg}
          style={{ marginTop: 4 }}
        />
      </Col>
    </AppModal>
  );
}
