/** @file Shared Wallet form primitives (page shell, footer button, palette and footer-reporter hooks) for the Send/Shield/Unshield action pages, styled with the canonical palette accent token. */
import { useCallback, useRef, useState } from 'react';
import { fontSize } from '@stage-labs/kit/tokens';
import { Pressable } from '@stage-labs/kit/pressable';
import { Scroll as ScrollView } from '@stage-labs/kit/scroll';
import { Input } from '@stage-labs/kit/input';
import { Text } from '@stage-labs/kit/text';
import { Icon } from '@stage-labs/kit/icon';
import { Box, Row, Col } from '../../components/layout';
import { Button } from '@stage-labs/kit/button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePalette } from '../../lib/theme';

export interface FormPal { fg: string; head: string; sub: string; border: string; inputBg: string; link: string }

/** Submit-button state a form reports up to the page so the page can render the pinned <WalletFooter>. The page owns Cancel (router.back); the form owns the primary's label + handler + disabled/loading. */
export interface FooterState {
  submitLabel: string; onSubmit: () => void; submitDisabled: boolean; submitLoading: boolean;
}

/** Collects a child form's reported FooterState for a pinned <WalletFooter>, committing only when a displayed field (label/disabled/loading) changed so the every-render report stays idempotent; the latest onSubmit closure is kept in a ref and invoked via the returned onSubmit. */
export function useFooterReporter(): {
  footer: FooterState | null;
  report: (s: FooterState) => void;
  onSubmit: () => void;
} {
  const [footer, setFooter] = useState<FooterState | null>(null);
  const ref = useRef<FooterState | null>(null);
  const report = useCallback((s: FooterState): void => {
    ref.current = s;
    setFooter(prev => {
      if (prev?.submitLabel === s.submitLabel
        && prev.submitDisabled === s.submitDisabled
        && prev.submitLoading === s.submitLoading) {
        return prev;
      }
      return s;
    });
  }, []);
  const onSubmit = useCallback((): void => { ref.current?.onSubmit(); }, []);
  return { footer, report, onSubmit };
}

/** Build the form palette from the canonical app palette. */
export function useFormPal(): FormPal {
  const { text, link, border, inputBg } = usePalette();
  return { fg: text, head: link, sub: text, border, inputBg, link };
}

/** Back header used by all four wallet-action pages. */
export function ActionHeader({ title, head, border, onBack }: {
  title: string; head: string; border: string; onBack: () => void;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  return (
    <Row surface="toolbar" padding={{ x: 12, top: 8 + insets.top, bottom: 8 }} align="center" gap={8} style={{ borderBottomWidth: 1, borderBottomColor: border }}>
      <Pressable onPress={onBack} hitSlop={8} style={{ padding: 4 }}>
        <Icon name="arrowLeft" size={22} color={head}/>
      </Pressable>
      <Text weight="semibold" size="xl" color={head} style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </Text>
    </Row>
  );
}

/** A labelled segmented selector built on the Kit Button (secondary = unselected, primary = selected). Replaces the bespoke gold Pressable pills. */
export function Segmented<T extends string | number>({ label, value, options, onChange, dark }: {
  label?: string; value: T; dark: boolean;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}): React.ReactElement {
  const { sub } = useFormPal();
  return (
    <Box gap={6}>
      {label ? <Text size="xs" color={sub}>{label}</Text> : null}
      <Row gap={8}>
        {options.map(([id, text]) => (
          <Button key={String(id)} variant={value === id ? 'primary' : 'secondary'}
            size="md" dark={dark} pill style={{ flex: 1 }}
            onPress={() => { onChange(id); }} label={text}/>
        ))}
      </Row>
    </Box>
  );
}

/** Plain amount input box (Kit-styled). Optionally shows the selected token's balance with a Max button (when `balance` is provided, even "0"). */
export function AmountBox({ pal, amount, setAmount, busy, balance, symbol, dark }: {
  pal: FormPal; amount: string; setAmount: (v: string) => void; busy: boolean;
  balance?: string | null; symbol?: string; dark?: boolean;
}): React.ReactElement {
  const { head, sub, link } = pal;
  const hasBal = balance != null && Number(balance) > 0;
  return (
    <Box gap={6}>
      <Row align="center">
        <Text size="xs" color={sub} style={{ flex: 1 }}>AMOUNT</Text>
        {balance != null ? (
          <Button variant="ghost" size="sm" dark={!!dark} disabled={!hasBal || busy}
            onPress={() => { if (hasBal) setAmount(balance); }}
            label="MAX" textStyle={{ color: hasBal ? link : sub, fontSize: fontSize('xs') }}
            style={{ height: 24, paddingHorizontal: 8 }}/>
        ) : null}
      </Row>
      <Box surface="raised" radius="lg" padding={{ x: 14, y: 12 }}>
        <Input value={amount} onChangeText={setAmount} placeholder="0.0" placeholderTextColor={sub}
          inputType="number" disabled={busy} dark={!!dark}
          inputProps={{ keyboardType: 'decimal-pad' }}
          style={{ color: head, fontSize: fontSize('xl'), fontFamily: 'Calibre-Semibold', padding: 0,
            backgroundColor: 'transparent', minHeight: 0, paddingHorizontal: 0, paddingVertical: 0, borderWidth: 0 }}/>
      </Box>
      {balance != null ? (
        <Text size="xs" color={sub} style={{ paddingHorizontal: 4 }}>
          Balance: {Number(balance).toLocaleString(undefined, { maximumFractionDigits: 6 })}{symbol ? ` ${symbol}` : ''}
        </Text>
      ) : null}
    </Box>
  );
}

/** Read-only locked recipient card (shared by shield/unshield/self-send). */
export function LockedRecipient({ pal, label, value, hint }: {
  pal: FormPal; label: string; value: string; hint: string;
}): React.ReactElement {
  const { head, sub, border } = pal;
  return (
    <Box gap={6}>
      <Text size="xs" color={sub}>{label}</Text>
      <Box surface="raised" radius="lg" padding={{ x: 14, y: 12 }} style={{ borderWidth: 1, borderColor: border }}>
        <Text weight="semibold" size="md" color={head}>{value}</Text>
        <Text size="xs" color={sub} style={{ marginTop: 2 }}>{hint}</Text>
      </Box>
    </Box>
  );
}

/** Pinned bottom footer with two half-width buttons — a secondary "Cancel" and the page's primary submit — shared by the Send/Shield/Unshield pages; adds safe-area bottom padding and a top divider. */
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
      <Button variant="secondary" size="lg" pill dark={dark} style={{ flex: 1 }}
        onPress={onCancel} label="Cancel"/>
      <Button variant="primary" size="lg" pill dark={dark} style={{ flex: 1 }}
        loading={!!submitLoading} disabled={!!submitDisabled}
        onPress={onSubmit} label={submitLabel}/>
    </Row>
  );
}

/** Standard page shell: bg + header + scroll body + optional pinned footer. When `footer` is given it renders below the scroll so it stays pinned. */
export function ActionPage({ title, head, border, onBack, footer, children }: {
  title: string; head: string; bg: string; border: string; onBack: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Col surface="surface" flex={1}>
      <ActionHeader title={title} head={head} border={border} onBack={onBack}/>
      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 16 }}>
        {children}
      </ScrollView>
      {footer ?? null}
    </Col>
  );
}
