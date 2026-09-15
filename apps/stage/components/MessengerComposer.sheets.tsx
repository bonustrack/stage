import type { ReactNode } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { fontSize, type FontSizeName } from '@stage-labs/kit/tokens';
import { Input, type InputProps } from '@stage-labs/kit/react-native/input';
import { Textarea } from '@stage-labs/kit/react-native/textarea';
import { Text } from '@stage-labs/kit/react-native/text';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Button } from '@stage-labs/kit/react-native/button';
import { Box, Row, Col } from './layout';
import { AppModal } from './AppModal';
import { usePalette, useBlockRadius } from '../lib/theme';
import { type Palette } from './MessengerComposer.types';

const ACCENT = '#c0a06e';

interface SheetProps { open: boolean; onClose: () => void; palette: Palette; dark: boolean; onSend: () => void }

function fieldStyle(palette: Palette, r: number, size: FontSizeName, extra?: object): object {
  return {
    color: palette.fg, backgroundColor: palette.inputBg, borderRadius: r, paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: 'Calibre-Medium', fontSize: fontSize(size), minHeight: 0, ...extra,
  };
}

function SheetShell({ open, onClose, dark, onSend, submitLabel, children }: SheetProps & { submitLabel: string; children: ReactNode }): React.ReactElement {
  const { primary, bg } = usePalette();
  return (
    <AppModal visible={open} onClose={onClose}>
      <Col padding={{ bottom: 8 }} gap={12}>
        {children}
        <Button size="lg" fullWidth dark={dark} onPress={onSend} label={submitLabel} tintBg={primary} tintFg={bg} style={{ marginTop: 4 }} />
      </Col>
    </AppModal>
  );
}

function SheetInput({ palette, dark, size = 'lg', flex, ...input }: {
  palette: Palette; dark: boolean; size?: FontSizeName; flex?: boolean;
  value: string; onChangeText: (v: string) => void; placeholder: string;
  inputType?: InputProps['inputType']; inputProps?: InputProps['inputProps'];
}): React.ReactElement {
  const r = useBlockRadius();
  return (
    <Input {...input} placeholderTextColor={palette.sub} dark={dark}
      style={fieldStyle(palette, r, size, flex === true ? { flex: 1 } : undefined)} />
  );
}

export function PollSheet({
  palette, dark, question, setQuestion, header, setHeader, options, setOptions, multi, setMulti, ...sheet
}: SheetProps & {
  question: string; setQuestion: (v: string) => void;
  header: string; setHeader: (v: string) => void;
  options: string[]; setOptions: React.Dispatch<React.SetStateAction<string[]>>;
  multi: boolean; setMulti: React.Dispatch<React.SetStateAction<boolean>>;
}): React.ReactElement {
  const { fg, sub, inputBg } = palette;
  const field = { palette, dark };
  return (
    <SheetShell {...sheet} palette={palette} dark={dark} submitLabel="Send poll">
      <SheetInput {...field} value={question} onChangeText={setQuestion} placeholder="Question" />
      <SheetInput {...field} value={header} onChangeText={setHeader} placeholder="Header (optional, e.g. LUNCH)" size="sm"
        inputProps={{ maxLength: 12, autoCapitalize: 'characters' }} />
      {options.map((opt, i) => (
        <Row key={i} align="center" gap={8}>
          <SheetInput {...field} flex value={opt} placeholder={`Option ${i + 1}`}
            onChangeText={t => { setOptions(prev => prev.map((o, j) => (j === i ? t : o))); }} />
          {options.length > 2 ? (
            <Pressable onPress={() => { setOptions(prev => prev.filter((_, j) => j !== i)); }} hitSlop={8}>
              <Icon name="x" size={18} color={sub}/>
            </Pressable>
          ) : null}
        </Row>
      ))}
      <Button variant="ghost" size="sm" dark={dark} onPress={() => { setOptions(prev => [...prev, '']); }}
        label="Add option" icon={<Icon name="plus" size={16} color={fg} />} />
      <Pressable onPress={() => { setMulti(m => !m); }}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
        <Text size="md" color={fg}>Allow multiple choices</Text>
        <Box width={44} height={26} radius="full" background={multi ? ACCENT : inputBg} padding={3} align={multi ? 'end' : 'start'}>
          <Box width={20} height={20} radius="full" background={'#ffffff'}/>
        </Box>
      </Pressable>
    </SheetShell>
  );
}

export function SignatureSheet({
  palette, dark, kind, setKind, desc, setDesc, message, setMessage, json, setJson, ...sheet
}: SheetProps & {
  kind: 'personal' | 'eip712'; setKind: (k: 'personal' | 'eip712') => void;
  desc: string; setDesc: (v: string) => void;
  message: string; setMessage: (v: string) => void;
  json: string; setJson: (v: string) => void;
}): React.ReactElement {
  const { fg, sub, inputBg, chipBg } = palette;
  const r = useBlockRadius();
  const textarea = (minHeight: number, size: FontSizeName): object =>
    fieldStyle(palette, r, size, { minHeight, height: undefined, textAlignVertical: 'top' });
  return (
    <SheetShell {...sheet} palette={palette} dark={dark} submitLabel="Send request">
      <Row gap={8}>
        {([['personal', 'Message'], ['eip712', 'Typed data']] as const).map(([k, label]) => (
          <Pressable key={k} onPress={() => { setKind(k); }}
            style={{
              flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: r,
              borderWidth: 1, borderColor: kind === k ? ACCENT : chipBg,
              backgroundColor: kind === k ? 'rgba(192,160,110,0.15)' : inputBg,
            }}>
            <Text weight="semibold" size="sm" color={kind === k ? ACCENT : fg}>{label}</Text>
          </Pressable>
        ))}
      </Row>
      <SheetInput palette={palette} dark={dark} value={desc} onChangeText={setDesc} placeholder="Description (e.g. Sign in to dapp)" size="md" />
      {kind === 'personal' ? (
        <Textarea value={message} onChangeText={setMessage} placeholder="Message to sign" placeholderTextColor={sub} dark={dark}
          style={textarea(80, 'md')} />
      ) : (
        <Textarea value={json} onChangeText={setJson} placeholderTextColor={sub} dark={dark}
          placeholder={'EIP-712 typed data JSON\n{ "domain": {…}, "types": {…}, "primaryType": "…", "message": {…} }'}
          inputProps={{ autoCapitalize: 'none', autoCorrect: false }} style={textarea(160, 'xs')} />
      )}
    </SheetShell>
  );
}

export function PaymentSheet({
  palette, dark, to, setTo, amount, setAmount, note, setNote, ...sheet
}: SheetProps & {
  to: string; setTo: (v: string) => void;
  amount: string; setAmount: (v: string) => void;
  note: string; setNote: (v: string) => void;
}): React.ReactElement {
  const field = { palette, dark };
  return (
    <SheetShell {...sheet} palette={palette} dark={dark} submitLabel="Send request">
      <SheetInput {...field} value={to} onChangeText={setTo} placeholder="Recipient address (0x…)" size="sm"
        inputProps={{ autoCapitalize: 'none', autoCorrect: false }} />
      <SheetInput {...field} value={amount} onChangeText={setAmount} placeholder="Amount (ETH)" inputType="number"
        inputProps={{ keyboardType: 'decimal-pad' }} />
      <SheetInput {...field} value={note} onChangeText={setNote} placeholder="Note (optional)" />
    </SheetShell>
  );
}
