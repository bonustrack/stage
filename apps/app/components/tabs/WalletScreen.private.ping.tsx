/** Dev/feasibility probe for the embedded nodejs-mobile RAILGUN bridge.
 *
 *  Renders a clearly-labeled "Test Node bridge" button in the private-wallet
 *  view. On press it round-trips a 'ping' through pingBridge() and shows the
 *  result on screen so it can be eyeballed on-device - the KEY check that a
 *  build shipped + booted the Node runtime and the channel works both ways.
 *
 *  The native bridge stays guarded: when isBridgeAvailable() is false (the
 *  nodejs-mobile runtime isn't in this binary) we never call into it, so tsc /
 *  eslint / the bundler stay clean even though the native module isn't
 *  resolvable here. Any throw is caught and surfaced as text.
 *
 *  The action callbacks live in ./WalletScreen.private.ping.actions (extracted
 *  to keep this file under the 200-line cap). */
import { useEffect, useRef, useState } from 'react';
import { Text } from '@metro-labs/kit/text';
import { Button } from '@metro-labs/kit/button';
import { Col } from '../layout';
import { DANGER, useEffectiveColorScheme } from '../../lib/theme';
import { bridgeListen, isBridgeAvailable, setBridgeStatusListener } from '../../lib/railgun/bridge';
import { PingLog, type LogLine } from './WalletScreen.private.ping.log';
import { useProbeActions, type ProbeState } from './WalletScreen.private.ping.actions';
import { useBatchedLog } from './WalletScreen.private.ping.log.buffer';

export function BridgePingProbe({ sub, border }: {
  sub: string; border: string;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const [state, setState] = useState<ProbeState>({ kind: 'idle' });
  const [engine, setEngine] = useState<ProbeState>({ kind: 'idle' });
  const [count, setCount] = useState(0);
  // Batched + capped log: render-free appends coalesced into one render per tick,
  // bounded to the last N lines. `replace` clears the log at the start of a run.
  const { lines: log, append, replace } = useBatchedLog();
  const runStart = useRef(0);

  // The action callbacks only ever set the log to [] or a single line (clear /
  // seed), so `replace` is the right SetState shape for them.
  const setLog = replace as React.Dispatch<React.SetStateAction<LogLine[]>>;

  const { onPress, onInit, onScan, onMethods } = useProbeActions({
    count, setCount, setState, setEngine, setLog, runStart,
  });

  // Mirror the bridge's lifecycle lines into the batched buffer so the full
  // boot→reply sequence renders on-device (no adb logcat). Cleared per run.
  useEffect(() => {
    setBridgeStatusListener((line) => {
      const ms = runStart.current ? Date.now() - runStart.current : 0;
      append({ ms, line });
    });
    return () => setBridgeStatusListener(null);
  }, [append]);

  // Stream the engine's live scan diagnostics ('event:scanDebug') into the
  // buffer so a screenshot shows WHY a scan returns 0 (getLogs range, commitment
  // count, RPC error, scanned wallet id). No-op when the bridge isn't present.
  useEffect(() => {
    if (!isBridgeAvailable()) return undefined;
    return bridgeListen('event:scanDebug', (p) => {
      const e = p as { t?: number; chain?: number; msg?: string } | undefined;
      if (!e || !e.msg) return;
      const ms = runStart.current ? Date.now() - runStart.current : 0;
      append({ ms, line: `scan[${e.chain ?? '?'}] ${e.msg}` });
    });
  }, [append]);

  const resultColor = state.kind === 'err' ? DANGER : sub;
  const resultText =
    state.kind === 'idle' ? 'not run yet'
      : state.kind === 'running' ? 'pinging…'
        : state.text;
  const engineColor = engine.kind === 'err' ? DANGER : sub;
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
      <PingLog lines={log} sub={sub} border={border} />
    </Col>
  );
}
