/** x402 payment card for a plain http(s) link that turned out to be an x402
 *  payment endpoint. The link-preview proxy probes the URL; when it answers
 *  HTTP 402 with an x402 challenge (coinbase/x402), `useLinkPreview` returns the
 *  normalised challenge and this card renders a payment-request-style bubble:
 *  amount + asset + recipient (mirroring MessengerBubble TxRequestCard), PLUS
 *  the endpoint URL and a small `x402` badge.
 *
 *  Pay capability: for the `exact` scheme on a known network paying a known asset
 *  (USDC) we run the full in-app x402 pay path (lib/x402.pay.ts): sign an
 *  EIP-3009 `transferWithAuthorization` authorization with the in-app wallet,
 *  base64 it into an X-PAYMENT header, and POST it to the link-proxy
 *  `/x402-settle` endpoint which replays the resource GET server-side. No gas, no
 *  on-chain tx from the app. For any other scheme/network/asset we fall back to
 *  "Open endpoint" (display-only). Insufficient USDC disables Pay with a hint. */

import { useState } from 'react';
import { Alert, Linking } from 'react-native';

import { Pressable } from '@metro-labs/kit/pressable';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Button } from '@metro-labs/kit/button';
import { stampTokenUrl } from '@metro-labs/kit/avatar';
import { Row, Box } from './layout';
import { TokenAvatar } from './tabs/WalletScreen.tokenAvatar';
import { usePayerBalance } from './MessengerBubble.balance';
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
import { usePalette, useBlockRadius, withAlpha } from '../lib/theme';

type PayPhase = 'idle' | 'paying' | 'paid' | 'failed';

export function X402Card({ challenge, dark }: {
  challenge: X402Challenge; dark?: boolean;
}): React.ReactElement | null {
  const pal = usePalette();
  const blockRadius = useBlockRadius();
  const accept = challenge.accepts[0];
  const [phase, setPhase] = useState<PayPhase>('idle');

  const endpoint = challenge.endpoint || '';
  const desc = accept?.description || challenge.error || 'Payment required';
  const amountLabel = accept ? x402AmountLabel(accept) : undefined;
  const network = accept ? x402NetworkLabel(accept.network) : '';
  const chainNum = accept ? x402ChainNumber(accept.network) : 1;
  const logoUrl = accept ? stampTokenUrl(chainNum, x402AssetForAvatar(accept), 36) : '';

  const canPay = !!accept && x402CanPayInApp(accept);
  const asset = accept ? x402KnownAsset(accept) : undefined;
  const needed = accept ? x402AmountNumber(accept) : undefined;
  // Payer's balance of the challenge asset on the challenge chain. Always shown
  // when we know the asset (symbol) + chain — mirrors the in-chat payment card
  // (TxRequestCard) so the user always sees what they hold before paying.
  const hasKnownAsset = !!asset && !!accept?.asset;
  const bal = usePayerBalance(
    hasKnownAsset ? chainNum : undefined,
    hasKnownAsset ? accept?.asset : undefined,
    hasKnownAsset ? asset?.symbol : undefined,
    hasKnownAsset ? needed : undefined,
  );
  const insufficient = canPay && bal?.insufficient === true;

  if (!accept) return null;

  const openEndpoint = (): void => { if (endpoint) void Linking.openURL(endpoint); };

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

  // The primary action label/handler depends on capability + phase.
  const payButtonLabel = (): string => {
    if (phase === 'paid') return 'Paid';
    if (phase === 'paying') return 'Paying...';
    if (phase === 'failed') return 'Retry payment';
    if (insufficient) return `Insufficient ${asset?.symbol ?? 'balance'}`;
    return amountLabel ? `Pay ${amountLabel}` : 'Pay';
  };

  return (
    <Box radius={blockRadius} background={withAlpha(pal.primary, 0.08)} padding={12} margin={{ top: 8 }} gap={8} style={{ alignSelf: 'stretch' }}>
      <Row align="center" justify="between" gap={8}>
        <Row align="center" gap={10} style={{ flexShrink: 1 }}>
          <TokenAvatar logoUrl={logoUrl} chainId={chainNum} bg={withAlpha(pal.primary, 0.08)} border={pal.border}/>
          <Text weight="semibold" size="md" color={pal.text} style={{ flexShrink: 1 }} numberOfLines={2}>
            {desc}
          </Text>
        </Row>
        {/* x402 protocol badge — small primary-tinted pill, no shadow/gradient. */}
        <Box radius={999} background={withAlpha(pal.primary, 0.16)} padding={{ x: 8, y: 3 }}>
          <Text weight="semibold" size="3xs" color={pal.primary}>x402</Text>
        </Box>
      </Row>
      {amountLabel ? (
        <Text weight="semibold" size="5xl" color={pal.link}>
          {amountLabel}
        </Text>
      ) : null}
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
      {/* Balance line — always shown for a known asset; mirrors the in-chat
          payment card (danger-tinted when below the requested amount). */}
      {bal ? (
        <Text size="xs" color={bal.insufficient ? pal.danger : pal.sub} numberOfLines={1}>
          {bal.text}
        </Text>
      ) : null}
      {/* Endpoint URL — what you'd be paying for. Tappable. */}
      <Pressable onPress={openEndpoint}>
        <Row align="center" gap={6}>
          <Icon name="link" size={13} color={pal.sub}/>
          <Text size="xs" color={pal.link} numberOfLines={1} style={{ flexShrink: 1 }}>
            {domainOf(endpoint)}
          </Text>
        </Row>
      </Pressable>
      {canPay ? (
        <Button
          variant="primary"
          size="lg"
          fullWidth
          radius={24}
          dark={dark}
          disabled={phase === 'paying' || phase === 'paid' || insufficient}
          onPress={confirmPay}
          label={payButtonLabel()}
          iconStart={phase === 'paid'
            ? <Icon name="check" size={18} color={pal.bg}/>
            : <Icon name="wallet" size={18} color={pal.bg}/>}
          tintBg={pal.primary}
          tintFg={pal.bg}
          style={{ marginTop: 2 }}
        />
      ) : (
        // Non-`exact` schemes / unsupported networks / unknown assets: fall back
        // to opening the endpoint in the browser to pay there.
        <Button
          variant="primary"
          size="lg"
          fullWidth
          radius={24}
          dark={dark}
          onPress={openEndpoint}
          label="Open endpoint"
          iconStart={<Icon name="externalLink" size={18} color={pal.bg}/>}
          tintBg={pal.primary}
          tintFg={pal.bg}
          style={{ marginTop: 2 }}
        />
      )}
    </Box>
  );
}
