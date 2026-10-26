import { Text } from '@stage-labs/kit/react-native/text';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Button } from '@stage-labs/kit/react-native/button';
import { shortAddress } from '@stage-labs/client/identity/format';
import { fmtSigValue } from './helpers';
import type { SignatureRequestContent, SignatureReferenceContent } from '@stage-labs/client/xmtp/sign';
import { usePalette } from '../../lib/theme';
import { timeAgo } from '../../lib/format';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';
import { ATTACHMENT_MAX_WIDTH } from './imageBox.model';
import { IconCheckmark1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCheckmark1';
import { IconPencil } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPencil';
import { Column, Row } from '../layout';

function stringifyPrimitive(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'bigint' || typeof v === 'boolean') return String(v);
  return undefined;
}

function detailColors(dark: boolean): { fill: string; border: string } {
  return {
    fill: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    border: dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
  };
}

function SenderNote({ note, fill, border }: { note: string; fill: string; border: string }): React.ReactElement {
  return (
    <Column radius="md" background={fill} padding={8} style={{ borderWidth: 1, borderColor: border }}>
      <Text size="3xs" color="secondary">Sender's note (untrusted)</Text>
      <Text size="3xs" numberOfLines={4}>{note}</Text>
    </Column>
  );
}

function Eip712DomainLine({ domain }: {
  domain: { name?: unknown; chainId?: unknown } | undefined;
}): React.ReactElement | null {
  const domainName = stringifyPrimitive(domain?.name);
  const chainId = stringifyPrimitive(domain?.chainId);
  if (!domainName && !chainId) return null;
  return (
    <Text size="3xs" color="secondary">
      {domainName ?? 'Domain'}{chainId ? ` · chain ${chainId}` : ''}
    </Text>
  );
}

function Eip712FieldRow({ name, value }: { name: string; value: unknown }): React.ReactElement {
  return (
    <Row align="start" gap={8}>
      <Text size="3xs" color="secondary" style={{ minWidth: 80, flexShrink: 0 }}>{name}</Text>
      <Text fontFamily="mono" size="3xs" numberOfLines={4} style={{ flexShrink: 1, flex: 1 }}>
        {fmtSigValue(value)}
      </Text>
    </Row>
  );
}

function Eip712Detail({ req, fill, border }: {
  req: SignatureRequestContent; fill: string; border: string;
}): React.ReactElement {
  const domain = req.eip712?.domain as { name?: unknown; chainId?: unknown } | undefined;
  const primaryType = req.eip712?.primaryType;
  const fields = req.eip712?.message ? Object.entries(req.eip712.message) : [];
  return (
    <Column radius="md" background={fill} padding={10} gap={6} style={{ borderWidth: 1, borderColor: border }}>
      <Eip712DomainLine domain={domain} />
      {primaryType ? <Text fontWeight="semibold" size="3xs">{primaryType}</Text> : null}
      {fields.map(([k, v]) => <Eip712FieldRow key={k} name={k} value={v} />)}
    </Column>
  );
}

function MessageDetail({ message, fill, border }: { message: string; fill: string; border: string }): React.ReactElement {
  return (
    <Column radius="md" background={fill} padding={10} style={{ borderWidth: 1, borderColor: border }}>
      <Text fontFamily="mono" size="3xs" numberOfLines={20} style={{ lineHeight: 18 }}>{message}</Text>
    </Column>
  );
}

function SigAction({ gated, dark, signing, onSign }: {
  gated: boolean; dark: boolean; signing?: boolean; onSign: () => void;
}): React.ReactElement {
  const pal = usePalette();
  if (gated) {
    return (
      <Text size="3xs" color="secondary" style={{ marginTop: 2 }}>
        Accept this conversation to enable signing.
      </Text>
    );
  }
  return (
    <Button variant="primary"
      size="lg" block dark={dark} loading={signing} onPress={onSign} label="Sign"
      iconStart={<Glyph icon={IconPencil} size={18} color={pal.bg}/>}
      tintBg={pal.primary} tintFg={pal.bg} style={{ marginTop: 2 }}
    />
  );
}

export function SigRequestCard({ req, dark, signing, onSign, consentAllowed }: {
  req: SignatureRequestContent; dark: boolean; signing?: boolean;
  onSign?: () => void;
  consentAllowed?: boolean;
}): React.ReactElement {
  const title = req.kind === 'eip712' ? `Sign ${req.eip712?.primaryType ?? 'typed data'}` : 'Sign message';
  const senderNote = req.description?.trim();
  const gated = consentAllowed === false;
  const { fill, border } = detailColors(dark);
  const pal = usePalette();
  return (
    <Column radius={BLOCK_RADIUS_DEFAULT} background={pal.border} padding={12} margin={{ top: 8 }} gap={8} maxWidth={ATTACHMENT_MAX_WIDTH} style={{ alignSelf: 'stretch' }}>
      <Row align="center" gap={8}>
        <Glyph icon={IconPencil} size={18} color={pal.link}/>
        <Text fontWeight="semibold" size="xs" style={{ flexShrink: 1 }}>{title}</Text>
      </Row>
      {senderNote ? <SenderNote note={senderNote} fill={fill} border={border} /> : null}
      {req.kind === 'eip712' ? (
        <Eip712Detail req={req} fill={fill} border={border} />
      ) : req.message ? (
        <MessageDetail message={req.message} fill={fill} border={border} />
      ) : null}
      {onSign ? <SigAction gated={gated} dark={dark} signing={signing} onSign={onSign} /> : null}
    </Column>
  );
}

export function ReceiptBox({ dark, title, children }: {
  dark: boolean; title: string; children: React.ReactNode;
}): React.ReactElement {
  return (
    <Column radius={BLOCK_RADIUS_DEFAULT} background={dark ? 'rgba(120,200,120,0.08)' : 'rgba(60,160,60,0.06)'} padding={12} margin={{ top: 8 }} gap={6} maxWidth={ATTACHMENT_MAX_WIDTH} style={{ alignSelf: 'stretch', borderWidth: 1, borderColor: dark ? 'rgba(120,200,120,0.4)' : 'rgba(60,160,60,0.35)' }}>
      <Row align="center" gap={8}>
        <Glyph icon={IconCheckmark1} size={18} color={dark ? '#7fd07f' : '#2f9e44'}/>
        <Text fontWeight="semibold" size="md" color={dark ? '#ffffff' : '#000000'} style={{ flexShrink: 1 }}>
          {title}
        </Text>
      </Row>
      {children}
    </Column>
  );
}

export function SigReferenceCard({ ref, ts, dark }: {
  ref: SignatureReferenceContent; ts: string; dark: boolean;
}): React.ReactElement {
  const short = (h?: string): string => (h && h.length > 14 ? `${h.slice(0, 8)}…${h.slice(-4)}` : (h ?? ''));
  return (
    <ReceiptBox dark={dark} title="Signed ✓">
      <Text size="sm" color="secondary">
        {timeAgo(ts, Date.now())}{ref.signer ? ` · by ${shortAddress(ref.signer)}` : ''}
      </Text>
      <Text size="sm" color="secondary">{short(ref.signature)}</Text>
    </ReceiptBox>
  );
}
