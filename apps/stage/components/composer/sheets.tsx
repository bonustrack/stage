import type { ReactNode } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Button } from '@stage-labs/kit/react-native/button';
import { Box, Row, Col } from '../layout';
import { AppModal } from '../AppModal';
import { FormField, FORM_FIELD_RADIUS } from '../FormField';
import { usePalette } from '../../lib/theme';
import { type Palette } from './types';
import type { ComposerState } from './state';

const ACCENT = '#c0a06e';

interface SheetProps { open: boolean; onClose: () => void; palette: Palette; dark: boolean; onSend: () => void }

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

export function PollSheet({
  palette, dark, question, setQuestion, header, setHeader, options, setOptions, multi, setMulti, ...sheet
}: SheetProps & {
  question: string; setQuestion: (v: string) => void;
  header: string; setHeader: (v: string) => void;
  options: string[]; setOptions: React.Dispatch<React.SetStateAction<string[]>>;
  multi: boolean; setMulti: React.Dispatch<React.SetStateAction<boolean>>;
}): React.ReactElement {
  const { fg, sub, inputBg } = palette;
  return (
    <SheetShell {...sheet} palette={palette} dark={dark} submitLabel="Send poll">
      <FormField label="Question" value={question} onChangeText={setQuestion} />
      <FormField label="Header (optional)" placeholder="e.g. LUNCH" value={header} onChangeText={setHeader}
        inputProps={{ maxLength: 12, autoCapitalize: 'characters' }} />
      {options.map((opt, i) => (
        <FormField key={i} label={`Option ${i + 1}`} value={opt}
          onChangeText={t => { setOptions(prev => prev.map((o, j) => (j === i ? t : o))); }}
          trailing={options.length > 2 ? (
            <Pressable onPress={() => { setOptions(prev => prev.filter((_, j) => j !== i)); }} hitSlop={8}>
              <Icon name="x" size={18} color={sub}/>
            </Pressable>
          ) : undefined} />
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
  const { fg, inputBg, chipBg } = palette;
  return (
    <SheetShell {...sheet} palette={palette} dark={dark} submitLabel="Send request">
      <Row gap={8}>
        {([['personal', 'Message'], ['eip712', 'Typed data']] as const).map(([k, label]) => (
          <Pressable key={k} onPress={() => { setKind(k); }}
            style={{
              flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: FORM_FIELD_RADIUS,
              borderWidth: 1, borderColor: kind === k ? ACCENT : chipBg,
              backgroundColor: kind === k ? 'rgba(192,160,110,0.15)' : inputBg,
            }}>
            <Text weight="semibold" size="sm" color={kind === k ? ACCENT : fg}>{label}</Text>
          </Pressable>
        ))}
      </Row>
      <FormField label="Description" placeholder="e.g. Sign in to dapp" value={desc} onChangeText={setDesc} />
      {kind === 'personal' ? (
        <FormField label="Message to sign" multiline rows={3} value={message} onChangeText={setMessage} />
      ) : (
        <FormField label="EIP-712 typed data" multiline rows={6} value={json} onChangeText={setJson}
          placeholder={'{ "domain": {…}, "types": {…}, "primaryType": "…", "message": {…} }'}
          inputProps={{ autoCapitalize: 'none', autoCorrect: false }} />
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
  return (
    <SheetShell {...sheet} palette={palette} dark={dark} submitLabel="Send request">
      <FormField label="Recipient" placeholder="0x…" value={to} onChangeText={setTo}
        inputProps={{ autoCapitalize: 'none', autoCorrect: false }} />
      <FormField label="Amount (ETH)" placeholder="0.0" value={amount} onChangeText={setAmount} inputType="number"
        inputProps={{ keyboardType: 'decimal-pad' }} />
      <FormField label="Note (optional)" placeholder="What is it for?" value={note} onChangeText={setNote} />
    </SheetShell>
  );
}

interface SheetActions {
  sendPoll: () => void;
  sendSignatureRequest: () => void;
  sendTxRequest: () => void;
}

export function ComposerSheets({ s, palette, dark, actions }: {
  s: ComposerState; palette: Palette; dark: boolean; actions: SheetActions;
}): React.ReactElement {
  return (
    <>
      <PollSheet
        open={s.pollOpen} onClose={() => { s.setPollOpen(false); }} palette={palette} dark={dark}
        question={s.pollQuestion} setQuestion={s.setPollQuestion}
        header={s.pollHeader} setHeader={s.setPollHeader}
        options={s.pollOptions} setOptions={s.setPollOptions}
        multi={s.pollMulti} setMulti={s.setPollMulti}
        onSend={actions.sendPoll}
      />
      <SignatureSheet
        open={s.sigOpen} onClose={() => { s.setSigOpen(false); }} palette={palette} dark={dark}
        kind={s.sigKind} setKind={s.setSigKind}
        desc={s.sigDesc} setDesc={s.setSigDesc}
        message={s.sigMessage} setMessage={s.setSigMessage}
        json={s.sigJson} setJson={s.setSigJson}
        onSend={actions.sendSignatureRequest}
      />
      <PaymentSheet
        open={s.txOpen} onClose={() => { s.setTxOpen(false); }} palette={palette} dark={dark}
        to={s.txTo} setTo={s.setTxTo}
        amount={s.txAmount} setAmount={s.setTxAmount}
        note={s.txNote} setNote={s.setTxNote}
        onSend={actions.sendTxRequest}
      />
    </>
  );
}
