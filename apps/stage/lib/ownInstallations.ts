import { missingInstallationIds } from '@stage-labs/client/xmtp/groups';
import { appStorage } from '../platform/storage';
import { sdk } from './xmtp.sdk';
import { VISIBLE_CONSENT } from './xmtp.sdk.core';
import { ignored, recover, reported } from './errorPolicy';
import { loadHiddenChannels } from './hiddenChannels';

const DONE_PREFIX = 'ownInstallations.done.';
const SPACING_MS = 1500;

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

export async function addOwnInstallationsToChats(accountId: string): Promise<void> {
  const installationsIn = sdk.memberInstallationIds;
  if (installationsIn === null) return;
  const client = await sdk.client();
  const inboxId = client.inboxId ?? '';
  if (inboxId === '') return;
  const devices = (await sdk.installationIdsOf(client, inboxId)).map(id => id.toLowerCase()).sort().join(',');
  const doneKey = `${DONE_PREFIX}${accountId}`;
  if ((await appStorage.get(doneKey).catch(recover('ownInstallations.done', null))) === devices) return;
  const hidden = await loadHiddenChannels(accountId);
  const convs = (await sdk.listConvs(client, VISIBLE_CONSENT)).filter(conv => !hidden[conv.id]?.hidden);
  for (const conv of convs) {
    const present = await installationsIn(conv, inboxId).catch(recover<string[] | null>('ownInstallations.members', null));
    if (present === null || missingInstallationIds(devices.split(','), present).length === 0) continue;
    if (!(await sdk.isActive(conv).catch(recover('ownInstallations.active', false)))) continue;
    await conv.sync().catch(reported('ownInstallations.sync'));
    await pause(SPACING_MS);
  }
  await appStorage.set(doneKey, devices).catch(ignored(undefined, 'cache'));
}
