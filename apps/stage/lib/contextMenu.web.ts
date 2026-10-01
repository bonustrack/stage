import type { MenuPoint } from '../components/AnchoredMenu.model';

import type { ContextMenuProps, HoldMenuProps } from './contextMenu.model';

export type { ContextMenuEvent, ContextMenuProps, HoldMenuProps } from './contextMenu.model';

const HOLD_MS = 300;
const HOLD_SLOP_PX = 10;
const HOLD_ENDS = ['pointerup', 'pointercancel'] as const;

export function contextMenuProps(open: ((point: MenuPoint) => void) | undefined): ContextMenuProps {
  if (!open) return {};
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
  return {
    onContextMenu: (event) => {
      event.preventDefault();
      const { clientX, clientY } = event;
      close();
      reopenBelowOverlay(clientX, clientY);
    },
  };
}

function swallowNextClick(): void {
  const release = (): void => {
    window.removeEventListener('click', swallow, true);
    window.removeEventListener('pointerdown', release, true);
  };
  const swallow = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    release();
  };
  window.addEventListener('click', swallow, true);
  window.addEventListener('pointerdown', release, true);
}

function holdAt(point: MenuPoint, open: (point: MenuPoint) => void): void {
  const stop = (): void => {
    clearTimeout(timer);
    window.removeEventListener('pointermove', move, true);
    for (const type of HOLD_ENDS) window.removeEventListener(type, stop, true);
  };
  const move = (event: PointerEvent): void => {
    if (Math.hypot(event.clientX - point.x, event.clientY - point.y) > HOLD_SLOP_PX) stop();
  };
  const timer = setTimeout(() => {
    stop();
    swallowNextClick();
    open(point);
  }, HOLD_MS);
  window.addEventListener('pointermove', move, true);
  for (const type of HOLD_ENDS) window.addEventListener(type, stop, true);
}

export function holdMenuProps(open: ((point: MenuPoint) => void) | undefined): HoldMenuProps {
  if (!open) return {};
  return {
    onPointerDown: (event) => {
      const { button, isPrimary, clientX, clientY } = event.nativeEvent;
      const { currentTarget, target } = event;
      if (button !== 0 || !isPrimary) return;
      if (currentTarget instanceof Node && target instanceof Node && !currentTarget.contains(target)) return;
      holdAt({ x: clientX, y: clientY }, open);
    },
  };
}
