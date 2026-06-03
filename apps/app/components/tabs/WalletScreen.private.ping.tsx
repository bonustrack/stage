/** Dev/feasibility probe for the embedded nodejs-mobile RAILGUN bridge.
 *
 *  Renders a clearly-labeled "Test Node bridge" button in the private-wallet
 *  view. On press it round-trips a 'ping' through pingBridge() and shows the
 *  result on screen so it can be eyeballed on-device — the KEY check that a
 *  build shipped + booted the Node runtime and the channel works both ways.
 *
 *  The native bridge stays guarded: when isBridgeAvailable() is false (the
 *  nodejs-mobile runtime isn't in this binary) we never call into it, so tsc /
 *  eslint / the bundler stay clean even though the native module isn't
 *  resolvable here. Any throw is caught and surfaced as text. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text } from '@metro-labs/kit/text';
import { Button } from '@metro-labs/kit/button';
import { Col } from '../layout';
import { useEffectiveColorScheme } from '../../lib/theme';
import {
  bridgeListen,
  engineInit,
  getBalances,
  isBridgeAvailable,
  pingBridge,
  sdkListMethods,
  setBridgeStatusListener,
  walletInfo,
} from '../../lib/railgun/bridge';
import { deriveRailgunKeyMaterial } from '../../lib/railgun/deriveKeys';
import { PingLog, type LogLine } from './WalletScreen.private.ping.log';

type ProbeState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'ok'; text: string }
  | { kind: 'err'; text: string };

const UNAVAILABLE = 'bridge unavailable (need the nodejs-mobile build)';

export function BridgePingProbe({ sub, border }: {
  sub: string; border: string;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const [state, setState] = useState<ProbeState>({ kind: 'idle' });
  const [engine, setEngine] = useState<ProbeState>({ kind: 'idle' });
  const [count, setCount] = useState(0);
  const [log, setLog] = useState<LogLine[]>([]);
  const runStart = useRef(0);

  // Mirror the bridge's lifecycle lines into component state so the full
  // boot→reply sequence renders on-device (no adb logcat). Cleared per run.
  useEffect(() => {
    setBridgeStatusListener((line) => {
      const ms = runStart.current ? Date.now() - runStart.current : 0;
      setLog((prev) => [...prev, { ms, line }]);
    });
    return () => setBridgeStatusListener(null);
  }, []);

  // Stream the engine's live scan diagnostics ('event:scanDebug') into the log
  // so a screenshot shows WHY a scan returns 0 (getLogs range, commitment count,
  // RPC error, scanned wallet id). No-op when the bridge isn't in this binary.
  useEffect(() => {
    if (!isBridgeAvailable()) return undefined;
    return bridgeListen('event:scanDebug', (p) => {
      const e = p as { t?: number; chain?: number; msg?: string } | undefined;
      if (!e || !e.msg) return;
      const ms = runStart.current ? Date.now() - runStart.current : 0;
      setLog((prev) => [...prev, { ms, line: `scan[${e.chain ?? '?'}] ${e.msg}` }]);
    });
  }, []);

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
  }, []);

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
  }, [count]);

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
  }, []);

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
  }, []);

  const resultColor = state.kind === 'err' ? '#ff5c5c' : sub;
  const resultText =
    state.kind === 'idle' ? 'not run yet'
      : state.kind === 'running' ? 'pinging…'
        : state.text;
  const engineColor = engine.kind === 'err' ? '#ff5c5c' : sub;
  const engineText =
    engine.kind === 'idle' ? 'not run yet'
      : engine.kind === 'running' ? 'initializing engine…'
        : engine.text;

  return (
    <Col mt={20} pt={16} gap={8} style={{ borderTopWidth: 1, borderTopColor: border }}>
      <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>
        DEV · NODE BRIDGE FEASIBILITY
      </Text>
      <Button
        label="Test Node bridge (ping)"
        variant="secondary"
        dark={dark}
        loading={state.kind === 'running'}
        onPress={() => { void onPress(); }}
      />
      <Text style={{ color: resultColor, fontSize: 13, fontFamily: 'Calibre-Medium' }}>
        {resultText}
      </Text>
      <Button
        label="Init Railgun engine"
        variant="secondary"
        dark={dark}
        loading={engine.kind === 'running'}
        onPress={() => { void onInit(); }}
      />
      <Text style={{ color: engineColor, fontSize: 13, fontFamily: 'Calibre-Medium' }}>
        {engineText}
      </Text>
      <Button
        label="Scan balances + show diagnostics"
        variant="secondary"
        dark={dark}
        loading={engine.kind === 'running'}
        onPress={() => { void onScan(); }}
      />
      <Button
        label="List SDK dispatcher methods"
        variant="secondary"
        dark={dark}
        onPress={() => { void onMethods(); }}
      />
      <PingLog lines={log} sub={sub} />
    </Col>
  );
}
