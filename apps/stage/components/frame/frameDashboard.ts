import { newNodeKey } from '@stage-labs/client/nodes/protocol';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import { capabilities } from '../../lib/capabilities';
import { addFrameToDashboard, addLiveToDashboard } from '../../lib/dashboard';
import { report } from '../../lib/errorPolicy';
import { FRAME_ADD_TOASTS, type FrameWidgetAdd } from '../dashboard/dashboard.model';
import { liveConfirmOf } from '../dashboard/liveWidget.model';
import { frameIsFullWidth, frameNodeOf } from './frame.model';

async function addedFromChat(convId: string, messageId: string, frame: FrameContent): Promise<FrameWidgetAdd | null> {
  const width = frameIsFullWidth(frame) ? 'full' : 'half';
  const origin = { conversationId: convId, messageId };
  const node = frameNodeOf(frame);
  if (node === null) return addFrameToDashboard(origin, width);
  if (!await capabilities.confirm(liveConfirmOf(node.host))) return null;
  return (await addLiveToDashboard({ url: node.url, key: newNodeKey(), origin }, width)).outcome;
}

export async function addChatFrameToDashboard(convId: string, messageId: string, frame: FrameContent): Promise<void> {
  try {
    const outcome = await addedFromChat(convId, messageId, frame);
    if (outcome !== null) capabilities.toast(FRAME_ADD_TOASTS[outcome]);
  } catch (err) {
    report('dashboard.addFrame', err);
    capabilities.toast('Could not add it to your dashboard');
  }
}
