import { isHash, TransactionNotFoundError } from 'viem';
import { publicClientFor } from './client';

function unlessUnknown(err: unknown): null {
  if (err instanceof TransactionNotFoundError) return null;
  throw err;
}

export async function fetchTxTime(chainId: number, reference: string): Promise<string | null> {
  if (!isHash(reference)) return null;
  const pub = publicClientFor(chainId);
  const tx = await pub.getTransaction({ hash: reference }).catch(unlessUnknown);
  if (tx?.blockNumber == null) return null;
  const block = await pub.getBlock({ blockNumber: tx.blockNumber });
  return new Date(Number(block.timestamp) * 1000).toISOString();
}
