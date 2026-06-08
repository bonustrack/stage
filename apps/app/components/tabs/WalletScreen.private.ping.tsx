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
 *  This file bundles the whole ping-probe family: the status-log renderer, the
 *  batched/capped log buffer, the action callbacks, and the probe component
 *  itself (previously split across .ping.log / .ping.log.buffer / .ping.actions
 *  purely to satisfy the old 200-line cap). */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { FlatList } from '@metro-labs/kit/flat-list';
import { fontSize } from '@metro-labs/kit/tokens';
import { Pressable } from '@metro-labs/kit/pressable';
import * as Clipboard from 'expo-clipboard';
import { Text } from '@metro-labs/kit/text';
import { Button } from '@metro-labs/kit/button';
import { Col, Row } from '../layout';
import { DANGER, SUCCESS, useEffectiveColorScheme } from '../../lib/theme';
import { flash } from '../../lib/toast';
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

/* ── Status log ─────────────────────────────────────────────────────────── */

/** One timestamped status line: ms elapsed since the run started + the text. */
export interface LogLine { ms: number; line: string }

/** Render a single log line to the plain text used for selection + clipboard. */
function fmtLine(l: LogLine): string { return `+${l.ms}ms  ${l.line}`; }

function tone(line: string, sub: string): string {
  if (line.includes('✗')) return DANGER;
  if (line.includes('✓') || line.startsWith('reply ← pong')) return SUCCESS;
  return sub;
}

/** Copy all log lines to the clipboard as plain text + flash a confirmation. */
function copyAll(lines: LogLine[]): void {
  void Clipboard.setStringAsync(lines.map(fmtLine).join('\n'));
  flash('Logs copied');
}

/** Renders the ordered lifecycle lines the bridge emits as a compact monospace
 *  list so the whole boot→reply sequence fits in one on-device screenshot. */
function PingLog({ lines, sub, head, border }: {
  lines: LogLine[]; sub: string; head?: string; border?: string;
}): React.ReactElement | null {
  if (lines.length === 0) return null;
  return (
    <Col gap={2} mt={4}>
      <Row mt={2} mb={2} style={{ justifyContent: 'flex-end' }}>
        <Pressable
          onPress={() => copyAll(lines)}
          hitSlop={8}
          accessibilityLabel="Copy scan logs"
          style={{
            paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8,
            borderWidth: 1, borderColor: border ?? sub,
          }}
        >
          <Text style={{ color: head ?? sub, fontSize: fontSize('sm'), fontFamily: 'Calibre-Semibold' }}>
            Copy
          </Text>
        </Pressable>
      </Row>
      <FlatList
        data={lines}
        keyExtractor={(l, i) => `${i}-${l.ms}`}
        style={{ maxHeight: 280 }}
        initialNumToRender={20}
        windowSize={5}
        removeClippedSubviews
        renderItem={({ item }) => (
          <Text
            selectable
            style={{
              color: tone(item.line, sub),
              fontSize: fontSize('xs'),
              fontFamily: 'Calibre-Medium',
            }}
          >
            {fmtLine(item)}
          </Text>
        )}
      />
    </Col>
  );
}

/* ── Batched log buffer ─────────────────────────────────────────────────── */

/** The probe streams two HIGH-FREQUENCY sources into the on-screen log: the
 *  bridge lifecycle sink and the engine's live `event:scanDebug` events.
 *  Appending each line straight into React state re-rendered the whole probe AND
 *  grew an unbounded array on EVERY line. This hook lands incoming lines in a
 *  plain ref ring buffer (no render), capped to the last CAP entries, flushed
 *  into state at most once per FLUSH_MS so a burst of N lines costs ONE
 *  re-render. `append` is render-free; `replace` swaps the visible log. */

/** Keep only the most recent lines - older lines scroll off, bounded memory. */
const CAP = 300;
/** Coalesce bursts: flush the buffer to state at most this often (ms). */
const FLUSH_MS = 350;

interface BatchedLog {
  /** The currently-rendered (flushed) lines. */
  lines: LogLine[];
  /** Append a line to the ring buffer (render-free; flushed on the next tick). */
  append: (line: LogLine) => void;
  /** Replace the whole log immediately (e.g. clear to [] at the start of a run). */
  replace: (lines: LogLine[]) => void;
}

function useBatchedLog(): BatchedLog {
  const [lines, setLines] = useState<LogLine[]>([]);
  const buf = useRef<LogLine[]>([]);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (!dirty.current) return;
    dirty.current = false;
    setLines(buf.current.slice());
  }, []);

  // A self-rescheduling timeout coalesces all bursts into at most one render per
  // FLUSH_MS (setTimeout typing is portable across RN/node, unlike setInterval).
  useEffect(() => {
    let live = true;
    const tick = (): void => {
      if (!live) return;
      flush();
      timer.current = setTimeout(tick, FLUSH_MS);
    };
    timer.current = setTimeout(tick, FLUSH_MS);
    return () => {
      live = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [flush]);

  const append = useCallback((line: LogLine) => {
    const next = buf.current;
    next.push(line);
    if (next.length > CAP) next.splice(0, next.length - CAP);
    dirty.current = true;
  }, []);

  const replace = useCallback((next: LogLine[]) => {
    buf.current = next.slice(-CAP);
    dirty.current = false;
    setLines(buf.current.slice());
  }, []);

  return { lines, append, replace };
}

/* ── Action callbacks ───────────────────────────────────────────────────── */

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

interface ProbeActions {
  onPress: () => Promise<void>;
  onInit: () => Promise<void>;
  onScan: () => Promise<void>;
  onMethods: () => Promise<void>;
}

/** Each handler round-trips through the guarded nodejs-mobile bridge and reports
 *  onto the two ProbeState slots (ping/engine) + the on-device log. */
function useProbeActions(deps: ProbeDeps): ProbeActions {
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

/* ── Probe component ────────────────────────────────────────────────────── */

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
      <Text style={{ color: sub, fontSize: fontSize('sm'), fontFamily: 'Calibre-Medium' }}>
        DEV · NODE BRIDGE FEASIBILITY
      </Text>
      <Button
        label="Test Node bridge (ping)"
        variant="secondary"
        dark={dark}
        loading={state.kind === 'running'}
        onPress={() => { void onPress(); }}
      />
      <Text style={{ color: resultColor, fontSize: fontSize('sm'), fontFamily: 'Calibre-Medium' }}>
        {resultText}
      </Text>
      <Button
        label="Init Railgun engine"
        variant="secondary"
        dark={dark}
        loading={engine.kind === 'running'}
        onPress={() => { void onInit(); }}
      />
      <Text style={{ color: engineColor, fontSize: fontSize('sm'), fontFamily: 'Calibre-Medium' }}>
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
