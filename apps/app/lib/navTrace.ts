/** ============================================================================
 *  TEMPORARY DEBUG INSTRUMENTATION — nav-restore trace collector.
 *  ----------------------------------------------------------------------------
 *  Why this exists: the channel-restore fix (lib/lastRoute) passes the
 *  kill+reopen repro on an emulator, but on Less's REAL device the restore is
 *  inconsistent and swipe-back never works on first cold load. We can't repro,
 *  so we instrument the live device and have it report ground truth back.
 *
 *  WHAT IT DOES: a tiny in-memory ring of {t, tag, data} entries recorded at
 *  every nav-restore-relevant moment (app mount, (tabs) mount, restore-gate
 *  read/consume, nav-state-ready transitions, the restore push, every
 *  router.push/replace to /xmtp|/group, AppState changes, the cold-start push
 *  response). ~12s after boot, IF a restore was actually attempted this launch,
 *  the whole trace is shipped as a single plain-text XMTP message
 *  ("[nav-trace] ...") from the app's own client to the issue conversation, of
 *  which Less is a member. Compact: route names + booleans only, no message
 *  content, no addresses, convIds truncated.
 *
 *  REMOVE THIS FILE (and its call sites) once the on-device cause is found.
 *  Grep for `navTrace` / `[nav-trace]` to find every touch point.
 *  ========================================================================== */

import { AppState, type AppStateStatus } from 'react-native';

/** Issue conversation the trace is delivered to (Less is a member). */
const TRACE_CONV_ID = '3e1b818acc8c29630078029890f1092f';

/** Fire the one-shot delivery this long after boot — long enough for the
 *  restore push, nav-state settle, and the cold-start push response to have all
 *  happened, short enough that Less is still looking. Debug-only timer. */
const DELIVERY_DELAY_MS = 12_000;

/** Hard cap on buffered entries so a misbehaving call site can't grow memory. */
const MAX_ENTRIES = 200;

interface TraceEntry {
  /** ms since boot (process start of this module). */
  t: number;
  tag: string;
  data?: unknown;
}

const BOOT = Date.now();
const entries: TraceEntry[] = [];

/** Set true the moment a saved-route restore is actually attempted this launch
 *  (the restore push is issued). Delivery is GATED on this so a normal open
 *  (no saved route, deep-link won, etc.) never spams the issue channel. */
let restoreActive = false;

/** One-shot guards. */
let delivered = false;
let armed = false;

/** Append a compact entry. `data` should be route names + booleans only — do
 *  NOT pass message content, addresses, or full convIds. */
export function record(tag: string, data?: unknown): void {
  if (entries.length >= MAX_ENTRIES) entries.shift();
  entries.push({ t: Date.now() - BOOT, tag, data });
}

/** Mark that the saved-route restore path was active this launch. Only then
 *  does the ~12s timer actually deliver — guards against spam on normal opens. */
export function markRestoreActive(): void {
  restoreActive = true;
}

/** Module-level mount counter for the app root. Survives a remount (module
 *  identity is stable for the process), so each fresh mount of the root
 *  component increments it. >1 means the root subtree was torn down + rebuilt —
 *  the disease we are hunting. Exported so the layout can record it. */
let rootMountCount = 0;
export function nextRootMount(): number {
  rootMountCount += 1;
  return rootMountCount;
}

/** Snapshot of the root-render inputs from the previous commit so a remount can
 *  name WHICH dep flipped between mounts (fonts/onboarding/restore/scheme).
 *  Plain primitives only — no objects retained. */
let prevRootDeps: Record<string, unknown> | null = null;
/** Diff the current root-render deps against the previous commit and record the
 *  changed keys. Call on every root render; on a remount the `mount` count plus
 *  the changed-deps list pinpoints the trigger. */
export function recordRootDeps(deps: Record<string, unknown>): void {
  const changed: Record<string, unknown> = {};
  if (prevRootDeps) {
    for (const k of Object.keys(deps)) {
      if (prevRootDeps[k] !== deps[k]) changed[k] = deps[k];
    }
  }
  prevRootDeps = deps;
  if (Object.keys(changed).length > 0) record('root.deps.changed', changed);
}

/** Truncate a convId/route for compactness + privacy (keep enough to correlate
 *  but not the full id). Safe on undefined. */
export function shortId(id?: string | null): string | undefined {
  if (!id) return undefined;
  return id.length <= 10 ? id : `${id.slice(0, 6)}…${id.slice(-4)}`;
}

/** Runtime/build identity so we KNOW which build Less actually ran (catches the
 *  "stale groups / stale JS" possibility). expo-updates is imported lazily so a
 *  missing/old runtime can't crash the trace. */
async function runtimeInfo(): Promise<Record<string, unknown>> {
  try {
    const Updates = await import('expo-updates');
    return {
      updateId: Updates.updateId ?? null,
      channel: Updates.channel ?? null,
      runtimeVersion: Updates.runtimeVersion ?? null,
      isEmbedded: Updates.isEmbeddedLaunch ?? null,
      createdAt: Updates.createdAt ? Updates.createdAt.toISOString() : null,
    };
  } catch {
    return { updateInfo: 'unavailable' };
  }
}

/** Compose the message body: a header line with runtime info + boot timestamp,
 *  then one compact JSON line per entry. Kept under a few KB. */
async function composeBody(): Promise<string> {
  const rt = await runtimeInfo();
  const header = {
    boot: new Date(BOOT).toISOString(),
    elapsedMs: Date.now() - BOOT,
    restoreActive,
    rt,
  };
  const lines = entries.map((e) => JSON.stringify(e));
  return `[nav-trace] ${JSON.stringify(header)}\n${lines.join('\n')}`;
}

/** Send the trace as a plain-text XMTP message from the app's own client to the
 *  issue conversation. Lazy imports keep navTrace free of XMTP module-load
 *  cycles and let it be imported from anywhere (incl. the root layout). */
async function deliver(): Promise<void> {
  if (delivered) return;
  delivered = true;
  try {
    const body = await composeBody();
    const [{ xmtpSendText }, { lineOfConv }] = await Promise.all([
      import('./xmtp.messages'),
      import('./xmtp.types'),
    ]);
    await xmtpSendText(lineOfConv(TRACE_CONV_ID), body);
    record('trace.delivered', { ok: true });
  } catch (err) {
    record('trace.deliver.failed', { err: String(err).slice(0, 120) });
  }
}

/** Arm the one-shot delivery timer. Call once at boot (root layout). Fires
 *  ~12s later and delivers ONLY if a saved-route restore was active this
 *  launch. Idempotent — re-calls are no-ops. */
export function armTraceDelivery(): void {
  if (armed) return;
  armed = true;
  record('trace.armed', { delayMs: DELIVERY_DELAY_MS });
  setTimeout(() => {
    if (!restoreActive) {
      record('trace.skipped', { reason: 'no-restore' });
      return;
    }
    void deliver();
  }, DELIVERY_DELAY_MS);

  // AppState transitions are part of the trace (a background/foreground during
  // the window can explain a late push flush / re-fire).
  const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
    record('appstate', { state: s });
  });
  // Best-effort cleanup if the module is ever torn down (it isn't, normally).
  void sub;
}
