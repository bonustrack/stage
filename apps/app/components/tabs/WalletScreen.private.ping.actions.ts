/** Action callbacks for the dev Node-bridge ping probe (BridgePingProbe).
 *
 *  Extracted from WalletScreen.private.ping.tsx purely to keep that file under
 *  the 200-line cap — no behavior change. Each handler round-trips through the
 *  guarded nodejs-mobile bridge and reports onto the two ProbeState slots
 *  (ping/engine) + the on-device log. */
import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  engineInit,
  getBalances,
  isBridgeAvailable,
  pingBridge,
  sdkListMethods,
  walletInfo,
} from '@metro-labs/railgun-mobile';
import { deriveRailgunKeyMaterial } from '../../lib/railgun/deriveKeys';
import type { LogLine } from './WalletScreen.private.ping.log';

export type ProbeState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'ok'; text: string }
  | { kind: 'err'; text: string };

const UNAVAILABLE = 'bridge unavailable (need the nodejs-mobile build)';

interface ProbeDeps {
  count: number;
  setCount: Dispatch<SetStateAction<number>>;
  setState: Dispatch<SetStateAction<ProbeState>>;
  setEngine: Dispatch<SetStateAction<ProbeState>>;
  setLog: Dispatch<SetStateAction<LogLine[]>>;
  runStart: MutableRefObject<number>;
}

export interface ProbeActions {
  onPress: () => Promise<void>;
  onInit: () => Promise<void>;
  onScan: () => Promise<void>;
  onMethods: () => Promise<void>;
}

export function useProbeActions(deps: ProbeDeps): ProbeActions {
  const { count, setCount, setState, setEngine, setLog, runStart } = deps;

  const onScan = useCallback(async (): Promise<void> => {
    runStart.current = Date.now();
    setLog([]);
    if (!isBridgeAvailable()) {
      setEngine({ kind: 'err', text: UNAVAILABLE });
      return;
    }
    setEngine({ kind: 'running' });
    try {
      await engineInit();
      const key = await deriveRailgunKeyMaterial();
      const info = await walletInfo({
        encryptionKey: key.encryptionKey,
        mnemonic: key.mnemonic,
        creationBlocks: key.creationBlocks,
      });
      const res = await getBalances(info.railgunWalletID);
      const m = res.networks.mainnet.length;
      const s = res.networks.sepolia.length;
      setEngine({
        kind: 'ok',
        text: `wallet ${info.railgunAddress.slice(0, 12)}… mainnet=${m} rows sepolia=${s} rows scanning=${res.scanning} — watch scan[] lines below`,
      });
    } catch (e) {
      setEngine({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
    }
  }, [setEngine, setLog, runStart]);

  const onPress = useCallback(async (): Promise<void> => {
    runStart.current = Date.now();
    setLog([]);
    if (!isBridgeAvailable()) {
      setState({ kind: 'err', text: UNAVAILABLE });
      setLog([{ ms: 0, line: 'native module not present ✗' }]);
      return;
    }
    const at = count + 1;
    setCount(at);
    setState({ kind: 'running' });
    const t0 = Date.now();
    try {
      const res = await pingBridge({ at });
      const ms = Date.now() - t0;
      setState({ kind: 'ok', text: `pong: ${JSON.stringify(res)} (${ms}ms)` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState({ kind: 'err', text: msg });
    }
  }, [count, setCount, setState, setLog, runStart]);

  const onInit = useCallback(async (): Promise<void> => {
    runStart.current = Date.now();
    setLog([]);
    if (!isBridgeAvailable()) {
      setEngine({ kind: 'err', text: UNAVAILABLE });
      setLog([{ ms: 0, line: 'native module not present ✗' }]);
      return;
    }
    setEngine({ kind: 'running' });
    const t0 = Date.now();
    try {
      const res = await engineInit();
      const ms = Date.now() - t0;
      setEngine({ kind: 'ok', text: `engine: ${JSON.stringify(res)} (${ms}ms)` });
    } catch (e) {
      setEngine({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
    }
  }, [setEngine, setLog, runStart]);

  const onMethods = useCallback(async (): Promise<void> => {
    runStart.current = Date.now();
    setLog([]);
    if (!isBridgeAvailable()) {
      setEngine({ kind: 'err', text: UNAVAILABLE });
      return;
    }
    setEngine({ kind: 'running' });
    try {
      const methods = await sdkListMethods();
      setEngine({ kind: 'ok', text: `${methods.length} SDK methods: ${methods.join(', ')}` });
    } catch (e) {
      setEngine({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
    }
  }, [setEngine, setLog, runStart]);

  return { onPress, onInit, onScan, onMethods };
}
