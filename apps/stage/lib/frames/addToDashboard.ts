import { newNodeKey } from '@stage-labs/client/nodes/protocol';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import { capabilities } from '../capabilities';
import { useDeveloperMode } from '../developerMode';
import { report } from '../errorPolicy';
import { addFrameToDashboard, addLiveToDashboard } from './dashboard';
import { FRAME_ADD_TOASTS, liveConfirmOf, type FrameWidgetAdd } from './dashboard.model';
import { frameNodeOf } from './frame.model';
import type { LivePreview } from './live.model';
import { seedLiveWidget } from './liveWidget';

type AddOutcome = FrameWidgetAdd | 'cancelled';

function wasTried(outcome: AddOutcome): outcome is FrameWidgetAdd {
  return outcome !== 'cancelled';
}

async function announceAdd<T extends AddOutcome>(scope: string, add: () => Promise<T>): Promise<T | null> {
  try {
    const outcome = await add();
    if (wasTried(outcome)) capabilities.toast(FRAME_ADD_TOASTS[outcome]);
    return outcome;
  } catch (err) {
    report(scope, err);
    capabilities.toast('Could not add it to your dashboard');
    return null;
  }
}

async function addedFromChat(convId: string, messageId: string, frame: FrameContent): Promise<AddOutcome> {
  const origin = { conversationId: convId, messageId };
  const node = frameNodeOf(frame);
  if (node === null) return addFrameToDashboard(origin, 'half');
  if (!(await capabilities.confirm(liveConfirmOf(node.host)))) return 'cancelled';
  return (await addLiveToDashboard({ url: node.url, key: newNodeKey(), origin }, 'half')).outcome;
}

async function addChatFrameToDashboard(convId: string, messageId: string, frame: FrameContent): Promise<void> {
  await announceAdd('dashboard.addFrame', () => addedFromChat(convId, messageId, frame));
}

export type AddChatFrame = typeof addChatFrameToDashboard;

export function useAddChatFrameToDashboard(): AddChatFrame | undefined {
  return useDeveloperMode() ? addChatFrameToDashboard : undefined;
}

export function addLivePreview(preview: LivePreview, key: string): Promise<FrameWidgetAdd | null> {
  return announceAdd('dashboard.addLive', async () => {
    const { outcome, id } = await addLiveToDashboard({ url: preview.url, key }, 'half');
    if (outcome === 'added') seedLiveWidget(id, preview.url, preview.state);
    return outcome;
  });
}
