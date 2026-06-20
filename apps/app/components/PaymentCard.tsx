/** @file PaymentCard: the shared presentational payment bubble (token avatar, amount, recipient, balance row, primary action) used by both TxRequestCard and X402Card. */

import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Button } from '@metro-labs/kit/button';
import { Row, Box } from './layout';
import { TokenAvatar } from './tabs/WalletScreen.tokenAvatar';
import { usePayerBalance, type PayerBalance } from './MessengerBubble.balance';
import { usePalette, useBlockRadius, withAlpha } from '../lib/theme';

/** Args for the balance line: when `show` is false the row is omitted entirely (no amount / unknown asset / unknown chain); when true it always renders, a placeholder while loading then the resolved balance. */
export interface PaymentBalanceArgs {
  show: boolean;
  chainId: string | number | undefined;
  token: string | undefined;
  symbol: string | undefined;
  needed: number | undefined;
}

export interface PaymentAction {
  label: string;
  onPress: () => void;
  /** Leading icon (defaults to the wallet glyph). */
  icon?: React.ReactElement;
  loading?: boolean;
  disabled?: boolean;
}

/** Renders the balance line of a payment card (placeholder while loading, danger-tinted when insufficient). */
function PaymentBalanceLine({ show, bal, pal }: {
  show: boolean; bal: PayerBalance | null; pal: ReturnType<typeof usePalette>;
}): React.ReactElement | null {
  if (!show) return null;
  if (bal) {
    return (
      <Text size="xs" color={bal.insufficient ? pal.danger : pal.sub} numberOfLines={1}>
        {bal.text}
      </Text>
    );
  }
  return (
    <Text size="xs" color={pal.sub} numberOfLines={1} style={{ opacity: 0.5 }}>
      Balance: …
    </Text>
  );
}

/** Renders the full-width primary action button of a payment card. */
function PaymentActionButton({ action, dark, pal }: {
  action: PaymentAction; dark?: boolean; pal: ReturnType<typeof usePalette>;
}): React.ReactElement {
  return (
    <Button
      variant="primary" size="lg" fullWidth radius={24} dark={dark}
      loading={action.loading} disabled={action.disabled} onPress={action.onPress}
      label={action.label}
      iconStart={action.icon ?? <Icon name="wallet" size={18} color={pal.bg}/>}
      tintBg={pal.primary} tintFg={pal.bg} style={{ marginTop: 2 }}
    />
  );
}

/** Renders a payment summary card showing the token, amount, balance, and action. */
export function PaymentCard({
  dark, logoUrl, chainNum, description, badge, amountLabel,
  detail, balance, action, footer,
}: {
  dark?: boolean;
  logoUrl: string;
  chainNum: number;
  /** Title line next to the token avatar (the request description). */
  description: string;
  /** Distinguishing pill rendered top-right (e.g. the x402 badge). Optional. */
  badge?: React.ReactElement;
  /** Big amount line (e.g. "0.01 USDC"). Omitted when undefined. */
  amountLabel?: string;
  /** Recipient ("To …") / endpoint line(s). The caller renders these so each card keeps its own recipient-vs-endpoint presentation. */
  detail?: React.ReactNode;
  /** Balance line config (always shown when `show`). */
  balance: PaymentBalanceArgs;
  /** Full-width primary action: a static action or a function of the resolved balance (so label/disabled can depend on affordability — x402 card); omit / return undefined for a buttonless read-only card. */
  action?: PaymentAction | ((bal: PayerBalance | null) => PaymentAction | undefined);
  /** Replaces the action button when there is none (e.g. a consent-gated note telling the user to accept the conversation before paying). */
  footer?: React.ReactNode;
}): React.ReactElement {
  const pal = usePalette();
  const blockRadius = useBlockRadius();

  const bal = usePayerBalance(
    balance.show ? balance.chainId : undefined,
    balance.show ? balance.token : undefined,
    balance.show ? balance.symbol : undefined,
    balance.show ? balance.needed : undefined,
  );

  const resolvedAction = typeof action === 'function' ? action(bal) : action;

  return (
    <Box radius={blockRadius} background={withAlpha(pal.primary, 0.08)} padding={12} margin={{ top: 8 }} gap={8} style={{ alignSelf: 'stretch' }}>
      <Row align="center" justify="between" gap={8}>
        <Row align="center" gap={10} style={{ flexShrink: 1 }}>
          <TokenAvatar logoUrl={logoUrl} chainId={chainNum} bg={withAlpha(pal.primary, 0.08)} border={pal.border}/>
          <Text weight="semibold" size="md" color={pal.text} style={{ flexShrink: 1 }} numberOfLines={2}>
            {description}
          </Text>
        </Row>
        {badge ?? null}
      </Row>
      {amountLabel ? (
        <Text weight="semibold" size="5xl" color={pal.link}>
          {amountLabel}
        </Text>
      ) : null}
      {detail}
      {/** Balance line — always shown for a known asset on a known chain, never silently hidden so the card can't look broken. */}
      <PaymentBalanceLine show={balance.show} bal={bal} pal={pal} />
      {resolvedAction ? (
        <PaymentActionButton action={resolvedAction} dark={dark} pal={pal} />
      ) : footer ?? null}
    </Box>
  );
}
