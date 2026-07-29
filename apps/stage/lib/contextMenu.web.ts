export interface ContextMenuProps {
  onContextMenu?: (event: { preventDefault: () => void }) => void;
}

export function contextMenuProps(open: (() => void) | undefined): ContextMenuProps {
  if (!open) return {};
  return {
    onContextMenu: (event) => {
      event.preventDefault();
      open();
    },
  };
}
