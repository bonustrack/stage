import { useRef, type Dispatch, type SetStateAction } from 'react';
import { Platform, View, type GestureResponderEvent, type PointerEvent, type ViewProps } from 'react-native';
import type { ChartCategory } from '../chart';

type SetActive = Dispatch<SetStateAction<number | undefined>>;

interface Point {
  x: number;
  y: number;
}

const IS_WEB = Platform.OS === 'web';
const TAP_SLOP = 10;

function toggle(setActive: SetActive, index: number): void {
  setActive((current) => (current === index ? undefined : index));
}

function webHandlers(index: number, setActive: SetActive): ViewProps {
  return {
    onPointerEnter: (e: PointerEvent) => {
      if (e.nativeEvent.pointerType === 'touch') toggle(setActive, index);
      else setActive(index);
    },
    onPointerLeave: (e: PointerEvent) => {
      if (e.nativeEvent.pointerType !== 'touch') setActive((current) => (current === index ? undefined : current));
    },
  };
}

function touchHandlers(index: number, setActive: SetActive, origin: { current: Point | null }): ViewProps {
  return {
    onTouchStart: (e: GestureResponderEvent) => {
      origin.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    },
    onTouchEnd: (e: GestureResponderEvent) => {
      const start = origin.current;
      origin.current = null;
      if (start !== null && Math.hypot(e.nativeEvent.pageX - start.x, e.nativeEvent.pageY - start.y) < TAP_SLOP) toggle(setActive, index);
    },
  };
}

export interface ChartBandsProps {
  categories: readonly ChartCategory[];
  height: number;
  setActive: SetActive;
}

export function ChartBands({ categories, height, setActive }: ChartBandsProps): React.ReactElement {
  const origin = useRef<Point | null>(null);
  return (
    <>
      {categories.map((c, i) => (
        <View key={i} collapsable={false}
          style={{ position: 'absolute', top: 0, left: c.start, width: Math.max(1, c.end - c.start), height }}
          {...(IS_WEB ? webHandlers(i, setActive) : touchHandlers(i, setActive, origin))} />
      ))}
    </>
  );
}
