import { isHash } from 'viem';
import { publicClientFor } from './client';

export async function fetchTxTime(chainId: number, reference: string): Promise<string | null> {
  if (!isHash(reference)) return null;
  const pub = publicClientFor(chainId);
  const tx = await pub.getTransaction({ hash: reference });
  if (tx.blockNumber == null) return null;
  const block = await pub.getBlock({ blockNumber: tx.blockNumber });
  return new Date(Number(block.timestamp) * 1000).toISOString();
}
