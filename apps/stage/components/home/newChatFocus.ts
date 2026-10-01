import { makeListeners, useStoreValue } from '../../lib/storeCore';

let focusNonce = 0;
const listeners = makeListeners();

export function requestNewChatFocus(): void {
  focusNonce += 1;
  listeners.notify();
}

export function useNewChatFocusNonce(): number {
  return useStoreValue(listeners.subscribe, () => focusNonce);
}
