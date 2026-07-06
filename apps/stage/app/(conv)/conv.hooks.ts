
import { useEffect, useRef, useState } from 'react';
import { InteractionManager, Keyboard } from 'react-native';
import type { Input } from '@stage-labs/kit/react-native/input';
import { isArchived, loadArchivedIds, subscribeArchived } from '../../lib/archived';
import { openDmWithAddress } from '../../modules/messaging';

const DM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export interface ResolvedConv { convId: string | null; resolving: boolean; error: boolean }

export function useResolvedConvId(param: string | undefined): ResolvedConv {
  const isAddress = !!param && DM_ADDRESS_RE.test(param);
  const [state, setState] = useState<ResolvedConv>(() =>
    isAddress
      ? { convId: null, resolving: true, error: false }
      : { convId: param ?? null, resolving: false, error: false });
  useEffect(() => {
    if (!param || !DM_ADDRESS_RE.test(param)) {
      setState({ convId: param ?? null, resolving: false, error: false });
      return;
    }
    let cancelled = false;
    setState({ convId: null, resolving: true, error: false });
    void openDmWithAddress(param)
      .then(id => { if (!cancelled) setState({ convId: id, resolving: false, error: false }); })
      .catch(() => { if (!cancelled) setState({ convId: null, resolving: false, error: true }); });
    return () => { cancelled = true; };
  }, [param]);
  return state;
}

type InputRef = React.RefObject<React.ComponentRef<typeof Input> | null>;

export function useSearchKeyboardFocus(searchOpen: boolean): InputRef {
  const searchInputRef = useRef<React.ComponentRef<typeof Input>>(null);
  useEffect(() => {
    if (!searchOpen) return;
    let shown = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const sub = Keyboard.addListener('keyboardDidShow', () => { shown = true; });
    const poke = (): void => {
      if (shown || attempts >= 8) return;
      attempts += 1;
      const input = searchInputRef.current;
      input?.blur();
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

export function useArchivedFlag(convId: string | undefined): boolean {
  const [archived, setArchived] = useState(convId ? isArchived(convId) : false);
  useEffect(() => {
    const sync = (): void => { setArchived(convId ? isArchived(convId) : false); };
    void loadArchivedIds().then(sync);
    return subscribeArchived(sync);
  }, [convId]);
  return archived;
}
