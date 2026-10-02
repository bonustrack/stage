import './cryptoShim';
import { makeListeners, useStoreValue } from './storeCore';
import { bumpAccountEpoch } from './accountEpoch';
import { waitForXmtpReady } from './xmtp.state';
import { sdk } from './xmtp.sdk';
import { historyServer } from './historyServer';
import { markHistoryImported } from './dmRoutes';
import {
  TRANSFER_CODE_RANDOM_BYTES, chunkedPbkdf2, deriveTransferSecrets, normalizeTransferCode, transferCodeFromRandom,
  webCryptoPbkdf2, type Pbkdf2,
  unwrapTransferArchive, wrapTransferArchive,
} from '@stage-labs/client/xmtp/historyTransfer';
import {
  historyProblemMessage, historySyncIsActive, isMissingArchive, settleBy, within,
  HISTORY_COPY, HistoryProblem, type HistorySyncPhase,
  MAX_TRANSFER_BYTES, TRANSFER_COPY, downloadProblem, importProblem, transferExpiry, transferProblemMessage,
  uploadProblem, type TransferStep,
} from './history.model';
import { report, reported } from './errorPolicy';

const TIMEOUT_MS = 120_000;
const POLL_MS = 4_000;
const READY_MS = 30_000;
const REQUEST_MS = 30_000;
const SYNC_GROUPS_MS = 20_000;
const IMPORT_MS = 60_000;
const TRANSFER_ARCHIVE_MS = 120_000;
const UPLOAD_MS = 120_000;
const DOWNLOAD_MS = 120_000;
const TRANSFER_IMPORT_MS = 120_000;

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

async function createHistoryArchive(key: Uint8Array): Promise<Uint8Array> {
  const client = await sdk.client();
  return sdk.history.createArchive(client, key);
}

async function importHistoryArchive(archive: Uint8Array, key: Uint8Array): Promise<void> {
  const client = await sdk.client();
  await markHistoryImported(Date.now());
  await sdk.history.importArchive(client, archive, key);
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

function completeHistorySync(): void {
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

let step: TransferStep = { kind: 'idle' };
const stepListeners = makeListeners();

function setStep(next: TransferStep): void {
  step = next;
  stepListeners.notify();
}

function currentStep(): TransferStep { return step; }

export function useTransferStep(): TransferStep {
  return useStoreValue(stepListeners.subscribe, currentStep);
}

function transferKdf(onShare: (share: number) => void): Pbkdf2 {
  const subtle = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
  return subtle === undefined ? chunkedPbkdf2(() => sleep(0), onShare) : webCryptoPbkdf2(subtle);
}

export interface SentTransfer {
  code: string;
  expiresAt: number;
}

function randomCode(): string {
  const bytes = new Uint8Array(TRANSFER_CODE_RANDOM_BYTES);
  globalThis.crypto.getRandomValues(bytes);
  return transferCodeFromRandom(bytes);
}

async function transferUrl(id: string): Promise<string> {
  return `${await historyServer()}/transfer/${id}`;
}

async function uploadTransfer(url: string, body: Uint8Array): Promise<number> {
  if (body.byteLength > MAX_TRANSFER_BYTES) throw new HistoryProblem(TRANSFER_COPY.tooLarge);
  const init: RequestInit = { method: 'PUT', body: new Uint8Array(body), headers: { 'content-type': 'application/octet-stream' } };
  const res = await within(fetch(url, init), UPLOAD_MS, TRANSFER_COPY.uploadSlow);
  if (!res.ok) throw new HistoryProblem(uploadProblem(res.status));
  return transferExpiry(await res.json().catch(reported('historyTransfer.expiry')), Date.now());
}

export async function sendHistoryWithCode(): Promise<SentTransfer> {
  try {
    await sleep(0);
    await messagingReady();
    const code = randomCode();
    setStep({ kind: 'locking', share: 0 });
    const { id, key } = await deriveTransferSecrets(code, transferKdf((share) => { setStep({ kind: 'locking', share }); }));
    setStep({ kind: 'packing' });
    const archive = await within(createHistoryArchive(key), TRANSFER_ARCHIVE_MS, TRANSFER_COPY.prepareSlow);
    setStep({ kind: 'uploading' });
    const expiresAt = await uploadTransfer(await transferUrl(id), wrapTransferArchive(archive));
    return { code, expiresAt };
  } catch (err) {
    report('historyTransfer.send', err);
    throw new Error(transferProblemMessage(err, TRANSFER_COPY.sendFailed, TRANSFER_COPY.uploadFailed));
  } finally {
    setStep({ kind: 'idle' });
  }
}

async function downloadTransfer(url: string): Promise<Uint8Array> {
  const res = await within(fetch(url), DOWNLOAD_MS, TRANSFER_COPY.downloadSlow);
  if (!res.ok) throw new HistoryProblem(downloadProblem(res.status));
  const unwrapped = unwrapTransferArchive(new Uint8Array(await res.arrayBuffer()));
  if (!unwrapped.ok) throw new HistoryProblem(TRANSFER_COPY.incompatible);
  return unwrapped.archive;
}

async function importTransfer(archive: Uint8Array, key: Uint8Array): Promise<void> {
  try {
    await within(importHistoryArchive(archive, key), TRANSFER_IMPORT_MS, TRANSFER_COPY.importSlow);
  } catch (err) {
    report('historyTransfer.import', err);
    throw new HistoryProblem(importProblem(err));
  }
}

function forgetTransfer(url: string): void {
  void fetch(url, { method: 'DELETE' }).catch(reported('historyTransfer.delete'));
}

export async function receiveHistoryWithCode(input: string): Promise<void> {
  const code = normalizeTransferCode(input);
  if (code === null) throw new Error(TRANSFER_COPY.invalidCode);
  try {
    await sleep(0);
    await messagingReady();
    setStep({ kind: 'unlocking', share: 0 });
    const { id, key } = await deriveTransferSecrets(code, transferKdf((share) => { setStep({ kind: 'unlocking', share }); }));
    const url = await transferUrl(id);
    setStep({ kind: 'downloading' });
    const archive = await downloadTransfer(url);
    setStep({ kind: 'importing' });
    await importTransfer(archive, key);
    forgetTransfer(url);
  } catch (err) {
    report('historyTransfer.receive', err);
    throw new Error(transferProblemMessage(err, TRANSFER_COPY.importFailed, TRANSFER_COPY.downloadFailed));
  } finally {
    setStep({ kind: 'idle' });
  }
  completeHistorySync();
  bumpAccountEpoch();
}
