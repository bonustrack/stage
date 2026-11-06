import type { BubbleLinkProps, LinkPress } from './linkProps.types';

export function bubbleLinkProps(url: string, onLinkPress: LinkPress): BubbleLinkProps {
  return {
    onPress: () => {
      onLinkPress?.(url);
    },
  };
}
