import { Platform } from 'react-native';
import { reopenContextMenuAt } from './dom';

export interface ContextMenuPoint {
  x: number;
  y: number;
}

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

export function contextMenuProps(open: ((point: ContextMenuPoint) => void) | undefined): ContextMenuProps {
  if (Platform.OS !== 'web' || !open) return {};
  return {
    onContextMenu: (event) => {
      if (!event.currentTarget.contains(event.target)) return;
      event.preventDefault();
      open({ x: event.clientX, y: event.clientY });
    },
  };
}

export function dismissContextMenuProps(close: () => void): ContextMenuProps {
  if (Platform.OS !== 'web') return {};
  return {
    onContextMenu: (event) => {
      event.preventDefault();
      const { clientX, clientY } = event;
      close();
      reopenContextMenuAt(clientX, clientY);
    },
  };
}
