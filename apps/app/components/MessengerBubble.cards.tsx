/** @file In-chat signature-request and transaction cards for MessengerBubble (phase-2 split). */
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';

import { Pressable } from '@metro-labs/kit/pressable';
import { Avatar } from './Avatar';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Row, Col, Box } from './layout';
import { shortAddress } from '../modules/messaging';
import { ethFromWeiHex } from './MessengerBubble.helpers';
import type { TxRequest, TxReceipt } from './MessengerBubble.helpers';
import { usePalette, useBlockRadius, withAlpha } from '../lib/theme';
import { usePeerProfiles, getPeerName } from '../lib/peerProfiles';
import { PaymentCard } from './PaymentCard';
import { VIEM_CHAINS } from '@stage-labs/client/wallet/assets';
import { tokenLogoUrl } from '../lib/txAssets';
import { useUsdValue } from '../lib/txPrices';
import { chainIdToNumber, explorerTxUrl } from '@stage-labs/client/xmtp/tx';
import { isCardActionBlocked } from '../lib/consentGate';
import { useDecodedCall, spoofWarning, type DecodedCall } from '../lib/txDecode';
import { useTxSimulation } from '../lib/txSimulate';
import { SimulationBlock } from './MessengerBubble.sim';
import { txActionLabel, isTransferRequest } from './MessengerBubble.txwording';

/** Computed fields backing a TxRequestCard render. */
interface TxCardModel {
  target?: string;
  eth?: string;
  amount?: number;
  currency?: string;
  amountLabel?: string;
  chainNum: number;
  logoUrl: string;
  desc: string;
  recipient?: string;
  tokenAddr?: string;
  decoded: DecodedCall | null;
  decoding: boolean;
  sim: ReturnType<typeof useTxSimulation>['result'];
  simulating: boolean;
  showDecodedBlock: boolean;
  sendsNativeWithCall: boolean;
  actionLabel: string;
  isTransfer: boolean;
  warning?: string;
  showBalance: boolean;
}
// SigRequestCard / SigReferenceCard live in MessengerBubble.cards.sig.tsx;
// re-exported here so existing importers keep their './MessengerBubble.cards' path.
export { SigRequestCard, SigReferenceCard } from './MessengerBubble.cards.sig';
/**
 * TxRequestCard — in-chat payment request. Thin wrapper over the shared
 *  PaymentCard: it computes the amount/recipient/token from the tx request and
 *  passes its own "Pay" action (the caller's onPay runs walletSendCalls /
 *  sendCall). The recipient line is a tappable profile link (TxToRow).
 */
export function TxRequestCard({ req, dark, sub, paying, onPay, consentAllowed }: {
  req: TxRequest; dark: boolean; sub: string; paying?: boolean;
  onPay?: () => void;
  /** undefined = unknown/not gated (allowed convs), false = stranger -> block. */
  consentAllowed?: boolean;
}): React.ReactElement {
  const pal = usePalette();
  const gated = isCardActionBlocked(consentAllowed);
  const m = useTxCardModel(req);
  const action = (onPay && !gated) ? {
    label: m.actionLabel, onPress: onPay, loading: paying,
    icon: <Icon name={m.isTransfer ? 'paperAirplane' : 'check'} size={18} color={pal.bg}/>,
  } : undefined;
  return (
    <PaymentCard
      dark={dark}
      logoUrl={m.logoUrl}
      chainNum={m.chainNum}
      description={m.desc}
      amountLabel={m.showDecodedBlock ? undefined : m.amountLabel}
      detail={<TxRequestDetail m={m} sub={sub} />}
      balance={{
        show: m.showBalance, chainId: req.chainId, token: m.tokenAddr,
        symbol: m.currency ?? (m.eth ? 'ETH' : undefined), needed: m.amount,
      }}
      action={action}
      footer={onPay && gated ? (
        <Text size="xs" role="secondary">Accept this conversation to enable paying.</Text>
      ) : undefined}
    />
  );
}
/** Static (non-hook) fields derived from a tx request's first call. */
interface TxCallFields {
  target?: string; data?: string; value?: string; eth?: string;
  amount?: number; currency?: string; desc: string; rawDesc?: string;
  amountValue?: string; amountUnit?: string;
  recipient?: string; tokenAddr?: string; chainNum: number;
  isErc20Transfer: boolean; showDecodedBlock: boolean; showBalance: boolean;
}

/** Resolve the amount value/unit display pair for a tx call. */
function amountDisplay(amount: string | number | undefined, currency: string | undefined, eth: string | undefined): {
  amountValue?: string; amountUnit?: string;
} {
  if (amount != null) return { amountValue: String(amount), amountUnit: currency ?? 'ETH' };
  return { amountValue: eth, amountUnit: eth ? 'ETH' : undefined };
}

/** Derive the boolean flags (transfer / decoded-block / balance) from resolved call fields. */
function txCallFlags(args: { data?: string; tokenAddr?: string; currency?: string; eth?: string }): {
  isErc20Transfer: boolean; showDecodedBlock: boolean; showBalance: boolean;
} {
  const isErc20Transfer = !!args.tokenAddr;
  const hasCalldata = !!args.data && args.data !== '0x';
  return {
    isErc20Transfer,
    showDecodedBlock: hasCalldata && !isErc20Transfer,
    // Show balance for a known currency, a native ETH transfer, or any token contract.
    showBalance: !!args.currency || !!args.eth || !!args.tokenAddr,
  };
}

/** Pull the raw target/data/value/metadata off a tx request's first call (safe defaults). */
function rawCall(req: TxRequest): {
  target?: string; data?: string; value?: string;
  meta: NonNullable<TxRequest['calls'][number]['metadata']>;
} {
  const call = req.calls[0];
  return { target: call?.to, data: call?.data, value: call?.value, meta: call?.metadata ?? {} };
}

/** Derive the non-hook fields (amount/recipient/token/flags) from a tx request. */
function txCallFields(req: TxRequest): TxCallFields {
  const { target, data, value, meta } = rawCall(req);
  const { amount, currency, toAddress, description } = meta;
  const eth = ethFromWeiHex(value);
  // For ERC20 requests `call.to` is the token contract; the real recipient is
  // carried in `metadata.toAddress` (present => transfer of that token).
  const tokenAddr = toAddress ? target : undefined;
  const desc = description ?? 'Payment request';
  const recipient = toAddress ?? target;
  const chainNum = chainIdToNumber(req.chainId ?? '0x1');
  return {
    target, data, value, eth, amount, currency,
    desc, rawDesc: description, recipient, tokenAddr, chainNum,
    ...amountDisplay(amount, currency, eth),
    ...txCallFlags({ data, tokenAddr, currency, eth }),
  };
}

/** Computed view-model for a TxRequestCard: static fields plus decode + simulation + price hooks. */
function useTxCardModel(req: TxRequest): TxCardModel {
  const f = txCallFields(req);
  const logoUrl = tokenLogoUrl(f.chainNum, f.tokenAddr ?? null, 36);
  const amountUsd = useUsdValue(f.chainNum, f.tokenAddr ?? null, f.amountValue);
  const amountLabel = f.amountValue && f.amountUnit
    ? `${f.amountValue} ${f.amountUnit}${amountUsd ? ` (${amountUsd})` : ''}` : undefined;
  const { call: decoded, pending: decoding } = useDecodedCall(f.target, f.data, f.chainNum);
  const { result: sim, pending: simulating } = useTxSimulation(f.target, f.data, f.value, f.chainNum);
  return {
    target: f.target, eth: f.eth, amount: f.amount, currency: f.currency,
    amountLabel, chainNum: f.chainNum, logoUrl, desc: f.desc,
    recipient: f.recipient, tokenAddr: f.tokenAddr, decoded, decoding, sim, simulating,
    showDecodedBlock: f.showDecodedBlock,
    // contract call (calldata) that ALSO sends native ETH (value > 0).
    sendsNativeWithCall: f.showDecodedBlock && !!f.eth && f.eth !== '0',
    actionLabel: txActionLabel(decoded, f.isErc20Transfer),
    isTransfer: isTransferRequest(decoded, f.isErc20Transfer),
    warning: spoofWarning(decoded, f.rawDesc),
    showBalance: f.showBalance,
  };
}
/** Renders the stacked detail column of a TxRequestCard (warning, simulation, decode, recipient, network). */
function TxRequestDetail({ m, sub }: { m: TxCardModel; sub: string }): React.ReactElement {
  return (
    <Col gap={8} style={{ alignSelf: 'stretch' }}>
      {m.warning ? <TxWarning text={m.warning} /> : null}
      <SimulationBlock sim={m.sim} pending={m.simulating} sub={sub} chainId={m.chainNum} />
      {m.showDecodedBlock ? (
        <DecodedCallBlock decoded={m.decoded} pending={m.decoding} target={m.target} sub={sub} selector={m.decoded?.selector}/>
      ) : null}
      {m.sendsNativeWithCall && m.eth ? <TxNativeValueRow eth={m.eth} chainId={m.chainNum} /> : null}
      {m.recipient ? <TxToRow address={m.recipient} /> : null}
      <Text size="xs" color={sub}>On {VIEM_CHAINS[m.chainNum]?.name ?? `chain ${m.chainNum}`}</Text>
    </Col>
  );
}
/**
 * TxToRow — the payment "To" line: a tappable link to the recipient's profile,
 *  with the stamp-resolved username (falls back to the short address while it
 *  loads) + a stamp.fyi avatar. Its own component so `usePeerProfiles` runs once
 *  per address (the shared cache dedupes the lookup).
 */
function TxToRow({ address }: { address: string }): React.ReactElement {
  const router = useRouter();
  usePeerProfiles([address]);
  const display = getPeerName(address) ?? shortAddress(address);
  return (
    <Pressable
      onPress={() => { router.push({ pathname: '/user/[address]', params: { address } }); }}>
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
/** TxNativeValueRow — surfaces native ETH that rides along with a contract call (calldata + value > 0). Without this the ETH leaving the wallet is hidden behind the function call, since the amount header is suppressed for calls. */
function TxNativeValueRow({ eth, chainId }: { eth: string; chainId: number }): React.ReactElement {
  const pal = usePalette();
  const usd = useUsdValue(chainId, null, eth);
  return (
    <Row align="center" gap={6}>
      <Icon name="paperAirplane" size={14} color={pal.link}/>
      <Text size="sm" weight="semibold">Also sends {eth} ETH{usd ? ` (${usd})` : ''} with this call</Text>
    </Row>
  );
}
/** Shorten a decoded arg value for display: 0x-addresses (and address-like 42-char hex) are truncated; everything else (strings, big numbers) is shown as-is. */
function fmtArgValue(v: string): string {
  if (/^0x[0-9a-fA-F]{40}$/.test(v)) return shortAddress(v);
  return v;
}
/**
 * DecodedCallBlock — the trusted "what this tx actually does" view for a generic
 *  contract call: the resolved function signature + each decoded arg (name: value)
 *  + the target contract. While the ABI fetch is in flight it shows the raw
 *  selector; a failed decode shows the selector + the "could not decode" note.
 *  This is derived from the calldata, NOT the sender's description.
 */
/** Resolve the function label for a decoded call, hiding clean signatures on a selector mismatch. */
function decodedFnLabel(decoded: DecodedCall | null, selector?: string): string {
  // For a verified-contract selector mismatch, never show a clean-looking
  // signature as if it were a real call — show the raw selector instead; the red
  // TxWarning above carries the "looks like X but no such function" detail.
  if (!decoded) return selector ?? 'call';
  if (decoded.source === 'mismatch') {
    return selector ?? decoded.selector ?? 'unknown function';
  }
  return decoded.signature ?? decoded.functionName ?? selector ?? 'call';
}
/** Renders the trusted decoded-call block: function signature, decoded args, optional note + contract. */
function DecodedCallBlock({ decoded, pending, target, sub, selector }: {
  decoded: DecodedCall | null; pending: boolean; target?: string; sub: string; selector?: string;
}): React.ReactElement {
  const pal = usePalette();
  const detailBg = pal.border;
  const fnLabel = decodedFnLabel(decoded, selector);
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
          {/* name (type): the ABI/4byte param type sits next to the name so the
              user can read the call shape, e.g. "content (string)". */}
          <Text size="xs" color={sub} style={{ minWidth: 80, flexShrink: 0 }} numberOfLines={2}>
            {a.name}{a.type ? ` (${a.type})` : ''}
          </Text>
          <Text variant="mono" size="xs" numberOfLines={4} style={{ flexShrink: 1, flex: 1 }}>{fmtArgValue(a.value)}</Text>
        </Row>
      ))}
      {!pending && decoded?.note && decoded.source !== 'mismatch' ? (
        <Text size="xs" color={sub}>{decoded.note}</Text>
      ) : null}
      {target ? (
        <Text size="xs" color={sub} numberOfLines={1}>Contract: {shortAddress(target)}</Text>
      ) : null}
    </Col>
  );
}
/** TxWarning — anti-spoof banner: the app could not verify the contract, could not decode the call, or the decode disagrees with the sender's description. */
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
  // A receipt carrying an amount/currency is a value transfer ("Payment sent");
  // a bare contract-call receipt (no amount) reads as "Transaction sent" so a
  // contract interaction is never mislabelled as a payment.
  const successLabel = amountLabel ? `Payment sent · ${amountLabel}` : 'Transaction sent';
  const url = explorerTxUrl(receipt.networkId, receipt.reference);
  const blockRadius = useBlockRadius(); const pal = usePalette();
  return (
    <Box radius={blockRadius} background={dark ? 'rgba(120,200,120,0.08)' : 'rgba(60,160,60,0.06)'} padding={12} margin={{ top: 8 }} gap={6} style={{ alignSelf: 'stretch', borderWidth: 1, borderColor: dark ? 'rgba(120,200,120,0.4)' : 'rgba(60,160,60,0.35)' }}>
      <Row align="center" gap={8}>
        <Icon name="check" size={18} color={dark ? '#7fd07f' : '#2f9e44'}/>
        <Text weight="semibold" size="md" color={dark ? '#ffffff' : '#000000'}>
          {successLabel}
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
