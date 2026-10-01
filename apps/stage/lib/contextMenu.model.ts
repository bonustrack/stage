import type { PointerEvent } from 'react-native';

export interface ContextMenuEvent {
  preventDefault: () => void;
  clientX: number;
  clientY: number;
  target: Node | null;
  currentTarget: Node;
}

export interface ContextMenuProps {
  onContextMenu?: (event: ContextMenuEvent) => void;
}

export interface HoldMenuProps {
  onPointerDown?: (event: PointerEvent) => void;
}
