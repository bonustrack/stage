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

/** Card that renders an x402 payment challenge and drives the pay flow. */
export function X402Card({ challenge, dark }: {
  challenge: X402Challenge; dark?: boolean;
}): React.ReactElement | null {
  const pal = usePalette();
  const accept = challenge.accepts[0];
  const [phase, setPhase] = useState<PayPhase>('idle');

  const endpoint = challenge.endpoint || '';
  const desc = accept?.description != null && accept.description !== ''
    ? accept.description
    : (challenge.error != null && challenge.error !== '' ? challenge.error : 'Payment required');
  const amountLabel = accept ? x402AmountLabel(accept) : undefined;
  const network = accept ? x402NetworkLabel(accept.network) : '';
  const chainNum = accept ? x402ChainNumber(accept.network) : 1;
  const logoUrl = accept ? stampTokenUrl(chainNum, x402AssetForAvatar(accept), 36) : '';

  const canPay = !!accept && x402CanPayInApp(accept);
  const asset = accept ? x402KnownAsset(accept) : undefined;
  const needed = accept ? x402AmountNumber(accept) : undefined;
  // Show the balance whenever we have an asset reference + chain, even when the
  // token/chain isn't in the registry — usePayerBalance reads decimals/symbol
  // on-chain for unknowns. Mirrors the in-chat payment card so the user always
  // sees what they hold. PaymentCard owns the actual usePayerBalance fetch.
  const hasKnownAsset = !!accept?.asset && chainNum > 0;

  if (!accept) return null;

  /** Open Endpoint. */
  const openEndpoint = (): void => { if (endpoint) void Linking.openURL(endpoint); };

  /** Run Pay. */
  const runPay = (): void => {
    setPhase('paying');
    void (async () => {
      try {
        const res = await payX402Exact({
          resource: endpoint,
          accept,
          x402Version: challenge.x402Version,
        });
        if (res.ok) {
          setPhase('paid');
          flash('Payment sent');
        } else {
          setPhase('failed');
          flash(`Payment failed (${res.status})`);
        }
      } catch (e) {
        setPhase('failed');
        flash((e as Error).message || 'Payment failed');
      }
    })();
  };

  /** Confirm Pay. */
  const confirmPay = (): void => {
    const payLabel = amountLabel ?? 'this amount';
    Alert.alert(
      'Confirm payment',
      `Pay ${payLabel} to ${accept.payTo ? shortAddress(accept.payTo) : 'recipient'} `
        + `for ${domainOf(endpoint)} on ${network}?\n\n`
        + 'Signs a gasless USDC authorization (no gas, no on-chain tx) and settles it through the resource.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Pay', style: 'default', onPress: runPay },
      ],
    );
  };

  // The primary action label depends on capability + phase + affordability
  // (insufficient is resolved from the balance PaymentCard fetched).
  /** Pay Button Label. */
  const payButtonLabel = (insufficient: boolean): string => {
    if (phase === 'paid') return 'Paid';
    if (phase === 'paying') return 'Paying...';
    if (phase === 'failed') return 'Retry payment';
    if (insufficient) return `Insufficient ${asset?.symbol ?? 'balance'}`;
    return amountLabel ? `Pay ${amountLabel}` : 'Pay';
  };

  // x402 protocol badge — small primary-tinted pill, no shadow/gradient.
  const badge = (
    <Box radius={999} background={withAlpha(pal.primary, 0.16)} padding={{ x: 8, y: 3 }}>
      <Text weight="semibold" size="3xs" color={pal.primary}>x402</Text>
    </Box>
  );

  // Recipient + network + tappable endpoint — the x402 card's distinguishing
  // detail block (vs the payment-request card's single "To" profile link).
  const detail = (
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
      {/* Endpoint URL — what you'd be paying for. Tappable. */}
      <Pressable onPress={openEndpoint}>
        <Row align="center" gap={6}>
          <Icon name="link" size={13} color={pal.sub}/>
          <Text size="xs" color={pal.link} numberOfLines={1} style={{ flexShrink: 1 }}>
            {domainOf(endpoint)}
          </Text>
        </Row>
      </Pressable>
    </>
  );

  return (
    <PaymentCard
      dark={dark}
      logoUrl={logoUrl}
      chainNum={chainNum}
      description={desc}
      badge={badge}
      amountLabel={amountLabel}
      detail={detail}
      balance={{
        show: hasKnownAsset,
        chainId: chainNum,
        token: accept.asset,
        symbol: asset?.symbol,
        needed,
      }}
      action={(bal) => {
        const insufficient = canPay && bal?.insufficient === true;
        if (canPay) {
          return {
            label: payButtonLabel(insufficient),
            onPress: confirmPay,
            disabled: phase === 'paying' || phase === 'paid' || insufficient,
            icon: phase === 'paid'
              ? <Icon name="check" size={18} color={pal.bg}/>
              : <Icon name="wallet" size={18} color={pal.bg}/>,
          };
        }
        // Non-`exact` schemes / unsupported networks / unknown assets: fall back
        // to opening the endpoint in the browser to pay there.
        return {
          label: 'Open endpoint',
          onPress: openEndpoint,
          icon: <Icon name="externalLink" size={18} color={pal.bg}/>,
        };
      }}
    />
  );
}
