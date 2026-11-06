import { INACTIVE_SEND_MESSAGE } from '@stage-labs/client/xmtp/clientErrors';
import { convIdOfLine } from '@stage-labs/client/xmtp/line';
import { groupTopicOf } from '@stage-labs/client/xmtp/pushServer';
import { prepareNotifyingSend } from '@stage-labs/client/xmtp/pushSenderFilter';
import { timeSendPhase, type SendTiming } from '@stage-labs/client/xmtp/sendTiming';
import { sdk } from './xmtp.sdk';
import type { SendTarget } from './xmtp.messageSend.core';
import { registerDmRoute } from './dmRoutes';
import { recover } from './errorPolicy';
import { getAccountEpoch } from './accountEpoch';
import { AccountChangedError } from './accountSelection';
import { prepareSenderFilters } from './pushRegister';

type Client = Awaited<ReturnType<typeof sdk.client>>;
type Conv = Awaited<ReturnType<typeof sdk.openDm>>;

export async function convOfLine(line: string): Promise<Conv | null> {
  const convId = convIdOfLine(line);
  if (!convId) return null;
  return (await sdk.findConv(await sdk.client(), convId).catch(recover('xmtp.findConv', null))) ?? null;
}

async function activeForSend(client: Client, conv: Conv, line: string): Promise<Conv> {
  if (await sdk.isActive(conv).catch(recover('xmtp.isActive', true))) return conv;
  const peerInboxId = sdk.dmPeerInboxId(conv);
  if (!peerInboxId) throw new Error(INACTIVE_SEND_MESSAGE);
  const active = await sdk.activeDm(client, await peerInboxId());
  registerDmRoute(active.id, convIdOfLine(line) ?? conv.id);
  return active;
}

export async function sendableConvOfLine(line: string, shouldPush = true, timing?: SendTiming): Promise<SendTarget<Conv>> {
  const epoch = getAccountEpoch();
  const client = await timeSendPhase(timing, 'client.ready', () => sdk.client());
  const assertCurrent = (): void => {
    if (getAccountEpoch() !== epoch || sdk.cachedClient() !== client) throw new AccountChangedError();
  };
  const conv = await timeSendPhase(timing, 'conversation.find', () => convOfLine(line));
  assertCurrent();
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  const active = await timeSendPhase(timing, 'conversation.active', () => activeForSend(client, conv, line));
  assertCurrent();
  await timeSendPhase(timing, 'filter.prepare', () =>
    prepareNotifyingSend(shouldPush, () => prepareSenderFilters(client, groupTopicOf(active.id), timing), assertCurrent),
  );
  return { conv: active, assertCurrent };
}
