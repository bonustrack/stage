import './cryptoShim';
import {
  TRANSFER_CODE_RANDOM_BYTES, chunkedPbkdf2, deriveTransferSecrets, normalizeTransferCode, transferCodeFromRandom,
  webCryptoPbkdf2, type Pbkdf2,
  unwrapTransferArchive, wrapTransferArchive,
} from '@stage-labs/client/xmtp/historyTransfer';
import { bumpAccountEpoch } from './accountEpoch';
import { historyServer } from './historyServer';
import { completeHistorySync, messagingReady } from './historySync';
import { HistoryProblem, within } from './historySync.model';
import {
  MAX_TRANSFER_BYTES, TRANSFER_COPY, downloadProblem, importProblem, transferExpiry, transferProblemMessage,
  uploadProblem, type TransferStep,
} from './historyTransfer.model';
import { makeListeners, useStoreValue } from './storeCore';
import { createHistoryArchive, importHistoryArchive } from './xmtp.history';
import { report, reported } from './errorPolicy';

const ARCHIVE_MS = 120_000;
const UPLOAD_MS = 120_000;
const DOWNLOAD_MS = 120_000;
const IMPORT_MS = 120_000;

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

function nextFrame(): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, 0); });
}

function transferKdf(onShare: (share: number) => void): Pbkdf2 {
  const subtle = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
  return subtle === undefined ? chunkedPbkdf2(nextFrame, onShare) : webCryptoPbkdf2(subtle);
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
    await nextFrame();
    await messagingReady();
    const code = randomCode();
    setStep({ kind: 'locking', share: 0 });
    const { id, key } = await deriveTransferSecrets(code, transferKdf((share) => { setStep({ kind: 'locking', share }); }));
    setStep({ kind: 'packing' });
    const archive = await within(createHistoryArchive(key), ARCHIVE_MS, TRANSFER_COPY.prepareSlow);
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
    await within(importHistoryArchive(archive, key), IMPORT_MS, TRANSFER_COPY.importSlow);
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
    await nextFrame();
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
