import './cryptoShim';
import { appStorage } from '../platform/storage';
import { makeListeners, useStoreValue } from './storeCore';
import { bumpAccountEpoch } from './accountEpoch';
import { waitForXmtpReady } from './xmtp.state';
import {
  countAvailableHistoryArchives, historyFingerprint, processHistoryArchive, requestHistorySync,
  sendHistoryArchive,
} from './xmtp.history';
import { historyPinFromRandom, historySyncIsActive, HISTORY_PIN_LENGTH, type HistorySyncPhase } from './historySync.model';

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

async function archiveArrived(baseline: string | null): Promise<boolean> {
  try {
    if (await countAvailableHistoryArchives() > 0) {
      await tryProcessArchive();
      return true;
    }
    return baseline !== null && await historyFingerprint() !== baseline;
  } catch (err) {
    warn('poll', err);
    return false;
  }
}

async function waitForHistory(deadline: number, baseline: string | null): Promise<boolean> {
  while (Date.now() < deadline) {
    if (await archiveArrived(baseline)) return true;
    await sleep(POLL_MS);
  }
  return false;
}

async function localHistoryBaseline(): Promise<string | null> {
  try {
    return await historyFingerprint();
  } catch (err) {
    warn('baseline', err);
    return null;
  }
}

export async function runHistorySync(): Promise<HistorySyncPhase> {
  if (historySyncIsActive(phase)) return phase;
  setPhase('requesting');
  try {
    if (!(await waitForXmtpReady())) { setPhase('error'); return 'error'; }
    const baseline = await localHistoryBaseline();
    await requestHistorySync();
    setPhase('waiting');
    if (!(await waitForHistory(Date.now() + TIMEOUT_MS, baseline))) { setPhase('timeout'); return 'timeout'; }
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
