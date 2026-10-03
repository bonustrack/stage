import './cryptoShim';
import { makeListeners, useStoreValue } from './storeCore';
import { bumpAccountEpoch } from './accountEpoch';
import { waitForXmtpReady } from './xmtp.state';
import { sdk } from './xmtp.sdk';
import { historyServer } from './historyServer';
import { markHistoryImported } from './dmRoutes';
import {
  historyProblemMessage, historySyncIsActive, isMissingArchive, settleBy, within,
  HISTORY_COPY, HistoryProblem, type HistorySyncPhase,
} from './history.model';
import { report } from './errorPolicy';

const TIMEOUT_MS = 120_000;
const POLL_MS = 4_000;
const READY_MS = 30_000;
const REQUEST_MS = 30_000;
const SYNC_GROUPS_MS = 20_000;
const IMPORT_MS = 60_000;

let phase: HistorySyncPhase = 'idle';
let problem: string | null = null;
let deadlineAt: number | null = null;
const { notify, subscribe } = makeListeners();

function setPhase(next: HistorySyncPhase): void {
  phase = next;
  notify();
}

function getPhase(): HistorySyncPhase { return phase; }

export function historySyncDeadline(): number | null {
  return historySyncIsActive(phase) ? deadlineAt : null;
}

export function historySyncProblem(): string | null {
  return phase === 'error' ? problem : null;
}

export function useHistorySyncPhase(): HistorySyncPhase {
  return useStoreValue(subscribe, getPhase);
}

async function requestHistorySync(): Promise<void> {
  const client = await sdk.client();
  await sdk.history.sendSyncRequest(client, await historyServer());
}

async function syncHistoryGroups(): Promise<void> {
  const client = await sdk.client();
  await sdk.history.syncDeviceGroups(client);
}

async function processHistoryArchive(): Promise<void> {
  const client = await sdk.client();
  const startedAt = Date.now();
  await sdk.history.processSyncArchive(client);
  await markHistoryImported(startedAt);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

async function messagingReady(): Promise<void> {
  if (!(await within(waitForXmtpReady(), READY_MS, HISTORY_COPY.notReady))) throw new HistoryProblem(HISTORY_COPY.notReady);
}

async function importArchive(): Promise<boolean> {
  await within(syncHistoryGroups(), SYNC_GROUPS_MS, HISTORY_COPY.syncSlow);
  try {
    await within(processHistoryArchive(), IMPORT_MS, HISTORY_COPY.importSlow);
    return true;
  } catch (err) {
    if (isMissingArchive(err)) return false;
    throw err;
  }
}

let currentRun = 0;

async function waitForArchive(run: number, deadline: number): Promise<HistorySyncPhase> {
  while (Date.now() < deadline && run === currentRun) {
    try {
      if (await importArchive()) return 'done';
    } catch (err) {
      report('historySync.poll', err);
      problem = historyProblemMessage(err, HISTORY_COPY.failed);
    }
    await sleep(POLL_MS);
  }
  return problem === null ? 'timeout' : 'error';
}

async function syncOnce(run: number, deadline: number): Promise<HistorySyncPhase> {
  try {
    await messagingReady();
    await within(requestHistorySync(), REQUEST_MS, HISTORY_COPY.requestSlow);
  } catch (err) {
    report('historySync.request', err);
    problem = historyProblemMessage(err, HISTORY_COPY.failed);
    return 'error';
  }
  if (run === currentRun) setPhase('waiting');
  const outcome = await waitForArchive(run, deadline);
  if (outcome === 'done') bumpAccountEpoch();
  return outcome;
}

export async function runHistorySync(): Promise<HistorySyncPhase> {
  if (historySyncIsActive(phase)) return phase;
  currentRun += 1;
  const run = currentRun;
  const deadline = Date.now() + TIMEOUT_MS;
  deadlineAt = deadline;
  problem = null;
  setPhase('requesting');
  const outcome = await settleBy(syncOnce(run, deadline), deadline, 'timeout');
  const settled = outcome === 'timeout' && problem !== null ? 'error' : outcome;
  if (run === currentRun) setPhase(settled);
  return settled;
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
