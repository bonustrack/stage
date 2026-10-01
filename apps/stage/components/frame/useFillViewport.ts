import { useCallback, useRef, useState, type RefObject } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import type { ViewType } from '../layout/native';
import { documentScroll } from '../../lib/webLayout';

export function useFillViewport(): { ref: RefObject<ViewType | null>; onLayout: () => void; minHeight?: number } {
  const ref = useRef<ViewType>(null);
  const { height } = useWindowDimensions();
  const [top, setTop] = useState<number | null>(null);
  const onLayout = useCallback(() => {
    if (Platform.OS !== 'web') return;
    ref.current?.measureInWindow((_x, y) => { setTop(y + documentScroll().y); });
  }, []);
  return { ref, onLayout, minHeight: top === null ? undefined : Math.max(0, height - top) };
}
