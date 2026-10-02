import { getPeerName } from '../../lib/peerProfiles';
import { shortAddress } from '../../modules/messaging';
import { mentionLabel } from '../bubble/mention.model';

export function peerLabel(address: string): string {
  return getPeerName(address) ?? shortAddress(address);
}

export function mentionLabelOf(address: string): string {
  return mentionLabel(peerLabel(address));
}

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
  return { text: conv.peerAddr ? peerLabel(conv.peerAddr) : '', placeholder: false };
}
