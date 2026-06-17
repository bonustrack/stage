/** DecodedCallBlock — the trusted "what this tx actually does" view for a generic
 *  contract call, split out of MessengerBubble.cards.tsx to keep that file under
 *  the 400-line cap. Derived from the calldata, NOT the sender's description. */
import { useState } from 'react';

import { Pressable } from '@metro-labs/kit/pressable';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Row, Col } from './layout';
import { shortAddress } from '../modules/messaging';
import { usePalette, CLEAR_SIGN_TEAL } from '../lib/theme';
import { intentSentence } from '../lib/intentSentence';
import type { DecodedCall } from '../lib/txDecode';

/** Shorten a decoded arg value for display: 0x-addresses (and address-like 42-char
 *  hex) are truncated; everything else (strings, big numbers) is shown as-is. */
function fmtArgValue(v: string): string {
  if (/^0x[0-9a-fA-F]{40}$/.test(v)) return shortAddress(v);
  return v;
}

/** When a bundled ERC-7730 descriptor matched (clear-signed), LEAD with the human
 *  intent sentence (teal) and demote the raw signature/arg/contract block behind a
 *  "View raw call" toggle. When NOT clear-signed (raw decode is all we have), show
 *  the signature + args + contract directly. */
export function DecodedCallBlock({ decoded, pending, target, sub, selector }: {
  decoded: DecodedCall | null; pending: boolean; target?: string; sub: string; selector?: string;
}): React.ReactElement {
  const pal = usePalette();
  const detailBg = pal.border;
  const [showRaw, setShowRaw] = useState(false);
  // For a verified-contract selector mismatch, never show a clean-looking
  // signature as if it were a real call — show the raw selector instead; the red
  // TxWarning above carries the "looks like X but no such function" detail.
  const fnLabel = decoded?.source === 'mismatch'
    ? (selector ?? decoded?.selector ?? 'unknown function')
    : (decoded?.signature ?? decoded?.functionName ?? selector ?? 'call');
  const clearSigned = !!decoded?.intent;
  const lead = decoded ? intentSentence(decoded) : undefined;
  // The raw signature + per-arg + contract footer. Shown directly when NOT
  // clear-signed; tucked behind the toggle when clear-signed.
  const rawDetail = (
    <>
      <Text variant="mono" weight="semibold" size="sm" numberOfLines={2}>
        {pending ? 'Decoding…' : fnLabel}
      </Text>
      {decoded?.args.map((a, i) => (
        <Row key={`${a.name}-${i}`} align="start" gap={8}>
          {/* Prefer the ERC-7730 label ("Amount", "Spender") when present; else the
              ABI/4byte param name + type, e.g. "content (string)". */}
          <Text size="xs" color={a.label ? CLEAR_SIGN_TEAL : sub} style={{ minWidth: 80, flexShrink: 0 }} numberOfLines={2}>
            {a.label ?? `${a.name}${a.type ? ` (${a.type})` : ''}`}
          </Text>
          {/* Prefer the ERC-7730 formatted value ("5 USDC", a checksum address, a
              date) when present; else the raw decoded value. The 7730 value is
              teal so it's distinct from the raw decode. */}
          <Text variant="mono" size="xs" color={a.formatted ? CLEAR_SIGN_TEAL : undefined} numberOfLines={4} style={{ flexShrink: 1, flex: 1 }}>
            {a.formatted ?? fmtArgValue(a.value)}
          </Text>
        </Row>
      ))}
      {!pending && decoded?.note && decoded.source !== 'mismatch' ? (
        <Text size="xs" color={sub}>{decoded.note}</Text>
      ) : null}
      {target ? (
        <Text size="xs" color={sub} numberOfLines={1}>Contract: {shortAddress(target)}</Text>
      ) : null}
    </>
  );
  return (
    <Col radius="md" background={detailBg} padding={10} gap={6} style={{ alignSelf: 'stretch' }}>
      <Row align="center" gap={6}>
        <Icon name="code" size={14} color={clearSigned ? CLEAR_SIGN_TEAL : sub}/>
        {/* PROMINENT clear-signed intent sentence ("Approve Permit2 to spend
            Unlimited USDC"); else the neutral "This transaction calls". */}
        <Text size={clearSigned ? 'sm' : 'xs'} weight={clearSigned ? 'semibold' : undefined}
          color={clearSigned ? CLEAR_SIGN_TEAL : sub} numberOfLines={3} style={{ flexShrink: 1, flex: 1 }}>
          {lead ?? 'This transaction calls'}
        </Text>
      </Row>
      {clearSigned ? (
        <>
          <Pressable onPress={() => setShowRaw((v) => !v)}>
            <Text size="xs" color={sub}>{showRaw ? 'Hide raw call' : 'View raw call'}</Text>
          </Pressable>
          {showRaw ? <Col gap={6}>{rawDetail}</Col> : null}
        </>
      ) : rawDetail}
    </Col>
  );
}
