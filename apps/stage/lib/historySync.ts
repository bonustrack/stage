import './cryptoShim';
import { makeListeners, useStoreValue } from './storeCore';
import { bumpAccountEpoch } from './accountEpoch';
import { waitForXmtpReady } from './xmtp.state';
import { processHistoryArchive, requestHistorySync, syncHistoryGroups } from './xmtp.history';
import {
  historyProblemMessage, historySyncIsActive, isMissingArchive, settleBy, within,
  HISTORY_COPY, HistoryProblem, type HistorySyncPhase,
} from './historySync.model';
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

export async function messagingReady(): Promise<void> {
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
let finishEarly: ((outcome: HistorySyncPhase) => void) | null = null;

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
  const early = new Promise<HistorySyncPhase>((resolve) => { finishEarly = resolve; });
  const outcome = await Promise.race([settleBy(syncOnce(run, deadline), deadline, 'timeout'), early]);
  const settled = outcome === 'timeout' && problem !== null ? 'error' : outcome;
  if (run === currentRun) setPhase(settled);
  return settled;
}

export function completeHistorySync(): void {
  const resolve = finishEarly;
  finishEarly = null;
  currentRun += 1;
  setPhase('done');
  resolve?.('done');
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
