import { useEffect, useRef } from 'react';
import { InteractionManager, Keyboard } from 'react-native';
import type { ResolveConvError } from '../../lib/messaging/resolveConversation';
import { type TextField } from '@stage-labs/kit/react-native/text-field';

export function resolveErrorMessage(error: ResolveConvError, detail?: string): string {
  if (error === 'unregistered') return 'This address is not on XMTP yet. Ask them to sign in once, then retry.';
  if (error === 'stale-installations')
    return 'This contact has not used XMTP in a while, so their keys expired. They need to open an XMTP app before you can message them.';
  if (error === 'failed') return detail ? `Could not open this conversation. ${detail}` : 'Could not open this conversation.';
  return 'Missing conversation id.';
}

type InputRef = React.RefObject<React.ComponentRef<typeof TextField> | null>;

export function useSearchKeyboardFocus(searchOpen: boolean): InputRef {
  const searchInputRef = useRef<React.ComponentRef<typeof TextField>>(null);
  useEffect(() => {
    if (!searchOpen) return;
    let shown = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      shown = true;
    });
    const poke = (): void => {
      if (shown || attempts >= 8) return;
      attempts += 1;
      const input = searchInputRef.current;
      input?.blur();
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
      timer = setTimeout(poke, 150);
    };
    const task = InteractionManager.runAfterInteractions(poke);
    return () => {
      sub.remove();
      task.cancel();
      if (timer) clearTimeout(timer);
    };
  }, [searchOpen]);
  return searchInputRef;
}
