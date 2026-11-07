import { useRouter } from 'expo-router';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { OUTSIDE_CHANNEL_NOTICE } from '../channel/accessNotices';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import type { DashboardSource } from '@stage-labs/client/xmtp/sync/dashboard';
import type { MenuPoint } from '../AnchoredMenu.model';
import { FrameHeader } from '../frame/FrameHeader';
import { FrameTile } from '../frame/FramePreview';
import { useStoredChat } from '../../lib/storedChat';
import { capabilities } from '../../lib/capabilities';
import { frameLocked } from '../../lib/frames/frame.model';
import { useFrameMessage } from '../../lib/frames/frameMessage';
import { conversationLinkOf } from '../../lib/links';
import { useConvConsentState, useGroupAccess } from '../../lib/messaging/useConvConsent';
import { Unavailable, type WidgetGrip } from './widgetParts';
import { Column } from '../layout';

const CHAT_RECHECK_MS = 15_000;
const FALLBACK_TITLE = 'Frame';
const NOT_SYNCED = 'This frame is not on this device yet';
const NOT_SYNCED_DETAIL = 'It shows here once its chat syncs to this device.';
const DELETED = 'This frame was deleted';

interface WidgetChat {
  title: string;
  isGroup: boolean;
  open?: () => void;
}

const NO_CHAT: WidgetChat = { title: FALLBACK_TITLE, isGroup: false };

function toastSent(): void {
  capabilities.toast('Sent');
}

function useWidgetChat(convId: string): WidgetChat {
  const router = useRouter();
  const chat = useStoredChat(convId, CHAT_RECHECK_MS);
  if (chat === null) return NO_CHAT;
  const { label, peerAddress: peer } = chat;
  return {
    title: label === '' ? FALLBACK_TITLE : label,
    isGroup: peer === null,
    open: () => {
      router.push(conversationLinkOf(convId, peer));
    },
  };
}

function FrameBody({ source, isGroup }: { source: DashboardSource; isGroup: boolean }): React.ReactElement {
  const { conversationId, messageId } = source;
  const message = useFrameMessage(conversationId, messageId);
  const consent = useConvConsentState(conversationId);
  const access = useGroupAccess(conversationId, isGroup);
  if (access === 'outside') return <Unavailable title={OUTSIDE_CHANNEL_NOTICE} />;
  if (message === undefined)
    return (
      <Column weight={1} align="center" justify="center">
        <Spinner />
      </Column>
    );
  if (message.state === 'missing') return <Unavailable title={NOT_SYNCED} detail={NOT_SYNCED_DETAIL} />;
  if (message.state === 'deleted') return <Unavailable title={DELETED} />;
  return (
    <FrameTile
      frame={message.frame}
      line={lineOfConv(conversationId)}
      messageId={messageId}
      disabled={frameLocked(message.frame, consent === 'allowed')}
      fill
      onSent={toastSent}
    />
  );
}

export function FrameWidget({
  source,
  onMenu,
  grip,
}: {
  source: DashboardSource;
  onMenu: (anchor: MenuPoint) => void;
  grip: WidgetGrip;
}): React.ReactElement {
  const chat = useWidgetChat(source.conversationId);
  return (
    <Column weight={1} gap={6}>
      {grip(<FrameHeader title={chat.title} onOpen={chat.open} onMenu={onMenu} />)}
      <FrameBody source={source} isGroup={chat.isGroup} />
    </Column>
  );
}
