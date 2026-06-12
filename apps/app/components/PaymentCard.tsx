/** PaymentCard — shared presentational payment bubble used by BOTH the in-chat
 *  payment request (TxRequestCard) and the x402 payment-endpoint card
 *  (X402Card). They were near-identical: token avatar + description, a big
 *  amount, a recipient-or-endpoint line, a balance line, and a full-width
 *  primary action. This component owns that layout + the balance row; the two
 *  callers stay thin wrappers that pass their own distinguishing badge/eyebrow,
 *  their own action handler (walletSendCalls/sendCall vs EIP-3009 sign +
 *  /x402-settle), and a fallback action.
 *
 *  Purely presentational: no payment logic lives here. The balance is fetched
 *  with usePayerBalance from the (chainId, token, symbol, amount) the caller
 *  passes, and ALWAYS renders a row when there's an amount + known asset on a
 *  known chain — a subtle placeholder while it loads, danger-tinted when the
 *  held balance is below the requested amount — so the card never looks broken
 *  by silently hiding the line. */

import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Button } from '@metro-labs/kit/button';
import { Row, Box } from './layout';
import { TokenAvatar } from './tabs/WalletScreen.tokenAvatar';
import { usePayerBalance, type PayerBalance } from './MessengerBubble.balance';
import { usePalette, useBlockRadius, withAlpha } from '../lib/theme';

/** Args for the balance line. When `show` is false the row is omitted entirely
 *  (no amount / unknown asset / unknown chain — there's nothing meaningful to
 *  show). When true, the row always renders: a placeholder while loading, the
 *  resolved balance otherwise. */
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
  /** Recipient ("To …") / endpoint line(s). The caller renders these so each
   *  card keeps its own recipient-vs-endpoint presentation. */
  detail?: React.ReactNode;
  /** Balance line config (always shown when `show`). */
  balance: PaymentBalanceArgs;
  /** Full-width primary action. Either a static action or a function of the
   *  resolved balance (so the action label/disabled can depend on whether the
   *  payer can afford it — used by the x402 card). Omit / return undefined to
   *  render the card with no button (read-only pending-requests list). */
  action?: PaymentAction | ((bal: PayerBalance | null) => PaymentAction | undefined);
  /** Replaces the action button when there is none (e.g. a consent-gated note
   *  telling the user to accept the conversation before paying). */
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
      {/* Balance line — always shown for a known asset on a known chain.
          Placeholder while loading, danger-tinted when below the amount.
          Never silently hidden so the card can't look broken. */}
      {balance.show ? (
        bal ? (
          <Text size="xs" color={bal.insufficient ? pal.danger : pal.sub} numberOfLines={1}>
            {bal.text}
          </Text>
        ) : (
          <Text size="xs" color={pal.sub} numberOfLines={1} style={{ opacity: 0.5 }}>
            Balance: …
          </Text>
        )
      ) : null}
      {resolvedAction ? (
        <Button
          variant="primary"
          size="lg"
          fullWidth
          radius={24}
          dark={dark}
          loading={resolvedAction.loading}
          disabled={resolvedAction.disabled}
          onPress={resolvedAction.onPress}
          label={resolvedAction.label}
          iconStart={resolvedAction.icon ?? <Icon name="wallet" size={18} color={pal.bg}/>}
          tintBg={pal.primary}
          tintFg={pal.bg}
          style={{ marginTop: 2 }}
        />
      ) : footer ?? null}
    </Box>
  );
}
