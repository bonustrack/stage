import type { BubbleLinkProps, LinkPress } from './helpers';

export function bubbleLinkProps(url: string, onLinkPress: LinkPress): BubbleLinkProps {
  return { onPress: () => { onLinkPress?.(url); } };
}
