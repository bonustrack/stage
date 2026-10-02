import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { usePathname } from 'expo-router';
import { makeListeners, useStoreValue } from '../../lib/storeCore';

let requested = 0;
let handled = 0;
const listeners = makeListeners();

const NEW_CHAT_PATHS: ReadonlySet<string> = new Set(['/', '/new']);

export function requestNewChatFocus(): void {
  requested += 1;
  listeners.notify();
}

function useFocusOnOpen(): void {
  const pathname = usePathname();
  useEffect(() => {
    if (Platform.OS === 'web' && NEW_CHAT_PATHS.has(pathname)) requestNewChatFocus();
  }, [pathname]);
}

export function useNewChatFocusNonce(): number {
  useFocusOnOpen();
  const nonce = useStoreValue(listeners.subscribe, () => requested);
  const [handledBefore] = useState(() => handled);
  useEffect(() => { handled = Math.max(handled, nonce); }, [nonce]);
  return nonce > handledBefore ? nonce : 0;
}
