import { Text } from '@stage-labs/kit/react-native/text';
import { Box, Row } from '../layout';
import { Button } from '@stage-labs/kit/react-native/button';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { usePalette } from '../../lib/theme';

export interface FormPal { fg: string; head: string; sub: string; border: string; inputBg: string; link: string }

export function useFormPal(): FormPal {
  const { text, link, border, inputBg } = usePalette();
  return { fg: text, head: link, sub: text, border, inputBg, link };
}

export function Segmented<T extends string | number>({ label, value, options, onChange, dark }: {
  label?: string; value: T; dark: boolean;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}): React.ReactElement {
  return (
    <Box gap={6}>
      {label ? <Text size="xs" role="secondary">{label}</Text> : null}
      <Row gap={8}>
        {options.map(([id, text]) => (
          <Button key={String(id)} color={value === id ? 'primary' : 'secondary'} variant="solid"
            size="md" dark={dark} pill style={{ flex: 1 }}
            onPress={() => { onChange(id); }} label={text}/>
        ))}
      </Row>
    </Box>
  );
}

export function WalletFooter({
  border, dark, onCancel, submitLabel, onSubmit, submitDisabled, submitLoading,
}: {
  border: string; dark: boolean;
  onCancel: () => void;
  submitLabel: string; onSubmit: () => void;
  submitDisabled?: boolean; submitLoading?: boolean;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  return (
    <Row surface="surface" padding={{ x: 16, top: 12, bottom: Math.max(insets.bottom, 12) }} gap={12} 
      style={{ borderTopWidth: 1, borderTopColor: border }}>
      <Button color="secondary" variant="solid" size="lg" pill dark={dark} style={{ flex: 1 }}
        onPress={onCancel} label="Cancel"/>
      <Button size="lg" pill dark={dark} style={{ flex: 1 }}
        loading={!!submitLoading} disabled={!!submitDisabled}
        onPress={onSubmit} label={submitLabel}/>
    </Row>
  );
}
