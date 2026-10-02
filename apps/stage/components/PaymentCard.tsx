import { Text } from '@stage-labs/kit/react-native/text';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Button } from '@stage-labs/kit/react-native/button';
import { Row, Box } from './layout';
import { TokenAvatar } from './wallet/screen/tokenAvatar';
import { usePayerBalance, type PayerBalance } from './bubble/balance';
import { usePalette, withAlpha } from '../lib/theme';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';
import { ATTACHMENT_MAX_WIDTH } from './bubble/imageBox.model';
import { bubbleLinkProps } from './bubble/linkProps';
import { openInBubbleLink } from '../lib/safeOpenLink';
import { IconWallet4 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconWallet4';
import { useState } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { stampTokenUrl } from '@stage-labs/kit/avatar';
import { shortAddress } from '../modules/messaging';
import { domainOf } from '../lib/format';
import {
  x402AmountLabel,
  x402NetworkLabel,
  x402ChainNumber,
  x402AssetForAvatar,
  x402CanPayInApp,
  x402AmountNumber,
  x402KnownAsset,
} from '../lib/x402';
import { payX402Exact } from '../lib/x402.pay';
import { capabilities } from '../lib/capabilities';
import type { X402Accept, X402Challenge } from '../lib/useLinkPreview';
import { IconChainLink3 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconChainLink3';
import { IconCheckmark1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCheckmark1';
import { IconSquareArrowTopRight } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconSquareArrowTopRight';
import { TEXT_11PX } from './smallText';

interface PaymentBalanceArgs {
  show: boolean;
  chainId: string | number | undefined;
  token: string | undefined;
  symbol: string | undefined;
  needed: number | undefined;
}

interface PaymentAction {
  label: string;
  onPress?: () => void;
  url?: string;
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
      <Text size="4xs" color={bal.insufficient ? pal.danger : pal.sub} numberOfLines={1}>
        {bal.text}
      </Text>
    );
  }
  return (
    <Text size="4xs" color={pal.sub} numberOfLines={1} style={{ opacity: 0.5 }}>
      Balance: …
    </Text>
  );
}

function PaymentActionButton({ action, dark, pal }: {
  action: PaymentAction; dark?: boolean; pal: ReturnType<typeof usePalette>;
}): React.ReactElement {
  return (
    <Button
      size="lg" fullWidth radius={24} dark={dark}
      loading={action.loading} disabled={action.disabled}
      {...(action.url === undefined ? { onPress: action.onPress } : bubbleLinkProps(action.url, openInBubbleLink))}
      label={action.label}
      iconStart={action.icon ?? <Glyph icon={IconWallet4} size={18} color={pal.bg}/>}
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

  const bal = usePayerBalance(
    balance.show ? balance.chainId : undefined,
    balance.show ? balance.token : undefined,
    balance.show ? balance.symbol : undefined,
    balance.show ? balance.needed : undefined,
  );

  const resolvedAction = typeof action === 'function' ? action(bal) : action;

  return (
    <Box radius={BLOCK_RADIUS_DEFAULT} background={withAlpha(pal.primary, 0.08)} padding={12} margin={{ top: 8 }} gap={8} maxWidth={ATTACHMENT_MAX_WIDTH} style={{ alignSelf: 'stretch' }}>
      <Row align="center" justify="between" gap={8}>
        <Row align="center" gap={10} style={{ flexShrink: 1 }}>
          <TokenAvatar logoUrl={logoUrl} chainId={chainNum} bg={withAlpha(pal.primary, 0.08)} border={pal.border}/>
          <Text weight="semibold" size="2xs" color={pal.text} style={{ flexShrink: 1 }} numberOfLines={2}>
            {description}
          </Text>
        </Row>
        {badge ?? null}
      </Row>
      {amountLabel ? (
        <Text weight="semibold" size="2xl" color={pal.link}>
          {amountLabel}
        </Text>
      ) : null}
      {detail}
      <PaymentBalanceLine show={balance.show} bal={bal} pal={pal} />
      {resolvedAction ? (
        <PaymentActionButton action={resolvedAction} dark={dark} pal={pal} />
      ) : footer ?? null}
    </Box>
  );
}

type PayPhase = 'idle' | 'paying' | 'paid' | 'failed';

function x402Description(challenge: X402Challenge, accept: X402Accept): string {
  if (accept.description != null && accept.description !== '') return accept.description;
  if (challenge.error != null && challenge.error !== '') return challenge.error;
  return 'Payment required';
}

function X402Detail({ accept, network, endpoint, pal }: {
  accept: X402Accept; network: string; endpoint: string; pal: ReturnType<typeof usePalette>;
}): React.ReactElement {
  return (
    <>
      {accept.payTo ? (
        <Row align="center" gap={6}>
          <Text role="secondary" size="4xs">To</Text>
          <Text size="xs" weight="semibold" color={pal.text} numberOfLines={1}>
            {shortAddress(accept.payTo)}
          </Text>
        </Row>
      ) : null}
      <Row align="center" gap={6}>
        <Text role="secondary" size="4xs">On</Text>
        <Text size="3xs" color={pal.sub} numberOfLines={1}>{network}</Text>
      </Row>
      <Pressable {...bubbleLinkProps(endpoint, openInBubbleLink)}>
        <Row align="center" gap={6}>
          <Glyph icon={IconChainLink3} size={13} color={pal.sub}/>
          <Text size="4xs" color={pal.link} numberOfLines={1} style={{ flexShrink: 1 }}>
            {domainOf(endpoint)}
          </Text>
        </Row>
      </Pressable>
    </>
  );
}

function payButtonLabel(phase: PayPhase, insufficient: boolean, asset: { symbol: string } | undefined, amountLabel?: string): string {
  if (phase === 'paid') return 'Paid';
  if (phase === 'paying') return 'Paying...';
  if (phase === 'failed') return 'Retry payment';
  if (insufficient) return `Insufficient ${asset?.symbol ?? 'balance'}`;
  return amountLabel ? `Pay ${amountLabel}` : 'Pay';
}

export function X402Card({ challenge, dark }: {
  challenge: X402Challenge; dark?: boolean;
}): React.ReactElement | null {
  const pal = usePalette();
  const accept = challenge.accepts[0];
  const [phase, setPhase] = useState<PayPhase>('idle');

  const endpoint = challenge.endpoint || '';
  const amountLabel = accept ? x402AmountLabel(accept) : undefined;
  const network = accept ? x402NetworkLabel(accept.network) : '';
  const chainNum = accept ? x402ChainNumber(accept.network) : 1;

  const canPay = !!accept && x402CanPayInApp(accept);
  const asset = accept ? x402KnownAsset(accept) : undefined;

  if (!accept) return null;

  const runPay = (): void => {
    setPhase('paying');
    void (async () => {
      try {
        const res = await payX402Exact({ resource: endpoint, accept, x402Version: challenge.x402Version });
        setPhase(res.ok ? 'paid' : 'failed');
        capabilities.toast(res.ok ? 'Payment sent' : `Payment failed (${res.status})`);
      } catch (e) {
        setPhase('failed');
        capabilities.toast((e as Error).message || 'Payment failed');
      }
    })();
  };

  const confirmPay = (): void => {
    void capabilities.confirm({
      title: 'Confirm payment',
      message: `Pay ${amountLabel ?? 'this amount'} to ${accept.payTo ? shortAddress(accept.payTo) : 'recipient'} `
        + `for ${domainOf(endpoint)} on ${network}?\n\n`
        + 'Signs a gasless USDC authorization (no gas, no on-chain tx) and settles it through the resource.',
      confirmLabel: 'Pay',
    }).then((ok) => { if (ok) runPay(); });
  };

  const buildAction = (bal: { insufficient: boolean } | null): PaymentAction => {
    const insufficient = canPay && bal?.insufficient === true;
    if (canPay) {
      return {
        label: payButtonLabel(phase, insufficient, asset, amountLabel),
        onPress: confirmPay,
        disabled: phase === 'paying' || phase === 'paid' || insufficient,
        icon: <Glyph icon={phase === 'paid' ? IconCheckmark1 : IconWallet4} size={18} color={pal.bg}/>,
      };
    }
    return { label: 'Open endpoint', url: endpoint, icon: <Glyph icon={IconSquareArrowTopRight} size={18} color={pal.bg}/> };
  };

  const badge = (
    <Box radius={999} background={withAlpha(pal.primary, 0.16)} padding={{ x: 8, y: 3 }}>
      <Text weight="semibold" color={pal.primary} style={TEXT_11PX}>x402</Text>
    </Box>
  );

  return (
    <PaymentCard
      dark={dark}
      logoUrl={stampTokenUrl(chainNum, x402AssetForAvatar(accept), 36)}
      chainNum={chainNum}
      description={x402Description(challenge, accept)}
      badge={badge}
      amountLabel={amountLabel}
      detail={<X402Detail accept={accept} network={network} endpoint={endpoint} pal={pal} />}
      balance={{
        show: !!accept.asset && chainNum > 0,
        chainId: chainNum,
        token: accept.asset,
        symbol: asset?.symbol,
        needed: x402AmountNumber(accept),
      }}
      action={buildAction}
    />
  );
}
