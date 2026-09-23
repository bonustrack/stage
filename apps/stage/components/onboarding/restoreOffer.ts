import { Alert } from 'react-native';
import type { Hex } from 'viem';
import { getActiveAccount, type AccountRecord } from '../../lib/accounts';
import { capabilities } from '../../lib/capabilities';
import { recover } from '../../lib/errorPolicy';
import { kernelCustody, passkeysAvailable } from '../../lib/zerodev';
import { rootKeyMigrationFor } from '../../lib/zerodev/rootKey';
import { enableDevicePasskey } from '../../lib/zerodev/devicePasskeyFlow';
import { migrateRootKey } from '../settings/rootKeyActions';
import { DEVICE_PASSKEY_DONE } from '../settings/DevicePasskeyRow.model';
import { RESTORE_OFFER_COPY, restoreOffer, type RestoreOffer } from './restoreOffer.model';

async function offerFor(rec: AccountRecord): Promise<RestoreOffer | null> {
  const custody = await kernelCustody(rec.address as Hex).catch(recover('onboarding.offer', null));
  const migration = custody === 'passkey-root' ? await rootKeyMigrationFor(rec).catch(recover('onboarding.offer', null)) : null;
  return restoreOffer({ custody, migration, passkeysAvailable: passkeysAvailable(), devicePasskeyStored: rec.devicePasskey !== undefined });
}

async function addPasskey(rec: AccountRecord): Promise<void> {
  const result = await enableDevicePasskey(rec);
  capabilities.toast(result.ok ? DEVICE_PASSKEY_DONE : result.message);
}

export async function offerAfterRestore(): Promise<void> {
  const rec = await getActiveAccount();
  if (rec?.type !== 'smart') return;
  const offer = await offerFor(rec);
  if (offer === null) return;
  const copy = RESTORE_OFFER_COPY[offer];
  if (offer === 'make-root-elsewhere') { Alert.alert(copy.title, copy.message); return; }
  if (!(await capabilities.confirm(copy))) return;
  if (offer === 'add-passkey') { await addPasskey(rec); return; }
  const migrated = await migrateRootKey(rec);
  if (migrated && passkeysAvailable() && (await capabilities.confirm(RESTORE_OFFER_COPY['add-passkey']))) await addPasskey(rec);
}
