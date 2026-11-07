import { setPushEnabled } from './pushPref';
import { isPushSupported, requestPushPermission } from './pushNotify';
import { registerPushWithServer, unregisterPushFromServer } from './pushRegister';
import { xmtpClient } from './xmtp.client';
import { capabilities } from './capabilities';
import { report } from './errorPolicy';

export async function applyPush(next: boolean): Promise<void> {
  if (!isPushSupported()) return;
  await setPushEnabled(next);
  if (next) await requestPushPermission();
  try {
    const client = await xmtpClient();
    if (next) await registerPushWithServer(client);
    else await unregisterPushFromServer(client);
  } catch (err) {
    report('settings.push', err);
    capabilities.toast('Could not update notifications. Try again.');
  }
}
