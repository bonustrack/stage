/** App Lock runtime controller for the root layout.
 *
 *  Owns the live `locked` boolean and the AppState wiring that re-arms the lock.
 *  Rules:
 *   - Cold start: locked === true the moment the preference loads enabled (the
 *     layout renders the LockScreen instead of the app).
 *   - Background → foreground resume: relock iff the app was backgrounded for
 *     longer than BACKGROUND_GRACE_MS (quick app-switches don't relock).
 *   - Toggling the preference OFF clears any active lock; toggling ON does NOT
 *     immediately lock the current session (the user just authenticated into
 *     settings) — it arms on the next cold start / qualifying resume.
 *
 *  The layout calls this once and renders <LockScreen> while `locked`, passing
 *  `unlock` as the success callback. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { BACKGROUND_GRACE_MS, useAppLockGate } from './appLock';

export interface AppLockController {
  /** False until the preference's one-time load resolves (gate the spinner). */
  ready: boolean;
  /** Render the LockScreen over the app while true. */
  locked: boolean;
  /** Success callback for the LockScreen. */
  unlock: () => void;
}

export function useAppLockController(): AppLockController {
  const { ready, enabled } = useAppLockGate();
  // Start locked when enabled is known-true at first resolve (cold start).
  const [locked, setLocked] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  const armedColdStart = useRef(false);

  // Arm the cold-start lock the first time we learn the preference is enabled.
  useEffect(() => {
    if (!ready || armedColdStart.current) return;
    armedColdStart.current = true;
    if (enabled) setLocked(true);
  }, [ready, enabled]);

  // If the user disables App Lock, drop any active lock immediately.
  useEffect(() => {
    if (!enabled) setLocked(false);
  }, [enabled]);

  useEffect(() => {
    const onChange = (state: AppStateStatus): void => {
      if (state === 'active') {
        const since = backgroundedAt.current;
        backgroundedAt.current = null;
        if (enabled && since != null && Date.now() - since > BACKGROUND_GRACE_MS) {
          setLocked(true);
        }
      } else if (state === 'background' || state === 'inactive') {
        // Record the first transition away; don't overwrite on inactive→background.
        if (backgroundedAt.current == null) backgroundedAt.current = Date.now();
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [enabled]);

  const unlock = useCallback(() => setLocked(false), []);
  return { ready, locked: enabled && locked, unlock };
}
