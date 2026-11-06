import type { LinkClickEvent } from '@stage-labs/kit/link';

export type LinkPress = ((url: string) => boolean) | undefined;

export interface BubbleLinkProps {
  accessibilityRole?: 'link';
  onPress?: (event?: LinkClickEvent) => void;
  href?: string;
  hrefAttrs?: { target: string; rel: string };
  ref?: (node: unknown) => void;
}
