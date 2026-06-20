/** @file Renders a payment-request bubble for a link that returned an x402 challenge, and for the exact/USDC scheme runs the in-app x402 pay path (EIP-3009 authorization + X-PAYMENT POST to the link-proxy /x402-settle endpoint). */

import { useState } from 'react';
import { Alert, Linking } from 'react-native';

import { Pressable } from '@metro-labs/kit/pressable';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { stampTokenUrl } from '@metro-labs/kit/avatar';
import { Row, Box } from './layout';
import { PaymentCard } from './PaymentCard';
import { shortAddress } from '../modules/messaging';
import { domainOf } from '../lib/genericLinkDetect';
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
import { flash } from '../lib/toast';
import type { X402Challenge } from '../lib/useLinkPreview';
import { usePalette, withAlpha } from '../lib/theme';

type PayPhase = 'idle' | 'paying' | 'paid' | 'failed';

/** Single accepted x402 payment option. */
type X402Accept = X402Challenge['accepts'][number];

/** Resolve the description line for an x402 challenge (accept description, error, or default). */
function x402Description(challenge: X402Challenge, accept: X402Accept): string {
  if (accept.description != null && accept.description !== '') return accept.description;
  if (challenge.error != null && challenge.error !== '') return challenge.error;
  return 'Payment required';
}

/** Renders the recipient + network + tappable endpoint detail block of the x402 card. */
function X402Detail({ accept, network, endpoint, pal, onOpen }: {
  accept: X402Accept; network: string; endpoint: string;
  pal: ReturnType<typeof usePalette>; onOpen: () => void;
}): React.ReactElement {
  return (
    <>
      {accept.payTo ? (
        <Row align="center" gap={6}>
          <Text role="secondary" size="xs">To</Text>
          <Text size="lg" weight="semibold" color={pal.text} numberOfLines={1}>
            {shortAddress(accept.payTo)}
          </Text>
        </Row>
      ) : null}
      <Row align="center" gap={6}>
        <Text role="secondary" size="xs">On</Text>
        <Text size="sm" color={pal.sub} numberOfLines={1}>{network}</Text>
      </Row>
      <Pressable onPress={onOpen}>
        <Row align="center" gap={6}>
          <Icon name="link" size={13} color={pal.sub}/>
          <Text size="xs" color={pal.link} numberOfLines={1} style={{ flexShrink: 1 }}>
            {domainOf(endpoint)}
          </Text>
        </Row>
      </Pressable>
    </>
  );
}

/** Resolve the primary pay-button label from capability, phase, and affordability. */
function payButtonLabel(phase: PayPhase, insufficient: boolean, asset: { symbol: string } | undefined, amountLabel?: string): string {
  if (phase === 'paid') return 'Paid';
  if (phase === 'paying') return 'Paying...';
  if (phase === 'failed') return 'Retry payment';
  if (insufficient) return `Insufficient ${asset?.symbol ?? 'balance'}`;
  return amountLabel ? `Pay ${amountLabel}` : 'Pay';
}

/** Card that renders an x402 payment challenge and drives the pay flow. */
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

  /** Open Endpoint. */
  const openEndpoint = (): void => { if (endpoint) void Linking.openURL(endpoint); };

  /** Run Pay — settle the x402 authorization and surface the result. */
  const runPay = (): void => {
    setPhase('paying');
    void (async () => {
      try {
        const res = await payX402Exact({ resource: endpoint, accept, x402Version: challenge.x402Version });
        setPhase(res.ok ? 'paid' : 'failed');
        flash(res.ok ? 'Payment sent' : `Payment failed (${res.status})`);
      } catch (e) {
        setPhase('failed');
        flash((e as Error).message || 'Payment failed');
      }
    })();
  };

  /** Confirm Pay — prompt before signing the gasless authorization. */
  const confirmPay = (): void => {
    Alert.alert(
      'Confirm payment',
      `Pay ${amountLabel ?? 'this amount'} to ${accept.payTo ? shortAddress(accept.payTo) : 'recipient'} `
        + `for ${domainOf(endpoint)} on ${network}?\n\n`
        + 'Signs a gasless USDC authorization (no gas, no on-chain tx) and settles it through the resource.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Pay', style: 'default', onPress: runPay }],
    );
  };

  /** Build the PaymentCard primary action for a resolved balance. */
  const buildAction = (bal: { insufficient: boolean } | null): {
    label: string; onPress: () => void; disabled?: boolean; icon: React.ReactElement;
  } => {
    const insufficient = canPay && bal?.insufficient === true;
    if (canPay) {
      return {
        label: payButtonLabel(phase, insufficient, asset, amountLabel),
        onPress: confirmPay,
        disabled: phase === 'paying' || phase === 'paid' || insufficient,
        icon: <Icon name={phase === 'paid' ? 'check' : 'wallet'} size={18} color={pal.bg}/>,
      };
    }
    /** Non-`exact` schemes / unsupported networks / unknown assets: open in browser. */
    return { label: 'Open endpoint', onPress: openEndpoint, icon: <Icon name="externalLink" size={18} color={pal.bg}/> };
  };

  /** x402 protocol badge — small primary-tinted pill. */
  const badge = (
    <Box radius={999} background={withAlpha(pal.primary, 0.16)} padding={{ x: 8, y: 3 }}>
      <Text weight="semibold" size="3xs" color={pal.primary}>x402</Text>
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
      detail={<X402Detail accept={accept} network={network} endpoint={endpoint} pal={pal} onOpen={openEndpoint} />}
      balance={{
        /** Show balance whenever we have an asset reference + chain (decimals read on-chain for unknowns). */
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
