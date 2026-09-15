import { useEffect } from 'react';
import { errorMessage } from '@stage-labs/client/errors';
import { checkStageName } from '../../lib/claimName';
import { localLabelProblem, type ClaimState } from './ProfileSettings.claim.model';

const CHECK_DEBOUNCE_MS = 400;

export function useNameAvailability(label: string, setState: (next: ClaimState) => void): void {
  useEffect(() => {
    if (label === '') { setState({ label, phase: 'idle' }); return; }
    const problem = localLabelProblem(label);
    if (problem) { setState({ label, phase: 'invalid', detail: problem }); return; }
    setState({ label, phase: 'checking' });
    let cancelled = false;
    const timer = setTimeout(() => {
      void checkStageName(label).then((check) => {
        if (cancelled) return;
        if (!check.valid) setState({ label, phase: 'invalid', detail: check.reason });
        else setState({ label, phase: check.available ? 'available' : 'unavailable' });
      }).catch((err: unknown) => {
        if (!cancelled) setState({ label, phase: 'failed', detail: errorMessage(err) });
      });
    }, CHECK_DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [label]);
}
