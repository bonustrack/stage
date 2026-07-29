import type { MenuPoint } from '../components/AnchoredMenu.model';

export interface ContextMenuEvent {
  preventDefault: () => void;
  clientX: number;
  clientY: number;
}

export interface ContextMenuProps {
  onContextMenu?: (event: ContextMenuEvent) => void;
}

export function contextMenuProps(open: ((point: MenuPoint) => void) | undefined): ContextMenuProps {
  void open;
  return {};
}

export function dismissContextMenuProps(close: () => void): ContextMenuProps {
  void close;
  return {};
}
