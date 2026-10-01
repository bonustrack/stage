import { useEffect } from 'react';
import type { StartedSend } from './sendRun';

const handed = new Map<string, StartedSend>();

export function handSendTo(convId: string, started: StartedSend): void {
  handed.set(convId.toLowerCase(), started);
}

export function useHandedSend(convId: string | null, adopt: (started: StartedSend) => void): void {
  useEffect(() => {
    if (convId === null) return;
    const key = convId.toLowerCase();
    const started = handed.get(key);
    if (started === undefined) return;
    handed.delete(key);
    adopt(started);
  }, [convId]);
}
