import './cryptoShim';
import { appStorage } from '../platform/storage';
import { makeListeners, useStoreValue } from './storeCore';
import { bumpAccountEpoch } from './accountEpoch';
import { waitForXmtpReady } from './xmtp.state';
import {
  countAvailableHistoryArchives, historySnapshot, processHistoryArchive, requestHistorySync,
  sendHistoryArchive,
} from './xmtp.history';
import { getActiveAccount } from './accounts';
import {
  historyPinFromRandom, historySyncIsActive, holdsHistoryBefore, HISTORY_PIN_LENGTH,
  type HistorySnapshot, type HistorySyncPhase,
} from './historySync.model';

const PENDING_KEY = 'history.sync.pending';
const TIMEOUT_MS = 120_000;
const POLL_MS = 5_000;

let phase: HistorySyncPhase = 'idle';
const { listeners, notify } = makeListeners();

function setPhase(next: HistorySyncPhase): void {
  phase = next;
  notify();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function getPhase(): HistorySyncPhase { return phase; }

export function useHistorySyncPhase(): HistorySyncPhase {
  return useStoreValue(subscribe, getPhase);
}

export function dismissHistorySync(): void {
  if (!historySyncIsActive(phase)) setPhase('idle');
}

export async function markHistorySyncPending(accountId: string): Promise<void> {
  await appStorage.set(PENDING_KEY, accountId).catch(() => undefined);
}

export async function takePendingHistorySync(accountId: string): Promise<boolean> {
  const pending = await appStorage.get(PENDING_KEY).catch(() => null);
  if (pending !== accountId) return false;
  await appStorage.delete(PENDING_KEY).catch(() => undefined);
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

function applyReceivedHistory(): void {
  bumpAccountEpoch();
}

function warn(step: string, err: unknown): void {
  if (process.env.NODE_ENV !== 'production') console.warn(`history sync ${step} failed`, err instanceof Error ? err.message : err);
}

async function tryProcessArchive(): Promise<void> {
  try {
    await processHistoryArchive();
  } catch (err) {
    warn('process', err);
  }
}

interface Watch { baseline: HistorySnapshot | null; installedAtMs: number | null }

async function localHistoryChanged(watch: Watch): Promise<boolean> {
  try {
    const current = await historySnapshot();
    if (watch.installedAtMs !== null && holdsHistoryBefore(current, watch.installedAtMs)) return true;
    return watch.baseline !== null && current.fingerprint !== watch.baseline.fingerprint;
  } catch (err) {
    warn('snapshot', err);
    return false;
  }
}

async function archiveListed(): Promise<boolean> {
  try {
    if (await countAvailableHistoryArchives() === 0) return false;
    await tryProcessArchive();
    return true;
  } catch (err) {
    warn('poll', err);
    return false;
  }
}

async function archiveArrived(watch: Watch): Promise<boolean> {
  if (await localHistoryChanged(watch)) return true;
  return archiveListed();
}

async function waitForHistory(deadline: number, watch: Watch): Promise<boolean> {
  while (Date.now() < deadline) {
    if (await archiveArrived(watch)) return true;
    await sleep(POLL_MS);
  }
  return false;
}

async function startWatch(): Promise<Watch> {
  const installedAtMs = (await getActiveAccount().catch(() => null))?.createdAt ?? null;
  try {
    return { baseline: await historySnapshot(), installedAtMs };
  } catch (err) {
    warn('baseline', err);
    return { baseline: null, installedAtMs };
  }
}

export const ONBOARDING_HISTORY_WAIT_MS = 20_000;

export function waitForHistorySyncSettled(maxMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (!historySyncIsActive(phase)) { resolve(); return; }
    const timer = setTimeout(finish, maxMs);
    const unsubscribe = subscribe(() => { if (!historySyncIsActive(phase)) finish(); });
    function finish(): void {
      clearTimeout(timer);
      unsubscribe();
      resolve();
    }
  });
}

export async function runHistorySync(): Promise<HistorySyncPhase> {
  if (historySyncIsActive(phase)) return phase;
  setPhase('requesting');
  try {
    if (!(await waitForXmtpReady())) { setPhase('error'); return 'error'; }
    const watch = await startWatch();
    await requestHistorySync();
    setPhase('waiting');
    if (!(await waitForHistory(Date.now() + TIMEOUT_MS, watch))) { setPhase('timeout'); return 'timeout'; }
    applyReceivedHistory();
    setPhase('done');
    return 'done';
  } catch (err) {
    warn('request', err);
    setPhase('error');
    return 'error';
  }
}

export async function receiveHistoryWithPin(pin: string): Promise<void> {
  if (!(await waitForXmtpReady())) throw new Error('Messaging is not ready yet. Try again in a moment.');
  await countAvailableHistoryArchives();
  await processHistoryArchive(pin);
  applyReceivedHistory();
}

export async function shareHistory(pin: string): Promise<void> {
  if (!(await waitForXmtpReady())) throw new Error('Messaging is not ready yet. Try again in a moment.');
  await sendHistoryArchive(pin);
}

export function generateHistoryPin(): string {
  const bytes = new Uint8Array(HISTORY_PIN_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  return historyPinFromRandom(bytes);
}
