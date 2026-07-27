import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Box } from '../layout';
import { invertedThumb, type FeedScrollMetrics, type FeedThumb } from './feed-helpers';

const IDLE_HIDE_MS = 900;
const THUMB_WIDTH = 3;

export interface FeedScrollbarControl { update: (m: FeedScrollMetrics) => void }

export function FeedScrollbar({ control, color, top, bottom }: {
  control: React.RefObject<FeedScrollbarControl | null>;
  color: string;
  top: number;
  bottom: number;
}): React.ReactElement | null {
  const [thumb, setThumb] = useState<FeedThumb | null>(null);
  const [scrolling, setScrolling] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(control, () => ({
    update: (m: FeedScrollMetrics) => {
      setThumb(invertedThumb(m, Math.max(0, m.viewportHeight - top - bottom)));
      setScrolling(true);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => { setScrolling(false); }, IDLE_HIDE_MS);
    },
  }), [top, bottom]);

  useEffect(() => () => { if (idleTimer.current) clearTimeout(idleTimer.current); }, []);

  if (!thumb || !scrolling) return null;
  return (
    <Box
      pointerEvents="none"
      style={{ position: 'absolute', right: 2, top, bottom, width: THUMB_WIDTH }}
    >
      <Box
        background={color}
        style={{
          position: 'absolute', bottom: thumb.bottom, height: thumb.height,
          width: THUMB_WIDTH, borderRadius: THUMB_WIDTH, opacity: 0.4,
        }}
      />
    </Box>
  );
}
