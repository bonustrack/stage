/** Shared Wallet form primitives for the Send / Send-shielded / Shield /
 *  Unshield pages. Replaces the old hand-rolled "gold" segmented selectors
 *  (#c0a06e borders + rgba(192,160,110) fills) with the canonical palette:
 *  the selected state uses usePalette().link, the app's accent token, so these
 *  controls match the rest of the UI instead of a bespoke gold treatment. */
import { useCallback, useRef, useState } from 'react';
import { fontSize } from '@metro-labs/kit/tokens';
import { Pressable } from '@metro-labs/kit/pressable';
import { Scroll as ScrollView } from '@metro-labs/kit/scroll';
import { Input } from '@metro-labs/kit/input';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Box, Row } from '../../components/layout';
import { Button } from '@metro-labs/kit/button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePalette } from '../../lib/theme';

export interface FormPal { fg: string; head: string; sub: string; border: string; inputBg: string; link: string }

/** Submit-button state a form reports up to the page so the page can render the
 *  pinned <WalletFooter>. The page owns Cancel (router.back); the form owns the
 *  primary's label + handler + disabled/loading. */
export interface FooterState {
  submitLabel: string; onSubmit: () => void; submitDisabled: boolean; submitLoading: boolean;
}

/** Collect a child form's reported FooterState for a pinned <WalletFooter>.
 *
 *  The child re-calls `report` on EVERY render (its onSubmit/label closures are
 *  fresh each time), so a naive `setState(footerObject)` would update the parent
 *  on every render → re-render → child re-reports → "Maximum update depth
 *  exceeded". This hook makes the report idempotent: it only commits new state
 *  when a *displayed* field (label/disabled/loading) actually changed. onSubmit
 *  is deliberately excluded from the equality check — it changes every render —
 *  but the latest closure is kept in a ref and invoked via the returned
 *  `onSubmit`, so the footer always runs the freshest handler. */
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
      if (prev
        && prev.submitLabel === s.submitLabel
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
  const { toolbarBg } = usePalette();
  return (
    <Row align="center" gap={8} px={12} style={{
      borderBottomWidth: 1, borderBottomColor: border,
      backgroundColor: toolbarBg, paddingTop: 8 + insets.top, paddingBottom: 8,
    }}>
      <Pressable onPress={onBack} hitSlop={8} style={{ padding: 4 }}>
        <Icon name="arrowLeft" size={22} color={head} />
      </Pressable>
      <Text weight="semibold" size="lg" style={{ color: head, flex: 1 }} numberOfLines={1}>
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
      {label ? <Text size="sm" style={{ color: sub }}>{label}</Text> : null}
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

/** Plain amount input box (Kit-styled). Optionally shows the selected token's
 *  balance with a Max button (when `balance` is provided, even "0"). */
export function AmountBox({ pal, amount, setAmount, busy, balance, symbol, dark }: {
  pal: FormPal; amount: string; setAmount: (v: string) => void; busy: boolean;
  balance?: string | null; symbol?: string; dark?: boolean;
}): React.ReactElement {
  const { head, sub, inputBg, link } = pal;
  const hasBal = balance != null && Number(balance) > 0;
  return (
    <Box style={{ gap: 6 }}>
      <Row align="center">
        <Text size="sm" style={{ color: sub, flex: 1 }}>AMOUNT</Text>
        {balance != null ? (
          <Button variant="ghost" size="sm" dark={!!dark} disabled={!hasBal || busy}
            onPress={() => { if (hasBal) setAmount(String(balance)); }}
            label="MAX" textStyle={{ color: hasBal ? link : sub, fontSize: fontSize('sm') }}
            style={{ height: 24, paddingHorizontal: 8 }} />
        ) : null}
      </Row>
      <Box style={{ backgroundColor: inputBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }}>
        <Input value={amount} onChangeText={setAmount} placeholder="0.0" placeholderTextColor={sub}
          inputType="number" disabled={busy} dark={!!dark}
          inputProps={{ keyboardType: 'decimal-pad' }}
          style={{ color: head, fontSize: fontSize('lg'), fontFamily: 'Calibre-Semibold', padding: 0,
            backgroundColor: 'transparent', minHeight: 0, paddingHorizontal: 0, paddingVertical: 0, borderWidth: 0 }} />
      </Box>
      {balance != null ? (
        <Text size="sm" style={{ color: sub, paddingHorizontal: 4 }}>
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
  const { head, sub, border, inputBg } = pal;
  return (
    <Box style={{ gap: 6 }}>
      <Text size="sm" style={{ color: sub }}>{label}</Text>
      <Box style={{ backgroundColor: inputBg, borderRadius: 12, borderWidth: 1, borderColor: border, paddingHorizontal: 14, paddingVertical: 12 }}>
        <Text weight="semibold" size="md" style={{ color: head }}>{value}</Text>
        <Text size="sm" style={{ color: sub, marginTop: 2 }}>{hint}</Text>
      </Box>
    </Box>
  );
}

/** Pinned bottom footer with two equal half-width buttons: a secondary "Cancel"
 *  (dismiss / router.back) on the left and the page's primary submit on the
 *  right. Shared by the Send / Shield / Unshield pages so the action bar matches
 *  across all three. Adds safe-area bottom padding + a top divider. */
export function WalletFooter({
  border, bg, dark, onCancel, submitLabel, onSubmit, submitDisabled, submitLoading,
}: {
  border: string; bg: string; dark: boolean;
  onCancel: () => void;
  submitLabel: string; onSubmit: () => void;
  submitDisabled?: boolean; submitLoading?: boolean;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  return (
    <Row gap={12} px={16}
      style={{
        paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12),
        borderTopWidth: 1, borderTopColor: border, backgroundColor: bg,
      }}>
      <Button variant="secondary" size="lg" pill dark={dark} style={{ flex: 1 }}
        onPress={onCancel} label="Cancel" />
      <Button variant="primary" size="lg" pill dark={dark} style={{ flex: 1 }}
        loading={!!submitLoading} disabled={!!submitDisabled}
        onPress={onSubmit} label={submitLabel} />
    </Row>
  );
}

/** Standard page shell: bg + header + scroll body + optional pinned footer.
 *  When `footer` is given it renders below the scroll so it stays pinned. */
export function ActionPage({ title, head, bg, border, onBack, footer, children }: {
  title: string; head: string; bg: string; border: string; onBack: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Box style={{ flex: 1, backgroundColor: bg }}>
      <ActionHeader title={title} head={head} border={border} onBack={onBack} />
      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 16 }}>
        {children}
      </ScrollView>
      {footer ?? null}
    </Box>
  );
}
