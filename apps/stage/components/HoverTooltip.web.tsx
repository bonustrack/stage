import { useEffect, useRef, type ReactNode } from 'react';
import { View } from 'react-native';
import { isShown, keyTarget, modalOpen } from './keyEvents.web';
import { shortcutKey, shortcutOf, type Shortcut } from './shortcuts.model';
import { hideRailTooltip, hoverRect, showRailTooltip, tooltipLabel, tooltipState, type TooltipPlacement } from '../lib/railTooltip';

function useShortcut(shortcut: Shortcut | undefined, onShortcut: (() => void) | undefined): React.RefObject<View | null> {
  const node = useRef<View>(null);
  const handler = useRef(onShortcut);
  handler.current = onShortcut;
  useEffect(() => {
    if (shortcut === undefined) return undefined;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (shortcutOf(event, keyTarget(event.target), modalOpen()) !== shortcut || !isShown(node.current)) return;
      event.preventDefault();
      hideRailTooltip();
      handler.current?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return (): void => { window.removeEventListener('keydown', onKeyDown); };
  }, [shortcut]);
  return node;
}

export function HoverTooltip({ label, children, placement = 'above', shortcut, onShortcut }: {
  label: string; children: ReactNode; placement?: TooltipPlacement; shortcut?: Shortcut; onShortcut?: () => void;
}): React.ReactElement {
  const node = useShortcut(shortcut, onShortcut);
  const keyLabel = shortcut === undefined ? undefined : shortcutKey(shortcut);
  return (
    <View
      ref={node}
      onPointerEnter={(event) => {
        const rect = hoverRect(event);
        if (rect) showRailTooltip(tooltipState(placement, tooltipLabel(label), rect, keyLabel));
      }}
      onPointerLeave={hideRailTooltip}
      onPointerDown={hideRailTooltip}
    >
      {children}
    </View>
  );
}
