import { missingInstallationIds } from '@stage-labs/client/xmtp/groups';
import { appStorage } from '../platform/storage';
import { sdk } from './xmtp.sdk';
import { VISIBLE_CONSENT } from './xmtp.sdk.core';
import { ignored } from './errorPolicy';
import { loadHiddenChannels } from './hiddenChannels';
import { accountClient, type AccountClient } from './xmtp.account';
import { channelAccess } from './channelVisibility';

type Conv = NonNullable<Awaited<ReturnType<typeof sdk.findConv>>>;
const DONE_PREFIX = 'ownInstallations.done.';
const SPACING_MS = 1500;

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

async function repairConversation(context: AccountClient, conv: Conv, devices: string[]): Promise<void> {
  const installationsIn = sdk.memberInstallationIds;
  if (!installationsIn) return;
  const present = await installationsIn(conv, context.client.inboxId ?? '');
  if (missingInstallationIds(devices, present).length === 0) return;
  if (await channelAccess(context, conv) !== 'member') return;
  const hidden = await loadHiddenChannels(context.account.id);
  context.assertCurrent();
  if (hidden[conv.id]?.hidden) return;
  await conv.sync();
  await pause(SPACING_MS);
}

export async function addOwnInstallationsToChats(accountId: string): Promise<void> {
  if (sdk.memberInstallationIds === null) return;
  const context = await accountClient(accountId);
  const inboxId = context.client.inboxId ?? '';
  if (inboxId === '') return;
  const devices = (await sdk.installationIdsOf(context.client, inboxId)).map(id => id.toLowerCase()).sort();
  const hidden = await loadHiddenChannels(accountId);
  const signature = JSON.stringify([devices, hidden]);
  const doneKey = `${DONE_PREFIX}${accountId}`;
  if ((await appStorage.get(doneKey)) === signature) return;
  for (const conv of await sdk.listConvs(context.client, VISIBLE_CONSENT)) {
    context.assertCurrent();
    await repairConversation(context, conv, devices);
  }
  context.assertCurrent();
  if (JSON.stringify(await loadHiddenChannels(accountId)) !== JSON.stringify(hidden)) return;
  await appStorage.set(doneKey, signature).catch(ignored(undefined, 'cache'));
}
