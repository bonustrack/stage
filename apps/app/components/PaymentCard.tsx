
import { Text } from '@stage-labs/kit/text';
import { Icon } from '@stage-labs/kit/icon';
import { Button } from '@stage-labs/kit/button';
import { Row, Box } from './layout';
import { TokenAvatar } from './tabs/WalletScreen.tokenAvatar';
import { usePayerBalance, type PayerBalance } from './MessengerBubble.balance';
import { usePalette, useBlockRadius, withAlpha } from '../lib/theme';

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
  icon?: React.ReactElement;
  loading?: boolean;
  disabled?: boolean;
}

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

export function PaymentCard({
  dark, logoUrl, chainNum, description, badge, amountLabel,
  detail, balance, action, footer,
}: {
  dark?: boolean;
  logoUrl: string;
  chainNum: number;
  description: string;
  badge?: React.ReactElement;
  amountLabel?: string;
  detail?: React.ReactNode;
  balance: PaymentBalanceArgs;
  action?: PaymentAction | ((bal: PayerBalance | null) => PaymentAction | undefined);
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
      {}
      <PaymentBalanceLine show={balance.show} bal={bal} pal={pal} />
      {resolvedAction ? (
        <PaymentActionButton action={resolvedAction} dark={dark} pal={pal} />
      ) : footer ?? null}
    </Box>
  );
}
