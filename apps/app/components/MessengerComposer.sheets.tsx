/** Poll-builder sheet for the MessengerComposer. Extracted from
 *  MessengerComposer.tsx for the lint line-budget; the JSX + behavior are
 *  identical — state is owned by the parent and threaded via props. The
 *  signature/payment sheets live in MessengerComposer.sheets-tx.tsx. */

import { Pressable, TextInput } from 'react-native';
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
    <AppModal visible={open} onClose={onClose} title="New poll">
      <Col gap={12} pb={8}>
        <TextInput
          value={question}
          onChangeText={setQuestion}
          placeholder="Question"
          placeholderTextColor={sub}
          style={{ color: fg, backgroundColor: inputBg, borderRadius: r, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Calibre-Medium', fontSize: 16 }}
        />
        <TextInput
          value={header}
          onChangeText={setHeader}
          placeholder="Header (optional, e.g. LUNCH)"
          placeholderTextColor={sub}
          maxLength={12}
          autoCapitalize="characters"
          style={{ color: fg, backgroundColor: inputBg, borderRadius: r, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Calibre-Medium', fontSize: 14 }}
        />
        {options.map((opt, i) => (
          <Row key={i} align="center" gap={8}>
            <TextInput
              value={opt}
              onChangeText={t => setOptions(prev => prev.map((o, j) => (j === i ? t : o)))}
              placeholder={`Option ${i + 1}`}
              placeholderTextColor={sub}
              style={{ flex: 1, color: fg, backgroundColor: inputBg, borderRadius: r, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Calibre-Medium', fontSize: 16 }}
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
          <Text style={{ color: fg, fontSize: 15, fontFamily: 'Calibre-Medium' }}>Allow multiple choices</Text>
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
