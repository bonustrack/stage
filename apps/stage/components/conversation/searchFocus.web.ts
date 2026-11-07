import { useEffect, useRef } from 'react';
import type { TextField } from '@stage-labs/kit/react-native/text-field';

type InputRef = React.RefObject<React.ComponentRef<typeof TextField> | null>;

export function useSearchKeyboardFocus(searchOpen: boolean): InputRef {
  const searchInputRef = useRef<React.ComponentRef<typeof TextField>>(null);
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);
  return searchInputRef;
}
