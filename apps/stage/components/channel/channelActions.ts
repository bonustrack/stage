import { errorMessage } from '@stage-labs/client/errors';
import { LabelPermissionError } from '@stage-labs/client/xmtp/labels';
import { CHANNEL_FIELD_NOUNS, type ChannelField } from '@stage-labs/client/xmtp/channelMeta';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { capabilities } from '../../lib/capabilities';
import { reported } from '../../lib/errorPolicy';
import { leaveGroupConv, setGroupCategory, setGroupField } from '../../lib/xmtp.groups';
import { blockRequestConv, checkConvSync, unacceptConv } from '../../lib/xmtp.conv';
import { markConvRead } from '../../lib/channelsCache';
import { markChatCleared } from '../../lib/sync/clearedChats';
import { LEAVE_CHANNEL_CONFIRM } from '../chatRow/ChannelMenu.model';
import { homeRoute } from '../tabs/boardHome';

export type ChannelActionFrom = 'list' | 'chat';

interface ChannelRouter {
  replace: (href: string) => void;
}

export function toastLabelError(e: unknown, what = 'labels'): void {
  if (e instanceof LabelPermissionError) capabilities.toast(e.message);
  else capabilities.toast(`Could not update ${what}. Try again.`);
}

export function setChannelCategory(convId: string, category: string | null): void {
  void setGroupCategory(lineOfConv(convId), category).catch((e: unknown) => {
    toastLabelError(e, `the ${CHANNEL_FIELD_NOUNS.category}`);
  });
}

export function setChannelField(convId: string, field: ChannelField, value: string | null): void {
  void setGroupField(lineOfConv(convId), field, value).catch((e: unknown) => {
    toastLabelError(e, `the ${CHANNEL_FIELD_NOUNS[field]}`);
  });
}

export async function leaveChannel(
  convId: string,
  from: ChannelActionFrom,
  router: ChannelRouter,
  busy: (on: boolean) => void = () => undefined,
): Promise<void> {
  if (!(await capabilities.confirm(LEAVE_CHANNEL_CONFIRM))) return;
  busy(true);
  try {
    const result = await leaveGroupConv(lineOfConv(convId));
    if (from === 'chat') {
      capabilities.toast(result === 'left' ? 'Left channel' : 'Channel hidden');
      router.replace(homeRoute());
    }
  } catch (e) {
    capabilities.alert('Couldn’t leave', errorMessage(e));
  } finally {
    busy(false);
  }
}

const DELETE_CHAT_MESSAGE =
  'The chat is removed from all your devices. If they write again, it comes back with only the new messages. Delete and block also stops their messages for good.';

export function deleteChat(convId: string, peerAddress: string, from: ChannelActionFrom, router: ChannelRouter): void {
  const remove = (block: boolean): void => {
    void (async (): Promise<void> => {
      try {
        await markChatCleared(peerAddress, Date.now());
        void markConvRead(convId).catch(reported('chat.markRead'));
        if (from === 'chat') router.replace(homeRoute());
        await (block ? blockRequestConv(convId) : unacceptConv(convId));
      } catch (e) {
        capabilities.alert('Couldn’t delete', errorMessage(e));
      }
    })();
  };
  capabilities.alert('Delete chat', DELETE_CHAT_MESSAGE, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Delete',
      style: 'destructive',
      onPress: () => {
        remove(false);
      },
    },
    {
      text: 'Delete and block',
      style: 'destructive',
      onPress: () => {
        remove(true);
      },
    },
  ]);
}

export async function checkChannelSync(convId: string): Promise<void> {
  capabilities.toast('Checking sync…');
  try {
    const { title, message } = await checkConvSync(convId);
    capabilities.alert(title, message);
  } catch (e) {
    capabilities.alert('Couldn’t check sync', errorMessage(e));
  }
}
