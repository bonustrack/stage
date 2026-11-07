import { getPeerHandle } from './peerProfiles';
import { conversationPathFor, conversationSlugFor, profileSlugFor } from '@stage-labs/client/routing/handles';
import { channelPath } from '@stage-labs/client/routing/routes';
import { shareUrlFor } from '@stage-labs/client/routing/stageLinks';

interface ChannelLink {
  pathname: '/channel/[convId]';
  params: { convId: string };
}

interface DmLink {
  pathname: '/[convId]';
  params: { convId: string };
}

export type ConversationLink = DmLink | ChannelLink;

export interface FrameLink {
  pathname: '/frame';
  params: { convId: string; id: string };
}

export const WALLET_LINKS = { send: '/wallet/send', receive: '/wallet/receive' } as const;

export type WalletLink = (typeof WALLET_LINKS)[keyof typeof WALLET_LINKS];

interface WalletSendLink {
  pathname: typeof WALLET_LINKS.send;
  params: { to: string };
}

export interface ProfileLink {
  pathname: '/profile/[id]';
  params: { id: string };
}

type ProfileKind = 'channel' | 'user';

const CHANNEL_ID_RE = /^[0-9a-f]{32}$/i;

export function profileKindOf(id: string | null | undefined): ProfileKind {
  return CHANNEL_ID_RE.test((id ?? '').trim()) ? 'channel' : 'user';
}

export function channelLinkOf(convId: string): ChannelLink {
  return { pathname: '/channel/[convId]', params: { convId } };
}

export function conversationSlugLinkOf(slug: string): DmLink {
  return { pathname: '/[convId]', params: { convId: slug } };
}

export function dmLinkOf(peerAddress: string, handle: string | null | undefined = getPeerHandle(peerAddress)): DmLink {
  return conversationSlugLinkOf(conversationSlugFor(peerAddress, handle));
}

export function conversationLinkOf(
  convId: string,
  peerAddress?: string | null,
  handle: string | null | undefined = getPeerHandle(peerAddress),
): ConversationLink {
  return peerAddress ? dmLinkOf(peerAddress, handle) : channelLinkOf(convId);
}

export function profileLinkOf(address: string, handle: string | null | undefined = getPeerHandle(address)): ProfileLink {
  return { pathname: '/profile/[id]', params: { id: profileSlugFor(address, handle) } };
}

export function channelProfileLinkOf(convId: string): ProfileLink {
  return { pathname: '/profile/[id]', params: { id: convId } };
}

export function conversationSharePath(
  convId: string,
  peerAddress?: string | null,
  handle: string | null | undefined = getPeerHandle(peerAddress),
): string {
  return peerAddress ? conversationPathFor(peerAddress, handle) : channelPath(convId);
}

export function frameLinkOf(convId: string, messageId: string): FrameLink {
  return { pathname: '/frame', params: { convId, id: messageId } };
}

export function mailLinkOf(label: string, id: string): string {
  return `/inbox/mail?label=${encodeURIComponent(label)}&id=${encodeURIComponent(id)}`;
}

export function walletSendLinkOf(to: string): WalletSendLink {
  return { pathname: WALLET_LINKS.send, params: { to } };
}

export function messageShareUrlOf(convId: string, peerAddress: string | null, messageId: string): string {
  return `${shareUrlFor(conversationSharePath(convId, peerAddress))}?m=${messageId}`;
}

export function isActiveConversationPath(
  pathname: string,
  convId: string,
  peerAddress?: string | null,
  handle: string | null | undefined = getPeerHandle(peerAddress),
): boolean {
  if (!pathname) return false;
  const path = pathname.toLowerCase();
  if (path === channelPath(convId).toLowerCase()) return true;
  if (!peerAddress) return false;
  return path === `/${peerAddress}`.toLowerCase() || path === conversationPathFor(peerAddress, handle);
}
