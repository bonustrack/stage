import { capabilities } from '../../lib/capabilities';
import { markOwnDelete, unmarkOwnDelete } from '../../lib/ownDeletes';
import { report } from '../../lib/errorPolicy';
import { xmtpDeleteMessage } from '../../modules/messaging';
import { DELETE_MESSAGE_CONFIRM } from './messageDeletion.model';

export async function confirmDeleteMessage(messageId: string): Promise<void> {
  if (!await capabilities.confirm(DELETE_MESSAGE_CONFIRM)) return;
  await markOwnDelete(messageId);
  try {
    await xmtpDeleteMessage(messageId);
  } catch (err) {
    report('message.delete', err);
    await unmarkOwnDelete(messageId);
    capabilities.toast('Couldn’t delete the message');
  }
}
