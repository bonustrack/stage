/** In-chat signature + transaction cards for MessengerBubble (phase-2 split). */
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';

import { Pressable } from '@metro-labs/kit/pressable';
import { Avatar } from './Avatar';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Button } from '@metro-labs/kit/button';
import { Row, Col, Box } from './layout';
import { shortAddress } from '../modules/messaging';
import { fmtSigValue, ethFromWeiHex } from './MessengerBubble.helpers';
import type { SigRequest, SigReference, TxRequest, TxReceipt } from './MessengerBubble.helpers';
import { usePalette, useBlockRadius, withAlpha } from '../lib/theme';
import { usePeerProfiles, getPeerName } from '../lib/peerProfiles';
import { PaymentCard } from './PaymentCard';
import { NATIVE_TOKEN_SENTINEL, VIEM_CHAINS } from '@stage-labs/client/wallet/assets';
import { stampTokenUrl } from '@metro-labs/kit/avatar';
import { chainIdToNumber, explorerTxUrl } from '@stage-labs/client/xmtp/tx';
import { isCardActionBlocked } from '../lib/consentGate';
import { useDecodedCall, spoofWarning, type DecodedCall } from '../lib/txDecode';
// SigRequestCard — signature-request bubble: trusted (app-derived) title + the
// typed-data/message detail. The peer-supplied `description` is rendered
// SEPARATELY and labelled sender-provided, never as the prominent trusted
// summary (a phishing request could otherwise mislabel a Permit2 as a benign
// "Sign in"). `consentAllowed === false` disables the Sign action for an
// unaccepted (stranger) conversation.
export function SigRequestCard({ req, dark, sub, signing, onSign, consentAllowed }: {
  req: SigRequest; dark: boolean; sub: string; signing?: boolean;
  onSign?: () => void;
  /** undefined = unknown/not gated (allowed convs), false = stranger -> block. */
  consentAllowed?: boolean;
}): React.ReactElement {
  /** TRUSTED title derived by the app from the request kind/typedata — NOT the
   *  peer's free-text description. */
  const title = req.kind === 'eip712' ? `Sign ${req.eip712?.primaryType ?? 'typed data'}` : 'Sign message';
  /** Peer-supplied note, shown separately + clearly marked untrusted. */
  const senderNote = req.description?.trim();
  const gated = isCardActionBlocked(consentAllowed);
  const detailBg = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const detailBorder = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
  const pal = usePalette(); const blockRadius = useBlockRadius();
  const head = pal.link; // #ffffff / #000000
  const domain = req.eip712?.domain as { name?: unknown; chainId?: unknown } | undefined;
  const domainName = domain?.name != null ? String(domain.name) : undefined;
  const chainId = domain?.chainId != null ? String(domain.chainId) : undefined;
  const fields = req.kind === 'eip712' && req.eip712?.message
    ? Object.entries(req.eip712.message)
    : [];
  return (
    <Box radius={blockRadius} background={pal.border} padding={12} margin={{ top: 8 }} gap={8} style={{ alignSelf: 'stretch' }}>
      <Row align="center" gap={8}>
        <Icon name="pencil" size={18} color={head}/>
        <Text weight="semibold" size="md" style={{ flexShrink: 1 }}>
          {title}
        </Text>
      </Row>
      {senderNote ? (
        <Box radius="md" background={detailBg} padding={8} style={{ borderWidth: 1, borderColor: detailBorder }}>
          <Text size="xs" role="secondary">Sender's note (untrusted)</Text>
          <Text size="xs" numberOfLines={4}>{senderNote}</Text>
        </Box>
      ) : null}
      {req.kind === 'eip712' ? (
        <Col radius="md" background={detailBg} padding={10} gap={6} style={{ borderWidth: 1, borderColor: detailBorder }}>
          {(domainName || chainId) ? (
            <Text size="xs" color={sub}>
              {domainName ?? 'Domain'}{chainId ? ` · chain ${chainId}` : ''}
            </Text>
          ) : null}
          {req.eip712?.primaryType ? (
            <Text weight="semibold" size="xs">
              {req.eip712.primaryType}
            </Text>
          ) : null}
          {fields.map(([k, v]) => (
            <Row key={k} align="start" gap={8}>
              <Text size="xs" color={sub} style={{ minWidth: 80, flexShrink: 0 }}>
                {k}
              </Text>
              <Text variant="mono" size="xs" numberOfLines={4} style={{ flexShrink: 1, flex: 1 }}>
                {fmtSigValue(v)}
              </Text>
            </Row>
          ))}
        </Col>
      ) : req.message ? (
        <Box radius="md" background={detailBg} padding={10} style={{ borderWidth: 1, borderColor: detailBorder }}>
          <Text variant="mono" size="xs" numberOfLines={20} style={{ lineHeight: 18 }}>
            {req.message}
          </Text>
        </Box>
      ) : null}
      {onSign ? (
        gated ? (
          <Text size="xs" role="secondary" style={{ marginTop: 2 }}>
            Accept this conversation to enable signing.
          </Text>
        ) : (
          <Button
            variant="primary"
            size="lg"
            block
            dark={dark}
            loading={signing}
            onPress={onSign}
            label="Sign"
            iconStart={<Icon name="pencil" size={18} color={pal.bg}/>}
            tintBg={pal.primary}
            tintFg={pal.bg}
            style={{ marginTop: 2 }}
/>
        )
      ) : null}
    </Box>
  );
}
/** SigReferenceCard — a completed signature: "Signed ✓" + signer + short sig. */
export function SigReferenceCard({ ref, dark, sub }: {
  ref: SigReference; dark: boolean; sub: string;
}): React.ReactElement {
  const short = (h?: string): string => (h && h.length> 14 ? `${h.slice(0, 8)}…${h.slice(-4)}` : (h ?? '')); const blockRadius = useBlockRadius();
  return (
    <Box radius={blockRadius} background={dark ? 'rgba(120,200,120,0.08)' : 'rgba(60,160,60,0.06)'} padding={12} margin={{ top: 8 }} gap={6} style={{ alignSelf: 'stretch', borderWidth: 1, borderColor: dark ? 'rgba(120,200,120,0.4)' : 'rgba(60,160,60,0.35)' }}>
      <Row align="center" gap={8}>
        <Icon name="check" size={18} color={dark ? '#7fd07f' : '#2f9e44'}/>
        <Text weight="semibold" size="md" color={dark ? '#ffffff' : '#000000'}>
          Signed ✓
        </Text>
      </Row>
      {ref.signer ? (
        <Text size="xs" color={sub}>
          by {shortAddress(ref.signer)}
        </Text>
      ) : null}
      <Text size="xs" color={sub}>
        {short(ref.signature)}
      </Text>
    </Box>
  );
}
/** TxRequestCard — in-chat payment request. Thin wrapper over the shared
 *  PaymentCard: it computes the amount/recipient/token from the tx request and
 *  passes its own "Pay" action (the caller's onPay runs walletSendCalls /
 *  sendCall). The recipient line is a tappable profile link (TxToRow). */
export function TxRequestCard({ req, dark, sub, paying, onPay, consentAllowed }: {
  req: TxRequest; dark: boolean; sub: string; paying?: boolean;
  onPay?: () => void;
  /** undefined = unknown/not gated (allowed convs), false = stranger -> block. */
  consentAllowed?: boolean;
}): React.ReactElement {
  const pal = usePalette();
  const gated = isCardActionBlocked(consentAllowed);
  const call = req.calls[0];
  const desc = call?.metadata?.description ?? 'Payment request';
  const eth = ethFromWeiHex(call?.value);
  const amountLabel = call?.metadata?.amount != null
    ? `${call.metadata.amount} ${call.metadata.currency ?? 'ETH'}`
    : eth ? `${eth} ETH` : undefined;
  // For ERC20 requests `call.to` is the token contract; the real recipient is
  // carried in `metadata.toAddress`. Prefer it when present.
  const recipient = call?.metadata?.toAddress ?? call?.to;
  // ERC20 when the recipient (metadata.toAddress) differs from call.to — then
  // call.to is the token contract. Native ETH otherwise.
  const tokenAddr = call?.metadata?.toAddress ? call?.to : undefined;
  /** Token logo + network badge, exactly like the wallet token row. ERC20 uses
   *  the token contract; native ETH uses the stamp native sentinel. STAGE has no
   *  logo so the URL 404s and TokenAvatar falls back to the border circle. */
  const chainNum = chainIdToNumber(req.chainId ?? '0x1');
  const logoUrl = stampTokenUrl(chainNum, tokenAddr ?? NATIVE_TOKEN_SENTINEL, 36);
  // DECODED CALL: resolve what the calldata ACTUALLY does (Sourcify ABI ->
  // function + named args, 4byte fallback). null for a plain ETH transfer (no
  // data); for a known ERC-20 transfer we keep the friendly amount view below and
  // only surface the decode as a warning if it disagrees. Any OTHER contract call
  // renders the decoded block so the user trusts the decode, not the description.
  const { call: decoded, pending: decoding } = useDecodedCall(call?.to, call?.data, chainNum);
  const isErc20Transfer = !!tokenAddr; // metadata.toAddress present => transfer(token)
  const showDecodedBlock = !!call?.data && call.data !== '0x' && !isErc20Transfer;
  const warning = spoofWarning(decoded, call?.metadata?.description);
  // Show the balance whenever there's something to read: a known currency, a
  // native ETH transfer, or an ERC-20 token contract (even an unknown one —
  // usePayerBalance resolves symbol/decimals on-chain for unregistered tokens).
  const showBalance = !!call?.metadata?.currency || !!eth || !!tokenAddr;
  return (
    <PaymentCard
      dark={dark}
      logoUrl={logoUrl}
      chainNum={chainNum}
      description={desc}
      amountLabel={showDecodedBlock ? undefined : amountLabel}
      detail={
        <Col gap={8} style={{ alignSelf: 'stretch' }}>
          {warning ? <TxWarning text={warning} /> : null}
          {showDecodedBlock ? (
            <DecodedCallBlock decoded={decoded} pending={decoding} target={call?.to} sub={sub} selector={decoded?.selector}/>
          ) : null}
          {recipient ? <TxToRow address={recipient} /> : null}
          <Text size="xs" color={sub}>On {VIEM_CHAINS[chainNum]?.name ?? `chain ${chainNum}`}</Text>
        </Col>
      }
      balance={{
        show: showBalance,
        chainId: req.chainId,
        token: tokenAddr,
        symbol: call?.metadata?.currency ?? (eth ? 'ETH' : undefined),
        needed: call?.metadata?.amount,
      }}
      action={(onPay && !gated) ? {
        label: 'Pay',
        onPress: onPay,
        loading: paying,
        icon: <Icon name="paperAirplane" size={18} color={pal.bg}/>,
      } : undefined}
      footer={onPay && gated ? (
        <Text size="xs" role="secondary">Accept this conversation to enable paying.</Text>
      ) : undefined}
    />
  );
}
/** TxToRow — the payment "To" line: a tappable link to the recipient's profile,
 *  with the stamp-resolved username (falls back to the short address while it
 *  loads) + a stamp.fyi avatar. Its own component so `usePeerProfiles` runs once
 *  per address (the shared cache dedupes the lookup). */
function TxToRow({ address }: { address: string }): React.ReactElement {
  const router = useRouter();
  usePeerProfiles([address]);
  const display = getPeerName(address) ?? shortAddress(address);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/user/[address]', params: { address } })}>
      <Row align="center" gap={6}>
        <Text role="secondary" size="xs">To</Text>
        <Avatar address={address} size={16} />
        <Text role="link" weight="semibold" size="lg" suppressHighlighting>
          {display}
        </Text>
      </Row>
    </Pressable>
  );
}
/** DecodedCallBlock — the trusted "what this tx actually does" view for a generic
 *  contract call: the resolved function signature + each decoded arg (name: value)
 *  + the target contract. While the ABI fetch is in flight it shows the raw
 *  selector; a failed decode shows the selector + the "could not decode" note.
 *  This is derived from the calldata, NOT the sender's description. */
function DecodedCallBlock({ decoded, pending, target, sub, selector }: {
  decoded: DecodedCall | null; pending: boolean; target?: string; sub: string; selector?: string;
}): React.ReactElement {
  const pal = usePalette();
  const detailBg = pal.border;
  const fnLabel = decoded?.signature ?? decoded?.functionName ?? selector ?? 'call';
  return (
    <Col radius="md" background={detailBg} padding={10} gap={6} style={{ alignSelf: 'stretch' }}>
      <Row align="center" gap={6}>
        <Icon name="code" size={14} color={sub}/>
        <Text size="xs" color={sub}>This transaction calls</Text>
      </Row>
      <Text variant="mono" weight="semibold" size="sm" numberOfLines={2}>
        {pending ? 'Decoding…' : fnLabel}
      </Text>
      {decoded?.args.map((a, i) => (
        <Row key={`${a.name}-${i}`} align="start" gap={8}>
          <Text size="xs" color={sub} style={{ minWidth: 80, flexShrink: 0 }}>{a.name}</Text>
          <Text variant="mono" size="xs" numberOfLines={4} style={{ flexShrink: 1, flex: 1 }}>{a.value}</Text>
        </Row>
      ))}
      {!pending && decoded && !decoded.decoded && decoded.note ? (
        <Text size="xs" color={sub}>{decoded.note}</Text>
      ) : null}
      {target ? (
        <Text size="xs" color={sub} numberOfLines={1}>Contract: {shortAddress(target)}</Text>
      ) : null}
    </Col>
  );
}
/** TxWarning — anti-spoof banner: the app could not verify the contract, could
 *  not decode the call, or the decode disagrees with the sender's description. */
function TxWarning({ text }: { text: string }): React.ReactElement {
  const pal = usePalette();
  return (
    <Box radius="md" background={withAlpha(pal.danger, 0.1)} padding={8} gap={4}
      style={{ alignSelf: 'stretch', borderWidth: 1, borderColor: pal.danger }}>
      <Row align="center" gap={6}>
        <Icon name="shieldExclamation" size={14} color={pal.danger}/>
        <Text size="xs" weight="semibold" color={pal.danger}>Check before signing</Text>
      </Row>
      <Text size="xs" color={pal.danger} numberOfLines={4}>{text}</Text>
    </Box>
  );
}
/** TxReceiptCard — a confirmed payment: amount + tappable explorer link. */
export function TxReceiptCard({ receipt, dark }: {
  receipt: TxReceipt; dark: boolean;
}): React.ReactElement {
  const amountLabel = receipt.metadata?.amount != null
    ? `${receipt.metadata.amount} ${receipt.metadata.currency ?? 'ETH'}`
    : undefined;
  const url = explorerTxUrl(receipt.networkId, receipt.reference);
  const blockRadius = useBlockRadius(); const pal = usePalette();
  return (
    <Box radius={blockRadius} background={dark ? 'rgba(120,200,120,0.08)' : 'rgba(60,160,60,0.06)'} padding={12} margin={{ top: 8 }} gap={6} style={{ alignSelf: 'stretch', borderWidth: 1, borderColor: dark ? 'rgba(120,200,120,0.4)' : 'rgba(60,160,60,0.35)' }}>
      <Row align="center" gap={8}>
        <Icon name="check" size={18} color={dark ? '#7fd07f' : '#2f9e44'}/>
        <Text weight="semibold" size="md" color={dark ? '#ffffff' : '#000000'}>
          Payment sent{amountLabel ? ` · ${amountLabel}` : ''}
        </Text>
      </Row>
      <Pressable onPress={() => void Linking.openURL(url)}>
        <Text size="xs" color={pal.link}>
          {shortAddress(receipt.reference)} · View on explorer
        </Text>
      </Pressable>
    </Box>
  );
}
