/** React hook: is sync work in flight RIGHT NOW, debounced for display.
 *
 *  Show only after work has been pending for ~300ms (so a quick local-cache
 *  pass that finishes instantly never flickers a pill), hide immediately when
 *  the counter hits 0. Reads the global `syncStatus` counter. */

import { useEffect, useRef, useState } from 'react';
import { useSyncExternalStore } from 'react';
import { getSyncInFlight, subscribeSyncStatus } from './syncStatus';

/** Delay before a sustained in-flight state is surfaced (anti-flicker). */
const SHOW_DELAY_MS = 300;

export function useSyncActive(): boolean {
  const inFlight = useSyncExternalStore(subscribeSyncStatus, getSyncInFlight, getSyncInFlight);
  const [visible, setVisible] = useState(false);
  // `number` (RN timer id): @types/node (pulled in via the Railgun SDK) makes
  // setTimeout's return type collide with the DOM lib at clearTimeout().
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (inFlight > 0) {
      if (visible || timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        setVisible(true);
      }, SHOW_DELAY_MS) as unknown as number;
      return;
    }
    /** Idle — cancel a pending show + hide immediately. */
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (visible) setVisible(false);
  }, [inFlight, visible]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return visible;
}
