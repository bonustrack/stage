import { useCallback, useState, type RefObject } from 'react';
import { useWindowDimensions } from 'react-native';
import { documentScroll } from '../layout/webLayout';
import type { FillViewport, Measurable } from './fillViewport';

export function useFillViewport(ref: RefObject<Measurable | null>): FillViewport {
  const { height } = useWindowDimensions();
  const [top, setTop] = useState<number | null>(null);
  const onLayout = useCallback(() => {
    ref.current?.measureInWindow((_x, y) => {
      setTop(y + documentScroll().y);
    });
  }, [ref]);
  return { onLayout, minHeight: top === null ? undefined : Math.max(0, height - top) };
}
