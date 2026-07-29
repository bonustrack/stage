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
  if (!open) return {};
  return {
    onContextMenu: (event) => {
      event.preventDefault();
      open({ x: event.clientX, y: event.clientY });
    },
  };
}

function reopenBelowOverlay(clientX: number, clientY: number): void {
  requestAnimationFrame(() => {
    const target = document.elementFromPoint(clientX, clientY);
    if (!target) return;
    target.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX, clientY }),
    );
  });
}

export function dismissContextMenuProps(close: () => void): ContextMenuProps {
  return {
    onContextMenu: (event) => {
      event.preventDefault();
      const { clientX, clientY } = event;
      close();
      reopenBelowOverlay(clientX, clientY);
    },
  };
}
