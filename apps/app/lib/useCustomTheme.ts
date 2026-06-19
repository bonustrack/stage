/**
 * @file Reactive hook for the Custom-theme flag (lib/colorOverrides), re-rendering whenever the user toggles Custom in Settings -> Display or the flag loads from storage.
 */

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
