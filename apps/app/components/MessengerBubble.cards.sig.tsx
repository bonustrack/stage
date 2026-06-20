/** @file Signature-request and signature-reference cards for MessengerBubble (split from cards). */
import { Text } from '@stage-labs/kit/text';
import { Icon } from '@stage-labs/kit/icon';
import { Button } from '@stage-labs/kit/button';
import { Row, Col, Box } from './layout';
import { shortAddress } from '../modules/messaging';
import { fmtSigValue } from './MessengerBubble.helpers';
import type { SigRequest, SigReference } from './MessengerBubble.helpers';
import { usePalette, useBlockRadius } from '../lib/theme';
import { isCardActionBlocked } from '../lib/consentGate';

/** Stringify only primitive EIP-712 domain fields; ignore objects so we never render '[object Object]'. */
function stringifyPrimitive(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'bigint' || typeof v === 'boolean') return String(v);
  return undefined;
}

/** Detail bg/border tuple for a sig card's inner blocks, theme-aware. */
function detailColors(dark: boolean): { bg: string; border: string } {
  return {
    bg: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    border: dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
  };
}

/** Renders the peer-supplied, untrusted "Sender's note" block. */
function SenderNote({ note, bg, border }: { note: string; bg: string; border: string }): React.ReactElement {
  return (
    <Box radius="md" background={bg} padding={8} style={{ borderWidth: 1, borderColor: border }}>
      <Text size="xs" role="secondary">Sender's note (untrusted)</Text>
      <Text size="xs" numberOfLines={4}>{note}</Text>
    </Box>
  );
}

/** Renders the domain header line of an EIP-712 detail block, or null when absent. */
function Eip712DomainLine({ domain, sub }: {
  domain: { name?: unknown; chainId?: unknown } | undefined; sub: string;
}): React.ReactElement | null {
  const domainName = stringifyPrimitive(domain?.name);
  const chainId = stringifyPrimitive(domain?.chainId);
  if (!domainName && !chainId) return null;
  return (
    <Text size="xs" color={sub}>
      {domainName ?? 'Domain'}{chainId ? ` · chain ${chainId}` : ''}
    </Text>
  );
}

/** Renders one decoded EIP-712 message field row (key + formatted value). */
function Eip712FieldRow({ name, value, sub }: { name: string; value: unknown; sub: string }): React.ReactElement {
  return (
    <Row align="start" gap={8}>
      <Text size="xs" color={sub} style={{ minWidth: 80, flexShrink: 0 }}>{name}</Text>
      <Text variant="mono" size="xs" numberOfLines={4} style={{ flexShrink: 1, flex: 1 }}>
        {fmtSigValue(value)}
      </Text>
    </Row>
  );
}

/** Renders the decoded EIP-712 typed-data detail (domain, primary type, fields). */
function Eip712Detail({ req, sub, bg, border }: {
  req: SigRequest; sub: string; bg: string; border: string;
}): React.ReactElement {
  const domain = req.eip712?.domain as { name?: unknown; chainId?: unknown } | undefined;
  const primaryType = req.eip712?.primaryType;
  const fields = req.eip712?.message ? Object.entries(req.eip712.message) : [];
  return (
    <Col radius="md" background={bg} padding={10} gap={6} style={{ borderWidth: 1, borderColor: border }}>
      <Eip712DomainLine domain={domain} sub={sub} />
      {primaryType ? <Text weight="semibold" size="xs">{primaryType}</Text> : null}
      {fields.map(([k, v]) => <Eip712FieldRow key={k} name={k} value={v} sub={sub} />)}
    </Col>
  );
}

/** Renders the plain-message detail block for a non-typed-data sign request. */
function MessageDetail({ message, bg, border }: { message: string; bg: string; border: string }): React.ReactElement {
  return (
    <Box radius="md" background={bg} padding={10} style={{ borderWidth: 1, borderColor: border }}>
      <Text variant="mono" size="xs" numberOfLines={20} style={{ lineHeight: 18 }}>{message}</Text>
    </Box>
  );
}

/** Renders the Sign action button, or the consent-gated hint when signing is blocked. */
function SigAction({ gated, dark, signing, onSign }: {
  gated: boolean; dark: boolean; signing?: boolean; onSign: () => void;
}): React.ReactElement {
  const pal = usePalette();
  if (gated) {
    return (
      <Text size="xs" role="secondary" style={{ marginTop: 2 }}>
        Accept this conversation to enable signing.
      </Text>
    );
  }
  return (
    <Button
      variant="primary" size="lg" block dark={dark} loading={signing} onPress={onSign} label="Sign"
      iconStart={<Icon name="pencil" size={18} color={pal.bg}/>}
      tintBg={pal.primary} tintFg={pal.bg} style={{ marginTop: 2 }}
    />
  );
}

/** Renders an in-chat signature-request card with an app-derived trusted title, the typed-data/message detail, and the peer's `description` shown separately as untrusted; `consentAllowed === false` disables Sign for stranger convs. */
export function SigRequestCard({ req, dark, sub, signing, onSign, consentAllowed }: {
  req: SigRequest; dark: boolean; sub: string; signing?: boolean;
  onSign?: () => void;
  /** undefined = unknown/not gated (allowed convs), false = stranger -> block. */
  consentAllowed?: boolean;
}): React.ReactElement {
  /** TRUSTED title derived by the app from the request kind/typedata — NOT the peer's free-text description. */
  const title = req.kind === 'eip712' ? `Sign ${req.eip712?.primaryType ?? 'typed data'}` : 'Sign message';
  /** Peer-supplied note, shown separately + clearly marked untrusted. */
  const senderNote = req.description?.trim();
  const gated = isCardActionBlocked(consentAllowed);
  const { bg, border } = detailColors(dark);
  const pal = usePalette();
  const blockRadius = useBlockRadius();
  return (
    <Box radius={blockRadius} background={pal.border} padding={12} margin={{ top: 8 }} gap={8} style={{ alignSelf: 'stretch' }}>
      <Row align="center" gap={8}>
        <Icon name="pencil" size={18} color={pal.link}/>
        <Text weight="semibold" size="md" style={{ flexShrink: 1 }}>{title}</Text>
      </Row>
      {senderNote ? <SenderNote note={senderNote} bg={bg} border={border} /> : null}
      {req.kind === 'eip712' ? (
        <Eip712Detail req={req} sub={sub} bg={bg} border={border} />
      ) : req.message ? (
        <MessageDetail message={req.message} bg={bg} border={border} />
      ) : null}
      {onSign ? <SigAction gated={gated} dark={dark} signing={signing} onSign={onSign} /> : null}
    </Box>
  );
}

/** SigReferenceCard — a completed signature: "Signed ✓" + signer + short sig. */
export function SigReferenceCard({ ref, dark, sub }: {
  ref: SigReference; dark: boolean; sub: string;
}): React.ReactElement {
  /** Short helper. */
  const short = (h?: string): string => (h && h.length > 14 ? `${h.slice(0, 8)}…${h.slice(-4)}` : (h ?? '')); const blockRadius = useBlockRadius();
  return (
    <Box radius={blockRadius} background={dark ? 'rgba(120,200,120,0.08)' : 'rgba(60,160,60,0.06)'} padding={12} margin={{ top: 8 }} gap={6} style={{ alignSelf: 'stretch', borderWidth: 1, borderColor: dark ? 'rgba(120,200,120,0.4)' : 'rgba(60,160,60,0.35)' }}>
      <Row align="center" gap={8}>
        <Icon name="check" size={18} color={dark ? '#7fd07f' : '#2f9e44'}/>
        <Text weight="semibold" size="md" color={dark ? '#ffffff' : '#000000'}>Signed ✓</Text>
      </Row>
      {ref.signer ? <Text size="xs" color={sub}>by {shortAddress(ref.signer)}</Text> : null}
      <Text size="xs" color={sub}>{short(ref.signature)}</Text>
    </Box>
  );
}
