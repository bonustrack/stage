
import { useRef } from 'react';
import { PanResponder, type ViewStyle } from 'react-native';
import { Box } from '../layout';
import { getPaneWidth, setPaneWidth, resetPaneWidth } from './paneWidth';

const DOUBLE_TAP_MS = 300;
const TAP_SLOP_PX = 3;

function setResizing(on: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList[on ? 'add' : 'remove']('stage-resizing');
}

export function PaneResizeHandle(): React.ReactElement {
  const startWidth = useRef(0);
  const lastTapAt = useRef(0);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      startWidth.current = getPaneWidth();
      setResizing(true);
    },
    onPanResponderMove: (_e, g) => { setPaneWidth(startWidth.current + g.dx); },
    onPanResponderRelease: (_e, g) => {
      setResizing(false);
      if (Math.abs(g.dx) >= TAP_SLOP_PX || Math.abs(g.dy) >= TAP_SLOP_PX) return;
      const now = Date.now();
      if (now - lastTapAt.current < DOUBLE_TAP_MS) resetPaneWidth();
      lastTapAt.current = now;
    },
    onPanResponderTerminate: () => { setResizing(false); },
  })).current;

  return (
    <Box
      {...pan.panHandlers}
      width={8}
      style={{
        position: 'absolute', top: 0, bottom: 0, right: -4, zIndex: 4,
        cursor: 'col-resize',
      } as unknown as ViewStyle}
/>
  );
}
