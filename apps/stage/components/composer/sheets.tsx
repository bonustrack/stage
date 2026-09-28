import { useState, type ReactNode } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Button } from '@stage-labs/kit/react-native/button';
import { Switch } from '@stage-labs/kit/react-native/switch';
import { Box, Row, Col } from '../layout';
import { AppModal } from '../AppModal';
import { FormField } from '../FormField';
import { LabelChip } from '../LabelChip';
import { usePalette } from '../../lib/theme';
import type { PostHooks } from './types';
import type { ComposerState } from './state';
import {
  sendPoll, sendSignatureRequest, sendTxRequest, type PostCtx,
  type PollDraft, type SignatureDraft, type PaymentDraft,
} from './builders';
import { SIGNATURE_KINDS, canSendPayment, canSendPoll, canSendSignature } from './sheets.model';
import { IconCrossMedium } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCrossMedium';
import { IconPlusLarge } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPlusLarge';

interface SheetProps { open: boolean; onClose: () => void; dark: boolean; hooks: PostHooks }

function SheetShell({ open, onClose, dark, title, onSend, submitLabel, canSend, children }: {
  open: boolean; onClose: () => void; dark: boolean; title: string;
  onSend: () => void; submitLabel: string; canSend: boolean; children: ReactNode;
}): React.ReactElement {
  const { primary, bg } = usePalette();
  return (
    <AppModal visible={open} onClose={onClose} title={title}>
      <Col gap={8}>
        {children}
        <Box padding={{ top: 8 }}>
          <Button size="lg" fullWidth dark={dark} disabled={!canSend} onPress={onSend} label={submitLabel} tintBg={primary} tintFg={bg} />
        </Box>
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
  const { text: fg } = usePalette();
  const [d, patch, post] = useDraft(EMPTY_POLL, props);
  const setOptions = (options: string[]): void => { patch({ options }); };
  return (
    <SheetShell {...props} title="New poll" onSend={() => { void sendPoll(d, post); }} submitLabel="Send poll" canSend={canSendPoll(d)}>
      <FormField label="Question" value={d.question} onChangeText={question => { patch({ question }); }} />
      <FormField label="Header (optional)" placeholder="e.g. LUNCH" value={d.header} onChangeText={header => { patch({ header }); }}
        inputProps={{ maxLength: 12, autoCapitalize: 'characters' }} />
      {d.options.map((opt, i) => (
        <FormField key={i} label={`Option ${i + 1}`} value={opt}
          onChangeText={t => { setOptions(d.options.map((o, j) => (j === i ? t : o))); }}
          trailing={d.options.length > 2 ? (
            <Pressable onPress={() => { setOptions(d.options.filter((_, j) => j !== i)); }} hitSlop={8}>
              <Glyph icon={IconCrossMedium} size={18} color={fg}/>
            </Pressable>
          ) : undefined} />
      ))}
      <Button variant="ghost" size="sm" dark={props.dark} onPress={() => { setOptions([...d.options, '']); }}
        label="Add option" icon={<Glyph icon={IconPlusLarge} size={16} color={fg} />} />
      <Row align="center" justify="between" gap={12} padding={{ y: 4 }}>
        <Text size="md" color={fg}>Allow multiple choices</Text>
        <Switch name="Allow multiple choices" checked={d.multi} dark={props.dark} onChange={multi => { patch({ multi }); }} />
      </Row>
    </SheetShell>
  );
}

const EMPTY_SIGNATURE: SignatureDraft = { kind: 'personal', desc: '', message: '', json: '' };

function SignatureKindPicker({ kind, onChange }: {
  kind: SignatureDraft['kind']; onChange: (kind: SignatureDraft['kind']) => void;
}): React.ReactElement {
  return (
    <Row gap={8}>
      {SIGNATURE_KINDS.map(({ value, label }) => (
        <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: kind === value }}
          onPress={() => { onChange(value); }}>
          <LabelChip label={label} selected={kind === value} />
        </Pressable>
      ))}
    </Row>
  );
}

function SignatureSheet(props: SheetProps): React.ReactElement {
  const [d, patch, post] = useDraft(EMPTY_SIGNATURE, props);
  return (
    <SheetShell {...props} title="Request signature" onSend={() => { void sendSignatureRequest(d, post); }}
      submitLabel="Send request" canSend={canSendSignature(d)}>
      <SignatureKindPicker kind={d.kind} onChange={kind => { patch({ kind }); }} />
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
    <SheetShell {...props} title="Request payment" onSend={() => { void sendTxRequest(d, post); }}
      submitLabel="Send request" canSend={canSendPayment(d)}>
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
