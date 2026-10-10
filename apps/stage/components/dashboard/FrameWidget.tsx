import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { shortAddress } from '@stage-labs/client/identity/format';
import { OUTSIDE_CHANNEL_NOTICE } from '@stage-labs/client/xmtp/clientErrors';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import type { DashboardSource } from '@stage-labs/client/xmtp/readState';
import type { MenuPoint } from '../AnchoredMenu.model';
import { FrameTile } from '../frame/FramePreview';
import { Box, Col } from '../layout';
import { chatLabelOf } from '../storage/StorageScreen.model';
import { useAccountEpoch } from '../../lib/accountEpoch';
import { capabilities } from '../../lib/capabilities';
import { useFrameMessage } from '../../lib/frameMessage';
import { conversationLinkOf } from '../../lib/links';
import { getPeerName, usePeerProfiles } from '../../lib/peerProfiles';
import { storageChatOf } from '../../lib/storage';
import { useConvConsentState, useGroupAccess } from '../../modules/messaging/useConvConsent';
import { Unavailable, WidgetHeader, type WidgetGrip } from './widgetParts';

const CHAT_STALE_MS = 5 * 60_000;
const CHAT_RECHECK_MS = 15_000;
const FALLBACK_TITLE = 'Frame';
const NOT_SYNCED = 'This frame is not on this device yet';
const NOT_SYNCED_DETAIL = 'It shows here once its chat syncs to this device.';
const DELETED = 'This frame was deleted';

interface WidgetChat { title: string; isGroup: boolean; open?: () => void }

const NO_CHAT: WidgetChat = { title: FALLBACK_TITLE, isGroup: false };

function toastSent(): void {
  capabilities.toast('Sent');
}

function useWidgetChat(convId: string): WidgetChat {
  const router = useRouter();
  const epoch = useAccountEpoch();
  const { data } = useQuery({
    queryKey: ['storageChat', epoch, convId], queryFn: () => storageChatOf(convId), staleTime: CHAT_STALE_MS, retry: false,
    refetchInterval: query => (query.state.data ? false : CHAT_RECHECK_MS),
  });
  const peer = data?.peerAddress ?? null;
  usePeerProfiles([peer]);
  if (data === null || data === undefined) return NO_CHAT;
  const label = chatLabelOf(data, peer === null ? undefined : getPeerName(peer), shortAddress);
  return {
    title: label === '' ? FALLBACK_TITLE : label,
    isGroup: peer === null,
    open: () => { router.push(conversationLinkOf(convId, peer)); },
  };
}

function FrameBody({ source, isGroup }: { source: DashboardSource; isGroup: boolean }): React.ReactElement {
  const { conversationId, messageId } = source;
  const message = useFrameMessage(conversationId, messageId);
  const consent = useConvConsentState(conversationId);
  const access = useGroupAccess(conversationId, isGroup);
  if (access === 'outside') return <Unavailable title={OUTSIDE_CHANNEL_NOTICE} />;
  if (message === undefined) return <Box flex={1} align="center" justify="center"><Spinner /></Box>;
  if (message.state === 'missing') return <Unavailable title={NOT_SYNCED} detail={NOT_SYNCED_DETAIL} />;
  if (message.state === 'deleted') return <Unavailable title={DELETED} />;
  return (
    <FrameTile
      frame={message.frame} line={lineOfConv(conversationId)} messageId={messageId} disabled={consent !== 'allowed'} fill onSent={toastSent}
    />
  );
}

export function FrameWidget({ source, onMenu, grip }: {
  source: DashboardSource; onMenu: (anchor: MenuPoint) => void; grip: WidgetGrip;
}): React.ReactElement {
  const chat = useWidgetChat(source.conversationId);
  return (
    <Col flex={1} gap={6}>
      {grip(<WidgetHeader title={chat.title} onOpen={chat.open} onMenu={onMenu} />)}
      <FrameBody source={source} isGroup={chat.isGroup} />
    </Col>
  );
}
