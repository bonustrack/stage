import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Box, Row, Col, ScreenScroll } from '../layout';
import { Button } from '@stage-labs/kit/react-native/button';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { usePalette } from '../../lib/theme';

export interface FormPal { fg: string; head: string; sub: string; border: string; inputBg: string; link: string }

export function useFormPal(): FormPal {
  const { text, link, border, inputBg } = usePalette();
  return { fg: text, head: link, sub: text, border, inputBg, link };
}

function ActionHeader({ title, head, border, onBack }: {
  title: string; head: string; border: string; onBack: () => void;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  return (
    <Row surface="toolbar" padding={{ x: 12, top: 8 + insets.top, bottom: 8 }} align="center" gap={8} style={{ borderBottomWidth: 1, borderBottomColor: border }}>
      <Pressable onPress={onBack} hitSlop={8} style={{ padding: 4 }}>
        <Icon name="arrowNarrowLeft" size={24} color={head}/>
      </Pressable>
      <Text weight="semibold" size="xl" color={head} style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </Text>
    </Row>
  );
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

export function ActionPage({ title, head, border, onBack, footer, children }: {
  title: string; head: string; border: string; onBack: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Col surface="surface" flex={1}>
      <ActionHeader title={title} head={head} border={border} onBack={onBack}/>
      <ScreenScroll keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 16 }}>
        {children}
      </ScreenScroll>
      {footer ?? null}
    </Col>
  );
}
