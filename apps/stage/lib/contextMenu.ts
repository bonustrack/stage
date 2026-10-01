import type { MenuPoint } from '../components/AnchoredMenu.model';

import type { ContextMenuProps, HoldMenuProps } from './contextMenu.model';

export type { ContextMenuEvent, ContextMenuProps, HoldMenuProps } from './contextMenu.model';

export function contextMenuProps(open: ((point: MenuPoint) => void) | undefined): ContextMenuProps {
  void open;
  return {};
}

export function dismissContextMenuProps(close: () => void): ContextMenuProps {
  void close;
  return {};
}

export function holdMenuProps(open: ((point: MenuPoint) => void) | undefined): HoldMenuProps {
  void open;
  return {};
}
