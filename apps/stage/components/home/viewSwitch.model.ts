import { conversationLinkOf, isActiveConversationPath, type ConversationLink } from '../../lib/conversationLink';
import { boardPanelConvId } from '../tabs/splitRoutes';

const CHANNEL_PREFIX = '/channel/';

interface ViewSwitchRow {
  convId: string;
  peerAddress: string | null;
}

type HandleOf = (address: string) => string | null | undefined;

export type BoardViewHref = '/board' | { pathname: '/board/[convId]'; params: { convId: string } };

export type ChatsViewHref = '/' | ConversationLink;

function channelRouteConvId(pathname: string): string | null {
  if (!pathname.startsWith(CHANNEL_PREFIX)) return null;
  const convId = pathname.slice(CHANNEL_PREFIX.length);
  return convId === '' || convId.includes('/') ? null : convId;
}

function openChatConvId(pathname: string, rows: readonly ViewSwitchRow[], handleOf: HandleOf): string | null {
  const channel = channelRouteConvId(pathname);
  if (channel !== null) return channel;
  const dm = rows.find(r => r.peerAddress !== null
    && isActiveConversationPath(pathname, r.convId, r.peerAddress, handleOf(r.peerAddress)));
  return dm?.convId ?? null;
}

export function boardViewHref(pathname: string, rows: readonly ViewSwitchRow[], handleOf: HandleOf): BoardViewHref {
  const convId = openChatConvId(pathname, rows, handleOf);
  return convId === null ? '/board' : { pathname: '/board/[convId]', params: { convId } };
}

export function chatsViewHref(pathname: string, rows: readonly ViewSwitchRow[], handleOf: HandleOf): ChatsViewHref {
  const convId = boardPanelConvId(pathname);
  if (convId === null) return '/';
  const peerAddress = rows.find(r => r.convId === convId)?.peerAddress ?? null;
  return conversationLinkOf(convId, peerAddress, peerAddress === null ? null : handleOf(peerAddress));
}
