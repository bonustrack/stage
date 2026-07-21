import type { FcmSender } from './fcm.ts';
import { removeToken, targetsForAccount, type TokenStore } from './tokens.ts';

export interface RoutingMeta {
  account: string;
  line: string;
  convId: string;
  messageId: string;
  isGroup: boolean;
}

export function buildPushData(meta: RoutingMeta): Record<string, string> {
  const data: Record<string, string> = {
    account: meta.account,
    line: meta.line,
    convId: meta.convId.toLowerCase(),
    messageId: meta.messageId,
  };
  if (meta.isGroup) data.isGroup = 'true';
  return data;
}

export async function fanOutContentless(
  store: TokenStore,
  fcm: FcmSender,
  meta: RoutingMeta,
  excludeInboxId?: string,
): Promise<{ sent: number; pruned: number }> {
  const data = buildPushData(meta);
  const targets = targetsForAccount(store.load(), meta.account, excludeInboxId);
  if (targets.length === 0) return { sent: 0, pruned: 0 };
  let sent = 0;
  let pruned = 0;
  await Promise.all(
    targets.map(async (t) => {
      const result = await fcm.send(t.token, data).catch(() => 'error' as const);
      if (result === 'ok') sent += 1;
      else if (result === 'dead') { removeToken(store, t.token); pruned += 1; }
    }),
  );
  return { sent, pruned };
}
