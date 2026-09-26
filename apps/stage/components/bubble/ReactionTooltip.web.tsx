import type { ReactNode } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { HoverTooltip } from '../HoverTooltip';

export function ReactionTooltip({ label, emoji, onReact, children }: {
  label: string; emoji: string; onReact?: (emoji: string) => void; children: ReactNode;
}): React.ReactElement {
  return (
    <HoverTooltip label={label}>
      {onReact ? <Pressable onPress={() => { onReact(emoji); }}>{children}</Pressable> : children}
    </HoverTooltip>
  );
}
