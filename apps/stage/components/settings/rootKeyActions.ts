import type { AccountRecord } from '../../lib/accounts';
import { capabilities } from '../../lib/capabilities';
import { makePhraseRootKey } from '../../lib/zerodev/rootKey';
import { enableDevicePasskey } from '../../lib/zerodev/devicePasskeyFlow';
import { KEEP_PASSKEY_CONFIRM, ROOT_KEY_DONE } from './RootKeyRow.model';
import { DEVICE_PASSKEY_DONE } from './DevicePasskeyRow.model';

export async function migrateRootKey(rec: AccountRecord): Promise<boolean> {
  const result = await makePhraseRootKey(rec);
  if (!result.ok) {
    capabilities.toast(result.message);
    return false;
  }
  capabilities.toast(ROOT_KEY_DONE);
  if (result.reusablePasskey !== null && (await capabilities.confirm(KEEP_PASSKEY_CONFIRM))) {
    const kept = await enableDevicePasskey(rec, result.reusablePasskey);
    capabilities.toast(kept.ok ? DEVICE_PASSKEY_DONE : kept.message);
  }
  return true;
}
