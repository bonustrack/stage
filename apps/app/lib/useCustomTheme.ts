/** Reactive hook for the Custom-theme flag (lib/colorOverrides). Re-renders the
 *  caller whenever the user enables/disables Custom in Settings -> Display, or
 *  the flag loads from storage. Display uses it to mark Custom as selected and
 *  to reveal the color-token editor; usePalette gates the saved overrides on it.
 *  Split out of lib/theme.ts to keep that module under the line cap. */

import { useEffect, useState } from 'react';
import {
  isCustomTheme, loadOverrides, subscribe as subscribeOverrides,
} from './colorOverrides';

/** Reactive hook returning whether the Custom theme flag is currently enabled. */
export function useCustomTheme(): boolean {
  const [on, setOn] = useState(isCustomTheme());
  useEffect(() => {
    loadOverrides();
    setOn(isCustomTheme());
    const unsub = subscribeOverrides(() => { setOn(isCustomTheme()); });
    return unsub;
  }, []);
  return on;
}
