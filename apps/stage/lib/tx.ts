import { createPublicClient, createWalletClient, type Hex, type TypedDataDefinition } from 'viem';
import type { Eip712TypedData } from '@stage-labs/client/xmtp/sign';
import { VIEM_CHAINS, WALLET_CHAIN_ID, WALLET_CHAIN_ONLY } from '@stage-labs/client/wallet/chains';
import { broviderTransport } from '@stage-labs/client/wallet/client';
import { getViemAccount, type AccountRecord } from './accounts';
import { kernelClientForRecord } from './zerodev/client';

export interface TxCall {
  to: Hex;
  value?: bigint;
  data?: Hex;
}

export interface SentTx {
  hash: Hex;
  chainId: number;
}

export interface AccountActionOptions {
  missingKey: string;
  before?: () => void;
}

export interface SendCallsOptions extends AccountActionOptions {
  chainId?: number;
  confirm?: (hash: Hex) => Promise<Hex>;
}

export type SignRequest = { message: string } | { typedData: Eip712TypedData };

export interface Signature {
  signature: Hex;
  address: string;
}

function viemTypedData(typedData: Eip712TypedData): TypedDataDefinition {
  return typedData as unknown as TypedDataDefinition;
}

async function sendFromSmart(record: AccountRecord, calls: readonly TxCall[], opts: SendCallsOptions): Promise<SentTx> {
  if ((opts.chainId ?? WALLET_CHAIN_ID) !== WALLET_CHAIN_ID) throw new Error(WALLET_CHAIN_ONLY);
  const kernel = await kernelClientForRecord(record);
  opts.before?.();
  const sent = await kernel.sendTransaction({
    calls: calls.map((call) => ({ to: call.to, value: call.value ?? 0n, data: call.data ?? '0x' })),
  });
  return { hash: opts.confirm ? await opts.confirm(sent) : sent, chainId: WALLET_CHAIN_ID };
}

async function sendFromKey(record: AccountRecord | null, calls: readonly TxCall[], opts: SendCallsOptions): Promise<SentTx> {
  const chainId = opts.chainId ?? WALLET_CHAIN_ID;
  const local = record === null ? null : await getViemAccount(record.id);
  if (!local) throw new Error(opts.missingKey);
  const chain = VIEM_CHAINS[chainId];
  if (!chain) throw new Error(`Unsupported chain ${chainId}`);
  const wallet = createWalletClient({ account: local, chain, transport: broviderTransport(chainId) });
  let hash: Hex = '0x';
  for (const call of calls) {
    opts.before?.();
    const sent = await wallet.sendTransaction({
      chain,
      to: call.to,
      ...(call.value === undefined ? {} : { value: call.value }),
      ...(call.data === undefined ? {} : { data: call.data }),
    });
    hash = opts.confirm ? await opts.confirm(sent) : sent;
  }
  return { hash, chainId };
}

export function sendCallsFrom(record: AccountRecord | null, calls: readonly TxCall[], opts: SendCallsOptions): Promise<SentTx> {
  return record?.type === 'smart' ? sendFromSmart(record, calls, opts) : sendFromKey(record, calls, opts);
}

export async function waitForReceipt(chainId: number, hash: Hex): Promise<void> {
  await createPublicClient({ transport: broviderTransport(chainId) }).waitForTransactionReceipt({ hash });
}

export async function signFrom(record: AccountRecord | null, request: SignRequest, opts: AccountActionOptions): Promise<Signature> {
  if (record?.type === 'smart') {
    const kernel = await kernelClientForRecord(record);
    opts.before?.();
    const signature =
      'message' in request
        ? await kernel.signMessage({ message: request.message })
        : await kernel.signTypedData(viemTypedData(request.typedData));
    return { signature, address: record.address };
  }
  const local = record === null ? null : await getViemAccount(record.id);
  if (!local) throw new Error(opts.missingKey);
  opts.before?.();
  const signature =
    'message' in request
      ? await local.signMessage({ message: request.message })
      : await local.signTypedData(viemTypedData(request.typedData));
  return { signature, address: local.address };
}
