import { channelStampSeed, stampAvatarUrl } from '@stage-labs/kit/avatar';
import { shortAddress } from '@stage-labs/client/identity/format';
import { avatarRenderUrl } from '@stage-labs/client/profile/avatar';
import { mentionLabel } from '@stage-labs/client/xmtp/messageBody';
import { isUnnamedChannelRow } from '@stage-labs/client/xmtp/summarizeRow';
import { isPeerResolved, peerLabel } from './peerProfiles';

export interface ConvTitle {
  text: string;
  placeholder: boolean;
}

export interface ConvAvatar {
  avatarUri: string | null;
  avatarAddress: string | null;
}

const LOADING_TITLE: ConvTitle = { text: '', placeholder: false };

function displayNameOf(names: readonly (string | null | undefined)[], fallback: string): string {
  for (const name of names) {
    const shown = name?.trim();
    if (shown) return shown;
  }
  return fallback;
}

export function accountName(account: { address: string; label?: string }, peerName?: string | null): string {
  return displayNameOf([peerName, account.label], shortAddress(account.address));
}

export function profileDisplayName(address: string): string {
  return address ? peerLabel(address) : 'Loading…';
}

export function mentionLabelOf(address: string): string {
  return mentionLabel(peerLabel(address));
}

export function peerTitle(address: string): ConvTitle {
  return { text: peerLabel(address), placeholder: false };
}

export function channelTitle(name: string | null | undefined, placeholder: string): ConvTitle {
  const text = name?.trim() ?? '';
  return text ? { text, placeholder: false } : { text: placeholder, placeholder: true };
}

export function convTitle(conv: { isGroup: boolean; groupName: string | null; peerAddr: string | null }, placeholder: string): ConvTitle {
  if (conv.isGroup) return conv.groupName === null ? LOADING_TITLE : channelTitle(conv.groupName, placeholder);
  return conv.peerAddr ? peerTitle(conv.peerAddr) : LOADING_TITLE;
}

export function rowTitle(row: { peerAddress?: string | null; title: string; groupName?: unknown }): ConvTitle {
  if (row.peerAddress) return peerTitle(row.peerAddress);
  return { text: row.title, placeholder: isUnnamedChannelRow(row) };
}

export function chatLabelOf(chat: { peerAddress: string | null; groupName: string } | null | undefined, placeholder: string): string {
  if (chat === null || chat === undefined) return '';
  if (chat.peerAddress !== null) return peerLabel(chat.peerAddress);
  return channelTitle(chat.groupName, placeholder).text;
}

export function resolvedPeerAddress(address: string | null | undefined): string | null {
  return address && isPeerResolved(address) ? address : null;
}

export function channelAvatar(convId: string, imageUrl: string | null | undefined): ConvAvatar {
  const image = imageUrl?.trim() ?? '';
  if (image) return { avatarUri: image, avatarAddress: null };
  return { avatarUri: null, avatarAddress: convId ? channelStampSeed(convId) : null };
}

export function channelAvatarUrl(convId: string, imageUrl: string | null | undefined, displayPx: number): string {
  const { avatarUri, avatarAddress } = channelAvatar(convId, imageUrl);
  if (avatarUri !== null) return avatarRenderUrl(avatarUri);
  return avatarAddress === null ? '' : stampAvatarUrl(avatarAddress, displayPx);
}

export function rowAvatarAddress(row: {
  avatarUri: string | null;
  avatarAddress: string | null;
  peerAddress?: string | null;
}): string | null {
  if (row.avatarUri || !row.avatarAddress) return null;
  return row.peerAddress ? resolvedPeerAddress(row.avatarAddress) : row.avatarAddress;
}
