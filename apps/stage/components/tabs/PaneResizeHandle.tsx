import { useEffect, useRef, useState } from 'react';
import type { PointerEvent, ViewStyle } from 'react-native';
import { Box } from '../layout';
import { usePalette } from '../../lib/theme';
import { getPaneWidth, setPaneWidth, resetPaneWidth } from './paneWidth';

const DOUBLE_TAP_MS = 300;
const TAP_SLOP_PX = 3;
const HANDLE_WIDTH = 8;
const BAR_WIDTH = 4;
const HANDLE_STYLE = {
  position: 'absolute', top: 0, bottom: 0, right: -HANDLE_WIDTH / 2, zIndex: 4,
  cursor: 'col-resize', touchAction: 'none',
} as unknown as ViewStyle;

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

function EdgeBar({ visible }: { visible: boolean }): React.ReactElement {
  const { border } = usePalette();
  return (
    <Box
      pointerEvents="none"
      width={BAR_WIDTH}
      background={visible ? border : undefined}
      style={{ position: 'absolute', top: 0, bottom: 0, right: HANDLE_WIDTH / 2 - 1 }}
/>
  );
}

export function PaneResizeHandle(): React.ReactElement {
  const drag = useRef<Drag | null>(null);
  const lastTapAt = useRef(0);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);

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
    setDragging(false);
    return current;
  };

  const onPointerDown = (event: PointerEvent): void => {
    const { button, pointerId, clientX, clientY } = event.nativeEvent;
    if (button !== 0) return;
    event.preventDefault();
    capturePointer(event.currentTarget, pointerId);
    drag.current = { pointerId, x: clientX, y: clientY, width: getPaneWidth() };
    setResizing(true);
    setDragging(true);
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
      onPointerEnter={() => { setHovered(true); }}
      onPointerLeave={() => { setHovered(false); }}
      width={HANDLE_WIDTH}
      style={HANDLE_STYLE}
    >
      <EdgeBar visible={hovered || dragging}/>
    </Box>
  );
}
