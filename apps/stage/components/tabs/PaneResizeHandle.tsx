import { useEffect, useRef } from 'react';
import type { PointerEvent, ViewStyle } from 'react-native';
import { Box } from '../layout';
import { getPaneWidth, setPaneWidth, resetPaneWidth } from './paneWidth';

const DOUBLE_TAP_MS = 300;
const TAP_SLOP_PX = 3;

interface Drag {
  pointerId: number;
  x: number;
  y: number;
  width: number;
}

function setResizing(on: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('stage-resizing', on);
}

function capturePointer(target: unknown, pointerId: number): void {
  (target as { setPointerCapture?: (id: number) => void } | null)?.setPointerCapture?.(pointerId);
}

function isTap(drag: Drag, x: number, y: number): boolean {
  return Math.abs(x - drag.x) < TAP_SLOP_PX && Math.abs(y - drag.y) < TAP_SLOP_PX;
}

export function PaneResizeHandle(): React.ReactElement {
  const drag = useRef<Drag | null>(null);
  const lastTapAt = useRef(0);

  useEffect(() => () => { setResizing(false); }, []);

  const active = (event: PointerEvent): Drag | null => {
    const current = drag.current;
    return current?.pointerId === event.nativeEvent.pointerId ? current : null;
  };

  const finish = (event: PointerEvent): Drag | null => {
    const current = active(event);
    if (current === null) return null;
    drag.current = null;
    setResizing(false);
    return current;
  };

  const onPointerDown = (event: PointerEvent): void => {
    const { button, pointerId, clientX, clientY } = event.nativeEvent;
    if (button !== 0) return;
    event.preventDefault();
    capturePointer(event.currentTarget, pointerId);
    drag.current = { pointerId, x: clientX, y: clientY, width: getPaneWidth() };
    setResizing(true);
  };

  const onPointerMove = (event: PointerEvent): void => {
    const current = active(event);
    if (current !== null) setPaneWidth(current.width + event.nativeEvent.clientX - current.x);
  };

  const onPointerUp = (event: PointerEvent): void => {
    const ended = finish(event);
    if (ended === null || !isTap(ended, event.nativeEvent.clientX, event.nativeEvent.clientY)) return;
    const now = Date.now();
    if (now - lastTapAt.current < DOUBLE_TAP_MS) resetPaneWidth();
    lastTapAt.current = now;
  };

  return (
    <Box
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={finish}
      width={8}
      style={{
        position: 'absolute', top: 0, bottom: 0, right: -4, zIndex: 4,
        cursor: 'col-resize', touchAction: 'none',
      } as unknown as ViewStyle}
/>
  );
}
