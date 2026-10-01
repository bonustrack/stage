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
