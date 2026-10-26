import { useCallback, useEffect, useRef, useState } from 'react';
import { Text } from '@stage-labs/kit/react-native/text';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { Button } from '@stage-labs/kit/react-native/button';
import { AppModal } from '../AppModal';
import { incomingShare } from '../../lib/incomingShare';
import type { IncomingShare } from '../../lib/incomingShare.types';
import { parseIncomingShare, shareError } from './share.model';
import { ShareSession } from './ShareSession';
import { useEffectiveColorScheme } from '../../lib/theme';
import { Column } from '../layout';

function useIncomingShare() {
  const [pending, setPending] = useState<IncomingShare | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const refresh = useCallback(async (): Promise<void> => {
    const request = ++generation.current;
    try {
      const value = await incomingShare.getPending();
      if (generation.current !== request) return;
      setPending(parseIncomingShare(value));
      setError(null);
    } catch {
      if (generation.current === request) setError('Could not open the pending share. Try again.');
    }
  }, []);
  useEffect(() => {
    const unsubscribe = incomingShare.subscribe(() => { void refresh(); });
    void refresh();
    return () => { generation.current += 1; unsubscribe(); };
  }, [refresh]);
  const dismiss = async (keepFiles: boolean): Promise<void> => {
    if (pending === null) { setError(null); return; }
    generation.current += 1;
    await incomingShare.dismiss(pending.id, keepFiles);
    await refresh();
  };
  return { pending, error, refresh, dismiss };
}

export function ShareHost({ active }: { active: boolean }): React.ReactElement {
  const { pending, error, refresh, dismiss } = useIncomingShare();
  const dark = useEffectiveColorScheme() === 'dark';
  const [closing, setClosing] = useState(false);
  const close = (): void => {
    if (closing) return;
    setClosing(true);
    void dismiss(false).finally(() => { setClosing(false); }).catch(() => { void refresh(); });
  };
  if (pending?.status === 'ready') return <ShareSession key={pending.id} share={pending} active={active} onDismiss={dismiss}/>;
  return (
    <AppModal visible={active && (pending !== null || error !== null)} title="Share to Stage" onClose={close} dismissable={!closing}>
      <Column gap={12}>
        {pending?.status === 'loading' ? <><Spinner/><Text>Copying shared files privately on this device…</Text></> : null}
        {pending?.status === 'error' ? <Text>{shareError(pending.error)}</Text> : null}
        {error === null ? null : <><Text color="danger">{error}</Text><Button dark={dark} label="Try again" variant="soft" onPress={() => { void refresh(); }}/></>}
        <Button dark={dark} label="Cancel share" variant="soft" color="secondary" loading={closing} onPress={close}/>
      </Column>
    </AppModal>
  );
}
