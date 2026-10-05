import { sdk } from './xmtp.sdk';
import type { AccountClient } from './xmtp.account';
import type { JsonCodec } from '@stage-labs/client/xmtp/jsonCodecs';

export interface SyncTarget {
  context: AccountClient;
  conv: NonNullable<Awaited<ReturnType<typeof sdk.findConv>>>;
}

export async function syncTarget(context: AccountClient, convId: string): Promise<SyncTarget> {
  const conv = await sdk.findConv(context.client, convId);
  context.assertCurrent();
  if (!conv) throw new Error('Sync conversation not found');
  return { context, conv };
}

export function sendSyncState<T>({ context, conv }: SyncTarget, codec: JsonCodec<T>, content: T): Promise<string> {
  context.assertCurrent();
  return sdk.send.json(conv, codec, content);
}
