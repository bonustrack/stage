export interface ContextMenuProps {
  onContextMenu?: (event: { preventDefault: () => void }) => void;
}

export function contextMenuProps(open: (() => void) | undefined): ContextMenuProps {
  void open;
  return {};
}
