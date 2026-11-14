import { LEGAL_CONTACT } from '../legal/legal.model';

export const DANGER_FOOTNOTE =
  "Reset clears the messages stored on this device. Remove from this device keeps the account on your other devices and on Stage's servers. Delete account also deletes your username and st.box mail on Stage's servers.";

export function removeMessage(name: string): string {
  return `Remove ${name} from this device? Without a backup of the recovery phrase or private key this account is unrecoverable. Its local XMTP database is deleted from this device.`;
}

export function deleteMessage(name: string): string {
  return `Delete ${name}? Stage deletes your username and st.box mail from its servers, stops notifications and removes the account, its keys and its messages from this device. Nobody can take your username after you. Devices where you are still signed in keep the account until you remove it there. This can not be undone.`;
}

export const DELETING_TOAST = 'Deleting your account…';

export function deleteFailedMessage(reason: string): string {
  return `${reason} Nothing was removed from this device. Try again, or email ${LEGAL_CONTACT}.`;
}
