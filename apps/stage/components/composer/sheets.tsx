import { useState, type ReactNode } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Button } from '@stage-labs/kit/react-native/button';
import { Box, Row, Col } from '../layout';
import { AppModal } from '../AppModal';
import { FormField, FORM_FIELD_RADIUS } from '../FormField';
import { usePalette } from '../../lib/theme';
import type { PostHooks } from './types';
import type { ComposerState } from './state';
import {
  sendPoll, sendSignatureRequest, sendTxRequest, type PostCtx,
  type PollDraft, type SignatureDraft, type PaymentDraft,
} from './builders';

const ACCENT = '#c0a06e';

interface SheetProps { open: boolean; onClose: () => void; dark: boolean; hooks: PostHooks }

function SheetShell({ open, onClose, dark, onSend, submitLabel, children }: {
  open: boolean; onClose: () => void; dark: boolean; onSend: () => void; submitLabel: string; children: ReactNode;
}): React.ReactElement {
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

function useDraft<T>(initial: T, { onClose, hooks }: SheetProps): [T, (patch: Partial<T>) => void, PostCtx] {
  const [draft, setDraft] = useState(initial);
  const patch = (p: Partial<T>): void => { setDraft(prev => ({ ...prev, ...p })); };
  return [draft, patch, { ...hooks, close: () => { onClose(); setDraft(initial); } }];
}

const EMPTY_POLL: PollDraft = { question: '', header: '', options: ['', ''], multi: false };

function PollSheet(props: SheetProps): React.ReactElement {
  const { text: fg, inputBg } = usePalette();
  const [d, patch, post] = useDraft(EMPTY_POLL, props);
  const setOptions = (options: string[]): void => { patch({ options }); };
  return (
    <SheetShell {...props} onSend={() => { void sendPoll(d, post); }} submitLabel="Send poll">
      <FormField label="Question" value={d.question} onChangeText={question => { patch({ question }); }} />
      <FormField label="Header (optional)" placeholder="e.g. LUNCH" value={d.header} onChangeText={header => { patch({ header }); }}
        inputProps={{ maxLength: 12, autoCapitalize: 'characters' }} />
      {d.options.map((opt, i) => (
        <FormField key={i} label={`Option ${i + 1}`} value={opt}
          onChangeText={t => { setOptions(d.options.map((o, j) => (j === i ? t : o))); }}
          trailing={d.options.length > 2 ? (
            <Pressable onPress={() => { setOptions(d.options.filter((_, j) => j !== i)); }} hitSlop={8}>
              <Icon name="x" size={18} color={fg}/>
            </Pressable>
          ) : undefined} />
      ))}
      <Button variant="ghost" size="sm" dark={props.dark} onPress={() => { setOptions([...d.options, '']); }}
        label="Add option" icon={<Icon name="plus" size={16} color={fg} />} />
      <Pressable onPress={() => { patch({ multi: !d.multi }); }}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
        <Text size="md" color={fg}>Allow multiple choices</Text>
        <Box width={44} height={26} radius="full" background={d.multi ? ACCENT : inputBg} padding={3} align={d.multi ? 'end' : 'start'}>
          <Box width={20} height={20} radius="full" background={'#ffffff'}/>
        </Box>
      </Pressable>
    </SheetShell>
  );
}

const EMPTY_SIGNATURE: SignatureDraft = { kind: 'personal', desc: '', message: '', json: '' };

function SignatureSheet(props: SheetProps): React.ReactElement {
  const { text: fg, inputBg, border } = usePalette();
  const [d, patch, post] = useDraft(EMPTY_SIGNATURE, props);
  return (
    <SheetShell {...props} onSend={() => { void sendSignatureRequest(d, post); }} submitLabel="Send request">
      <Row gap={8}>
        {([['personal', 'Message'], ['eip712', 'Typed data']] as const).map(([k, label]) => (
          <Pressable key={k} onPress={() => { patch({ kind: k }); }}
            style={{
              flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: FORM_FIELD_RADIUS,
              borderWidth: 1, borderColor: d.kind === k ? ACCENT : border,
              backgroundColor: d.kind === k ? 'rgba(192,160,110,0.15)' : inputBg,
            }}>
            <Text weight="semibold" size="sm" color={d.kind === k ? ACCENT : fg}>{label}</Text>
          </Pressable>
        ))}
      </Row>
      <FormField label="Description" placeholder="e.g. Sign in to dapp" value={d.desc} onChangeText={desc => { patch({ desc }); }} />
      {d.kind === 'personal' ? (
        <FormField label="Message to sign" multiline rows={3} value={d.message} onChangeText={message => { patch({ message }); }} />
      ) : (
        <FormField label="EIP-712 typed data" multiline rows={6} value={d.json} onChangeText={json => { patch({ json }); }}
          placeholder={'{ "domain": {…}, "types": {…}, "primaryType": "…", "message": {…} }'}
          inputProps={{ autoCapitalize: 'none', autoCorrect: false }} />
      )}
    </SheetShell>
  );
}

const EMPTY_PAYMENT: PaymentDraft = { to: '', amount: '', note: '' };

function PaymentSheet({ initialTo, ...props }: SheetProps & { initialTo?: string }): React.ReactElement {
  const [d, patch, post] = useDraft(EMPTY_PAYMENT, props);
  const [wasOpen, setWasOpen] = useState(props.open);
  if (props.open !== wasOpen) {
    setWasOpen(props.open);
    if (props.open && !d.to && initialTo !== undefined) patch({ to: initialTo });
  }
  return (
    <SheetShell {...props} onSend={() => { void sendTxRequest(d, post); }} submitLabel="Send request">
      <FormField label="Recipient" placeholder="0x…" value={d.to} onChangeText={to => { patch({ to }); }}
        inputProps={{ autoCapitalize: 'none', autoCorrect: false }} />
      <FormField label="Amount (ETH)" placeholder="0.0" value={d.amount} onChangeText={amount => { patch({ amount }); }} inputType="number"
        inputProps={{ keyboardType: 'decimal-pad' }} />
      <FormField label="Note (optional)" placeholder="What is it for?" value={d.note} onChangeText={note => { patch({ note }); }} />
    </SheetShell>
  );
}

export function ComposerSheets({ s, dark, hooks, initialTo }: {
  s: ComposerState; dark: boolean; hooks: PostHooks; initialTo?: string;
}): React.ReactElement {
  return (
    <>
      <PollSheet open={s.pollOpen} onClose={() => { s.setPollOpen(false); }} dark={dark} hooks={hooks} />
      <SignatureSheet open={s.sigOpen} onClose={() => { s.setSigOpen(false); }} dark={dark} hooks={hooks} />
      <PaymentSheet open={s.txOpen} onClose={() => { s.setTxOpen(false); }} dark={dark} hooks={hooks} initialTo={initialTo} />
    </>
  );
}
