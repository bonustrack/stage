import { capabilities } from '../../lib/capabilities';
import { markOwnDelete, unmarkOwnDelete } from '../../lib/ownDeletes';
import { report } from '../../lib/errorPolicy';
import { xmtpDeleteMessage } from '../../modules/messaging';
import { deleteConfirmOf } from './messageDeletion.model';

export async function confirmDeleteMessage(messageId: string, asAdmin: boolean): Promise<void> {
  if (!await capabilities.confirm(deleteConfirmOf(asAdmin))) return;
  await markOwnDelete(messageId);
  try {
    await xmtpDeleteMessage(messageId);
  } catch (err) {
    report('message.delete', err);
    await unmarkOwnDelete(messageId);
    capabilities.toast('Couldn’t delete the message');
  }
}
