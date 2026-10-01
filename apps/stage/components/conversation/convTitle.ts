import { getPeerName } from '../../lib/peerProfiles';
import { shortAddress } from '../../modules/messaging';

export interface ConvTitle {
  text: string;
  placeholder: boolean;
}

export function channelTitle(name: string | null | undefined, fallback = 'Untitled channel'): ConvTitle {
  const text = name?.trim() ?? '';
  return text ? { text, placeholder: false } : { text: fallback, placeholder: true };
}

export function convTitle(conv: { isGroup: boolean; groupName: string | null; peerAddr: string | null }): ConvTitle {
  if (conv.isGroup) return conv.groupName === null ? { text: '', placeholder: false } : channelTitle(conv.groupName);
  return { text: conv.peerAddr ? (getPeerName(conv.peerAddr) ?? shortAddress(conv.peerAddr)) : '', placeholder: false };
}
