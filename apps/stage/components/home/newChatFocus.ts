import { useEffect, useState } from 'react';
import { makeListeners, useStoreValue } from '../../lib/storeCore';

let requested = 0;
let handled = 0;
const listeners = makeListeners();

export function requestNewChatFocus(): void {
  requested += 1;
  listeners.notify();
}

export function useNewChatFocusNonce(): number {
  const nonce = useStoreValue(listeners.subscribe, () => requested);
  const [handledBefore] = useState(() => handled);
  useEffect(() => { handled = Math.max(handled, nonce); }, [nonce]);
  return nonce > handledBefore ? nonce : 0;
}
