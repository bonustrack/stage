/** Signature-request + payment-request builder sheets for the MessengerComposer,
 *  split out of MessengerComposer.sheets.tsx for the lint line-budget. JSX +
 *  behavior identical — state is owned by the parent and threaded via props. */

import { Pressable, TextInput } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Button } from '@metro-labs/kit/button';
import { Row, Col } from './layout';
import { AppModal } from './AppModal';
import { usePalette, useBlockRadius } from '../lib/theme';
import { type Palette } from './MessengerComposer.helpers';

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
              <Text style={{ color: kind === k ? '#c0a06e' : fg, fontSize: 14, fontFamily: 'Calibre-Semibold' }}>{label}</Text>
            </Pressable>
          ))}
        </Row>
        <TextInput
          value={desc}
          onChangeText={setDesc}
          placeholder="Description (e.g. Sign in to dapp)"
          placeholderTextColor={sub}
          style={{ color: fg, backgroundColor: inputBg, borderRadius: r, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Calibre-Medium', fontSize: 15 }}
        />
        {kind === 'personal' ? (
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Message to sign"
            placeholderTextColor={sub}
            multiline
            style={{ color: fg, backgroundColor: inputBg, borderRadius: r, paddingHorizontal: 12, paddingVertical: 10, minHeight: 80, fontFamily: 'Calibre-Medium', fontSize: 15, textAlignVertical: 'top' }}
          />
        ) : (
          <TextInput
            value={json}
            onChangeText={setJson}
            placeholder={'EIP-712 typed data JSON\n{ "domain": {…}, "types": {…}, "primaryType": "…", "message": {…} }'}
            placeholderTextColor={sub}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            style={{ color: fg, backgroundColor: inputBg, borderRadius: r, paddingHorizontal: 12, paddingVertical: 10, minHeight: 160, fontFamily: 'Calibre-Medium', fontSize: 13, textAlignVertical: 'top' }}
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
        <TextInput
          value={to}
          onChangeText={setTo}
          placeholder="Recipient address (0x…)"
          placeholderTextColor={sub}
          autoCapitalize="none"
          autoCorrect={false}
          style={{ color: fg, backgroundColor: inputBg, borderRadius: r, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Calibre-Medium', fontSize: 14 }}
        />
        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="Amount (ETH)"
          placeholderTextColor={sub}
          keyboardType="decimal-pad"
          style={{ color: fg, backgroundColor: inputBg, borderRadius: r, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Calibre-Medium', fontSize: 16 }}
        />
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Note (optional)"
          placeholderTextColor={sub}
          style={{ color: fg, backgroundColor: inputBg, borderRadius: r, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Calibre-Medium', fontSize: 16 }}
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
