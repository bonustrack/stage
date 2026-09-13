export interface ContextMenuEvent {
  preventDefault: () => void;
  clientX: number;
  clientY: number;
}

export interface ContextMenuProps {
  onContextMenu?: (event: ContextMenuEvent) => void;
}
