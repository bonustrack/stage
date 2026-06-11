/** useUsernameClaim — state + handlers for claiming a `<name>.stage.box`
 *  username. Mirrors the unified sign path used by useTxSignLayer: a local EOA
 *  signs in-process (no popup); a WalletConnect account delegates to the remote
 *  wallet via wagmi. Availability is debounced against the gateway; the claim
 *  signs the shared claimMessage and POSTs it. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getAccount, signMessage } from 'wagmi/actions';
import { wagmiConfig } from '../../lib/walletconnect';
import { getActiveViemAccount } from '../../lib/accounts';
import {
  validateName, normalizeName, nameErrorMessage,
} from '@stage-labs/client/identity/username';
import {
  buildClaim, isNameAvailable, lookupAddress, submitClaim,
} from '../../lib/stageUsernames';

type Avail = 'idle' | 'checking' | 'free' | 'taken' | 'invalid';

export interface UsernameClaim {
  /** Raw input + its normalised label. */
  input: string; setInput: (s: string) => void; name: string;
  /** Validation / availability state + a user-facing hint. */
  status: Avail; hint: string;
  /** The username the active address already owns (full `<name>.stage.box`). */
  current: string | null;
  /** Claim in flight. */
  claiming: boolean;
  /** Attempt the claim; resolves true on success. */
  claim: () => Promise<boolean>;
}

export function useUsernameClaim(): UsernameClaim {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<Avail>('idle');
  const [hint, setHint] = useState('');
  const [current, setCurrent] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const seq = useRef(0);

  const name = normalizeName(input);

  /** Load the address's existing claim once. */
  useEffect(() => {
    let alive = true;
    void (async () => {
      const addr = getAccount(wagmiConfig).address ?? (await getActiveViemAccount())?.address;
      if (!addr) return;
      const rec = await lookupAddress(addr).catch(() => null);
      if (alive && rec) setCurrent(`${rec.name}.stage.box`);
    })();
    return () => { alive = false; };
  }, []);

  /** Debounced validate + availability check on input. */
  useEffect(() => {
    if (!name) { setStatus('idle'); setHint(''); return; }
    const err = validateName(name);
    if (err) { setStatus('invalid'); setHint(nameErrorMessage(err)); return; }
    setStatus('checking'); setHint('Checking…');
    const id = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const free = await isNameAvailable(name);
        if (id !== seq.current) return;
        setStatus(free ? 'free' : 'taken');
        setHint(free ? `${name}.stage.box is available` : 'Already taken');
      } catch {
        if (id !== seq.current) return;
        setStatus('idle'); setHint("Couldn't reach the gateway");
      }
    }, 350);
    return () => clearTimeout(t);
  }, [name]);

  const claim = useCallback(async (): Promise<boolean> => {
    if (status !== 'free' || claiming) return false;
    setClaiming(true);
    try {
      const local = await getActiveViemAccount();
      const address = local?.address ?? getAccount(wagmiConfig).address;
      if (!address) { setHint('Connect a wallet to claim'); return false; }
      const { message, ts } = buildClaim(name, address);
      const sig = local
        ? await local.signMessage({ message })
        : await signMessage(wagmiConfig, { account: address, message });
      const res = await submitClaim(name, address, sig, ts);
      if (!res.ok) { setHint(res.error); setStatus(res.status === 409 ? 'taken' : 'invalid'); return false; }
      setCurrent(`${res.record.name}.stage.box`);
      setHint(`Claimed ${res.record.name}.stage.box`);
      setInput('');
      return true;
    } catch (e) {
      setHint((e as Error).message || 'Claim failed');
      return false;
    } finally {
      setClaiming(false);
    }
  }, [status, claiming, name]);

  return { input, setInput, name, status, hint, current, claiming, claim };
}
