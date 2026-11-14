import { Alert } from 'react-native';
import { errorMessage } from '@stage-labs/client/errors';
import { shortAddress } from '@stage-labs/client/identity/format';
import { switchToAccount, deleteAccount, getOrCreateXmtpClient } from '../../lib/xmtp.client';
import { getActiveAccount, type AccountRecord } from '../../lib/accounts';
import { deleteAccountServerData } from '../../lib/profile';
import { isPushSupported, unregisterPushFromServer } from '../../lib/pushRegister';
import { reloadApp } from '../../lib/reloadApp';
import { capabilities } from '../../lib/capabilities';
import { report } from '../../lib/errorPolicy';
import { DELETING_TOAST, deleteFailedMessage, deleteMessage, removeMessage } from './accountRemoval.model';

async function removeAndMoveOn(id: string): Promise<void> {
  try {
    await deleteAccount(id);
    const next = (await getActiveAccount())?.id;
    if (next === undefined) {
      reloadApp(true);
      return;
    }
    await switchToAccount(next);
    capabilities.navigate('/');
  } catch (err) {
    report('settings.removeAccount', err);
    Alert.alert('Could not remove account', errorMessage(err));
  }
}

function nameOf(rec: AccountRecord): string {
  return rec.label ?? shortAddress(rec.address);
}

export function confirmRemove(rec: AccountRecord): void {
  void capabilities
    .confirm({ title: 'Remove from this device', message: removeMessage(nameOf(rec)), confirmLabel: 'Remove', destructive: true })
    .then((ok) => {
      if (ok) void removeAndMoveOn(rec.id);
    });
}

let deleting: Promise<void> | null = null;

async function deleteEverywhere(rec: AccountRecord): Promise<void> {
  capabilities.toast(DELETING_TOAST);
  try {
    if (isPushSupported()) await unregisterPushFromServer(await getOrCreateXmtpClient('production'));
    await deleteAccountServerData();
  } catch (err) {
    report('settings.deleteAccount', err);
    Alert.alert('Could not delete account', deleteFailedMessage(errorMessage(err)));
    return;
  }
  await removeAndMoveOn(rec.id);
}

export function confirmDelete(rec: AccountRecord): void {
  if (deleting !== null) return;
  void capabilities
    .confirm({ title: 'Delete account', message: deleteMessage(nameOf(rec)), confirmLabel: 'Delete', destructive: true })
    .then((ok) => {
      if (!ok || deleting !== null) return;
      deleting = deleteEverywhere(rec).finally(() => {
        deleting = null;
      });
    });
}
