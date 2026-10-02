import { Platform } from 'react-native';
import type { MenuPoint } from '../components/AnchoredMenu.model';

interface ContextMenuEvent {
  preventDefault: () => void;
  clientX: number;
  clientY: number;
  target: Node | null;
  currentTarget: Node;
}

interface ContextMenuProps {
  onContextMenu?: (event: ContextMenuEvent) => void;
}

export function contextMenuProps(open: ((point: MenuPoint) => void) | undefined): ContextMenuProps {
  if (Platform.OS !== 'web' || !open) return {};
  return {
    onContextMenu: (event) => {
      if (!event.currentTarget.contains(event.target)) return;
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
  if (Platform.OS !== 'web') return {};
  return {
    onContextMenu: (event) => {
      event.preventDefault();
      const { clientX, clientY } = event;
      close();
      reopenBelowOverlay(clientX, clientY);
    },
  };
}
