
import { useEffect, useState } from 'react';
import {
  isCustomTheme, loadOverrides, subscribe as subscribeOverrides,
} from './colorOverrides';

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
