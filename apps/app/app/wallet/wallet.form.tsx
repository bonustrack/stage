/** Shared Wallet form primitives for the Send / Send-shielded / Shield /
 *  Unshield pages. Replaces the old hand-rolled "gold" segmented selectors
 *  (#c0a06e borders + rgba(192,160,110) fills) with the canonical palette:
 *  the selected state uses usePalette().link, the app's accent token, so these
 *  controls match the rest of the UI instead of a bespoke gold treatment. */
import { Pressable, ScrollView, TextInput } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Box, Row } from '../../components/layout';
import { Button } from '@metro-labs/kit/button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePalette } from '../../lib/theme';

export interface FormPal { fg: string; head: string; sub: string; border: string; inputBg: string; link: string }

/** Build the form palette from the canonical app palette. */
export function useFormPal(): FormPal {
  const { text, link, border } = usePalette();
  return { fg: text, head: link, sub: text, border, inputBg: border, link };
}

/** Back header used by all four wallet-action pages. */
export function ActionHeader({ title, head, border, onBack }: {
  title: string; head: string; border: string; onBack: () => void;
}): React.ReactElement {
  return (
    <Row align="center" gap={8} px={12} py={8}
      style={{ borderBottomWidth: 1, borderBottomColor: border }}>
      <Pressable onPress={onBack} hitSlop={8} style={{ padding: 4 }}>
        <Icon name="arrowLeft" size={22} color={head} />
      </Pressable>
      <Text style={{ color: head, fontSize: 18, fontFamily: 'Calibre-Semibold', flex: 1 }} numberOfLines={1}>
        {title}
      </Text>
    </Row>
  );
}

/** A labelled segmented selector built on the Kit Button (secondary = unselected,
 *  primary = selected). Replaces the bespoke gold Pressable pills. */
export function Segmented<T extends string | number>({ label, value, options, onChange, dark }: {
  label?: string; value: T; dark: boolean;
  options: ReadonlyArray<readonly [T, string]>;
  onChange: (v: T) => void;
}): React.ReactElement {
  const { sub } = useFormPal();
  return (
    <Box style={{ gap: 6 }}>
      {label ? <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>{label}</Text> : null}
      <Row gap={8}>
        {options.map(([id, text]) => (
          <Button key={String(id)} variant={value === id ? 'primary' : 'secondary'}
            size="md" dark={dark} pill style={{ flex: 1 }}
            onPress={() => onChange(id)} label={text} />
        ))}
      </Row>
    </Box>
  );
}

/** Plain amount input box (Kit-styled). */
export function AmountBox({ pal, amount, setAmount, busy }: {
  pal: FormPal; amount: string; setAmount: (v: string) => void; busy: boolean;
}): React.ReactElement {
  const { head, sub, inputBg } = pal;
  return (
    <Box style={{ gap: 6 }}>
      <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>AMOUNT</Text>
      <Box style={{ backgroundColor: inputBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }}>
        <TextInput value={amount} onChangeText={setAmount} placeholder="0.0" placeholderTextColor={sub}
          keyboardType="decimal-pad" editable={!busy}
          style={{ color: head, fontSize: 18, fontFamily: 'Calibre-Semibold', padding: 0 }} />
      </Box>
    </Box>
  );
}

/** Read-only locked recipient card (shared by shield/unshield/self-send). */
export function LockedRecipient({ pal, label, value, hint }: {
  pal: FormPal; label: string; value: string; hint: string;
}): React.ReactElement {
  const { head, sub, border, inputBg } = pal;
  return (
    <Box style={{ gap: 6 }}>
      <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>{label}</Text>
      <Box style={{ backgroundColor: inputBg, borderRadius: 12, borderWidth: 1, borderColor: border, paddingHorizontal: 14, paddingVertical: 12 }}>
        <Text style={{ color: head, fontSize: 15, fontFamily: 'Calibre-Semibold' }}>{value}</Text>
        <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium', marginTop: 2 }}>{hint}</Text>
      </Box>
    </Box>
  );
}

/** Standard page shell: bg + safe-area + header + scroll body. */
export function ActionPage({ title, head, bg, border, onBack, children }: {
  title: string; head: string; bg: string; border: string; onBack: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  return (
    <Box style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      <ActionHeader title={title} head={head} border={border} onBack={onBack} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16 }}>
        {children}
      </ScrollView>
    </Box>
  );
}
