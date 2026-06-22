import { Linking } from 'react-native';
import { useRouter } from 'expo-router';

import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Avatar } from './Avatar';
import { Text } from '@stage-labs/kit/react-native/text';
import { Icon } from '@stage-labs/kit/react-native/icon';
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
export { SigRequestCard, SigReferenceCard } from './MessengerBubble.cards.sig';
export function TxRequestCard({ req, dark, sub, paying, onPay, consentAllowed }: {
  req: TxRequest; dark: boolean; sub: string; paying?: boolean;
  onPay?: () => void;
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
interface TxCallFields {
  target?: string; data?: string; value?: string; eth?: string;
  amount?: number; currency?: string; desc: string; rawDesc?: string;
  amountValue?: string; amountUnit?: string;
  recipient?: string; tokenAddr?: string; chainNum: number;
  isErc20Transfer: boolean; showDecodedBlock: boolean; showBalance: boolean;
}

function amountDisplay(amount: string | number | undefined, currency: string | undefined, eth: string | undefined): {
  amountValue?: string; amountUnit?: string;
} {
  if (amount != null) return { amountValue: String(amount), amountUnit: currency ?? 'ETH' };
  return { amountValue: eth, amountUnit: eth ? 'ETH' : undefined };
}

function txCallFlags(args: { data?: string; tokenAddr?: string; currency?: string; eth?: string }): {
  isErc20Transfer: boolean; showDecodedBlock: boolean; showBalance: boolean;
} {
  const isErc20Transfer = !!args.tokenAddr;
  const hasCalldata = !!args.data && args.data !== '0x';
  return {
    isErc20Transfer,
    showDecodedBlock: hasCalldata && !isErc20Transfer,
    showBalance: !!args.currency || !!args.eth || !!args.tokenAddr,
  };
}

function rawCall(req: TxRequest): {
  target?: string; data?: string; value?: string;
  meta: NonNullable<TxRequest['calls'][number]['metadata']>;
} {
  const call = req.calls[0];
  return { target: call?.to, data: call?.data, value: call?.value, meta: call?.metadata ?? {} };
}

function txCallFields(req: TxRequest): TxCallFields {
  const { target, data, value, meta } = rawCall(req);
  const { amount, currency, toAddress, description } = meta;
  const eth = ethFromWeiHex(value);
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
    sendsNativeWithCall: f.showDecodedBlock && !!f.eth && f.eth !== '0',
    actionLabel: txActionLabel(decoded, f.isErc20Transfer),
    isTransfer: isTransferRequest(decoded, f.isErc20Transfer),
    warning: spoofWarning(decoded, f.rawDesc),
    showBalance: f.showBalance,
  };
}
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
function fmtArgValue(v: string): string {
  if (/^0x[0-9a-fA-F]{40}$/.test(v)) return shortAddress(v);
  return v;
}
function decodedFnLabel(decoded: DecodedCall | null, selector?: string): string {
  if (!decoded) return selector ?? 'call';
  if (decoded.source === 'mismatch') {
    return selector ?? decoded.selector ?? 'unknown function';
  }
  return decoded.signature ?? decoded.functionName ?? selector ?? 'call';
}
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
          {}
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
export function TxReceiptCard({ receipt, dark }: {
  receipt: TxReceipt; dark: boolean;
}): React.ReactElement {
  const amountLabel = receipt.metadata?.amount != null
    ? `${receipt.metadata.amount} ${receipt.metadata.currency ?? 'ETH'}`
    : undefined;
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
