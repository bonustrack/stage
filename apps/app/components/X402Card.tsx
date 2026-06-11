/** x402 payment card for a plain http(s) link that turned out to be an x402
 *  payment endpoint. The link-preview proxy probes the URL; when it answers
 *  HTTP 402 with an x402 challenge (coinbase/x402), `useLinkPreview` returns the
 *  normalised challenge and this card renders a payment-request-style bubble:
 *  amount + asset + recipient (mirroring MessengerBubble TxRequestCard), PLUS
 *  the endpoint URL and a small `x402` badge.
 *
 *  v1 pay capability (honest scope): the x402 `exact` scheme is NOT a plain
 *  on-chain transfer we can push through the in-app pay/confirm sheet — it
 *  requires an off-chain EIP-3009 / Permit2 signed payload returned to the
 *  server via the `PAYMENT-SIGNATURE` header and settled by a facilitator. That
 *  full signed-payload + facilitator round-trip isn't wired yet, so the action
 *  is "Open endpoint" (display-only). When/if a challenge is a fulfillable plain
 *  transfer we recognise, we can swap in the in-app pay path here. See the PR. */

import { Linking } from 'react-native';

import { Pressable } from '@metro-labs/kit/pressable';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Button } from '@metro-labs/kit/button';
import { stampTokenUrl } from '@metro-labs/kit/avatar';
import { Row, Box } from './layout';
import { TokenAvatar } from './tabs/WalletScreen.tokenAvatar';
import { shortAddress } from '../modules/messaging';
import { domainOf } from '../lib/genericLinkDetect';
import {
  x402AmountLabel,
  x402NetworkLabel,
  x402ChainNumber,
  x402AssetForAvatar,
} from '../lib/x402';
import type { X402Challenge } from '../lib/useLinkPreview';
import { usePalette, useBlockRadius, withAlpha } from '../lib/theme';

export function X402Card({ challenge, dark }: {
  challenge: X402Challenge; dark?: boolean;
}): React.ReactElement | null {
  const pal = usePalette();
  const blockRadius = useBlockRadius();
  const accept = challenge.accepts[0];
  if (!accept) return null;

  const endpoint = challenge.endpoint || '';
  const desc = accept.description || challenge.error || 'Payment required';
  const amountLabel = x402AmountLabel(accept);
  const network = x402NetworkLabel(accept.network);
  const chainNum = x402ChainNumber(accept.network);
  const logoUrl = stampTokenUrl(chainNum, x402AssetForAvatar(accept), 36);

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
      {/* Endpoint URL — what you'd be paying for. Tappable. */}
      <Pressable onPress={() => endpoint && void Linking.openURL(endpoint)}>
        <Row align="center" gap={6}>
          <Icon name="link" size={13} color={pal.sub}/>
          <Text size="xs" color={pal.link} numberOfLines={1} style={{ flexShrink: 1 }}>
            {domainOf(endpoint)}
          </Text>
        </Row>
      </Pressable>
      <Button
        variant="primary"
        size="lg"
        fullWidth
        radius={24}
        dark={dark}
        onPress={() => endpoint && void Linking.openURL(endpoint)}
        label="Open endpoint"
        iconStart={<Icon name="externalLink" size={18} color={pal.bg}/>}
        tintBg={pal.primary}
        tintFg={pal.bg}
        style={{ marginTop: 2 }}
      />
    </Box>
  );
}
