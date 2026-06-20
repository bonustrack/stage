/** @file Conversation-screen hooks: search-keyboard re-focus retry and the reactive archived flag. */

import { useEffect, useRef, useState } from 'react';
import { InteractionManager, Keyboard } from 'react-native';
import type { Input } from '@metro-labs/kit/input';
import { isArchived, loadArchivedIds, subscribeArchived } from '../../lib/archived';

type InputRef = React.RefObject<React.ComponentRef<typeof Input> | null>;

/** Re-focus the search input after the ChannelMenu modal dismisses so the soft keyboard re-attaches (blur+focus with verified retry). */
export function useSearchKeyboardFocus(searchOpen: boolean): InputRef {
  const searchInputRef = useRef<React.ComponentRef<typeof Input>>(null);
  useEffect(() => {
    if (!searchOpen) return;
    let shown = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const sub = Keyboard.addListener('keyboardDidShow', () => { shown = true; });
    /** Poke helper. */
    const poke = (): void => {
      if (shown || attempts >= 8) return;
      attempts += 1;
      const input = searchInputRef.current;
      input?.blur();
      /** Re-focus next frame so the blur lands first (Android needs the focus state to toggle for the IME to re-open). */
      requestAnimationFrame(() => { searchInputRef.current?.focus(); });
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

/** Reactive archived flag for a conversation (the store loads async; sync read can miss first paint). */
export function useArchivedFlag(convId: string | undefined): boolean {
  const [archived, setArchived] = useState(convId ? isArchived(convId) : false);
  useEffect(() => {
    /** Sync helper. */
    const sync = (): void => { setArchived(convId ? isArchived(convId) : false); };
    void loadArchivedIds().then(sync);
    return subscribeArchived(sync);
  }, [convId]);
  return archived;
}
