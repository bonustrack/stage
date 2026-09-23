import './cryptoShim';
import { makeListeners, useStoreValue } from './storeCore';
import { bumpAccountEpoch } from './accountEpoch';
import { waitForXmtpReady } from './xmtp.state';
import {
  countAvailableHistoryArchives, historySnapshot, processHistoryArchive, requestHistorySync,
  sendHistoryArchive,
} from './xmtp.history';
import { getActiveAccount } from './accounts';
import {
  historyGrewOlder, historyPinFromRandom, historySyncIsActive, holdsHistoryBefore, HISTORY_PIN_LENGTH,
  type HistorySnapshot, type HistorySyncPhase,
} from './historySync.model';
import { report, recover } from './errorPolicy';

const TIMEOUT_MS = 120_000;
const POLL_MS = 5_000;

let phase: HistorySyncPhase = 'idle';
const { notify, subscribe } = makeListeners();

function setPhase(next: HistorySyncPhase): void {
  phase = next;
  notify();
}

function getPhase(): HistorySyncPhase { return phase; }

export function useHistorySyncPhase(): HistorySyncPhase {
  return useStoreValue(subscribe, getPhase);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

function applyReceivedHistory(): void {
  bumpAccountEpoch();
}

async function tryProcessArchive(): Promise<void> {
  try {
    await processHistoryArchive();
  } catch (err) {
    report('historySync.process', err);
  }
}

interface Watch { baseline: HistorySnapshot | null; installedAtMs: number | null; startedAtMs: number }

async function localHistoryChanged(watch: Watch): Promise<boolean> {
  try {
    const current = await historySnapshot();
    if (watch.installedAtMs !== null && holdsHistoryBefore(current, watch.installedAtMs)) return true;
    return watch.baseline !== null && historyGrewOlder(watch.baseline, current, watch.startedAtMs);
  } catch (err) {
    report('historySync.snapshot', err);
    return false;
  }
}

async function archiveListed(): Promise<boolean> {
  try {
    if (await countAvailableHistoryArchives() === 0) return false;
    await tryProcessArchive();
    return true;
  } catch (err) {
    report('historySync.poll', err);
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
  const installedAtMs = (await getActiveAccount().catch(recover('historySync.watch', null)))?.createdAt ?? null;
  const startedAtMs = Date.now();
  try {
    return { baseline: await historySnapshot(), installedAtMs, startedAtMs };
  } catch (err) {
    report('historySync.baseline', err);
    return { baseline: null, installedAtMs, startedAtMs };
  }
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
    report('historySync.request', err);
    setPhase('error');
    return 'error';
  }
}

function whenHistorySettled(): Promise<void> {
  return new Promise((resolve) => {
    const unsubscribe = subscribe(check);
    function check(): void {
      if (historySyncIsActive(phase)) return;
      unsubscribe();
      resolve();
    }
    check();
  });
}

export async function syncHistoryToEnd(): Promise<HistorySyncPhase> {
  const started = await runHistorySync();
  if (!historySyncIsActive(started)) return started;
  await whenHistorySettled();
  return phase;
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
