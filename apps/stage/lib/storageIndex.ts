import { useEffect } from 'react';
import { isDeletedPlaceholderType } from '@stage-labs/client/xmtp/deleteMessage';
import { attachedFilesOf, type AttachedFile } from '@stage-labs/client/xmtp/contentTypes';
import type { StreamedMessage } from '@stage-labs/client/xmtp/summarizeRow';
import { sdk } from './xmtp.sdk';
import { accountClient, type AccountClient } from './xmtp.account';
import { AccountChangedError, NoAccountError } from './accountSelection';
import { isSyncConv } from './sync/group';
import { subscribeAllMessages } from './xmtp.stream';
import type { StreamMsg, XmtpConsent } from './xmtp.types';
import { currentAccountId } from './accounts';
import { getAccountEpoch, useAccountEpoch } from './accountEpoch';
import { makeListeners, useStoreValue } from './storeCore';
import { report, reported } from './errorPolicy';
import { onStorageIndexForgotten, readStorageIndex, writeStorageIndex } from './storageIndexStore';
import { convMembers } from './xmtp.identity';
import { deleteRightsOf } from './messaging/deleteRights';
import {
  NO_DELETE_RIGHTS,
  applyFindings,
  emptyIndex,
  findingsOf,
  finishScan,
  nextCursorNs,
  settleFindings,
  type StorageIndex,
  type StoredFile,
} from './storageIndex.model';
import { ScanStopped, scanConversations, type ScanSink, type ScanSource } from './storageScan.model';

type Conv = Awaited<ReturnType<typeof sdk.listConvs>>[number];

export interface StorageState {
  accountId: string | null;
  files: readonly StoredFile[];
  loaded: boolean;
  scanning: boolean;
  firstScan: boolean;
  done: number;
  total: number;
  failed: boolean;
}

const ALL_CONSENT: XmtpConsent[] = ['allowed', 'unknown', 'denied'];
const PUBLISH_MS = 250;

const INITIAL: StorageState = {
  accountId: null,
  files: [],
  loaded: false,
  scanning: false,
  firstScan: false,
  done: 0,
  total: 0,
  failed: false,
};

let state = INITIAL;
let held: { accountId: string; index: StorageIndex } | null = null;
let publishTimer: ReturnType<typeof setTimeout> | null = null;
let scanRun: { epoch: number } | null = null;
let scanAgain = false;
const listeners = makeListeners();

function setState(patch: Partial<StorageState>): void {
  state = { ...state, ...patch };
  listeners.notify();
}

function getState(): StorageState {
  return state;
}

function publishNow(): void {
  if (publishTimer !== null) clearTimeout(publishTimer);
  publishTimer = null;
  if (held !== null && held.accountId === state.accountId) setState({ files: held.index.files });
}

function publishSoon(): void {
  publishTimer ??= setTimeout(publishNow, PUBLISH_MS);
}

function currentIndex(accountId: string): StorageIndex {
  if (held?.accountId !== accountId) throw new ScanStopped();
  return held.index;
}

function commit(accountId: string, index: StorageIndex): void {
  if (held?.accountId === accountId && held.index === index) return;
  held = { accountId, index };
  writeStorageIndex(accountId, index);
  publishSoon();
}

onStorageIndexForgotten((accountId) => {
  if (held?.accountId !== accountId) return;
  held = null;
  if (state.accountId === accountId) setState(INITIAL);
});

async function heldIndex(accountId: string): Promise<StorageIndex | null> {
  if (held?.accountId === accountId) return held.index;
  const stored = await readStorageIndex(accountId);
  if (held?.accountId === accountId) return held.index;
  if (stored !== null) held = { accountId, index: stored };
  return stored;
}

async function showCached(): Promise<void> {
  const accountId = await currentAccountId();
  if (accountId === null) return;
  const index = await heldIndex(accountId);
  if (state.accountId === accountId && state.loaded) return;
  setState({ ...INITIAL, accountId, files: index?.files ?? [], loaded: index !== null });
}

function sourceFor(context: AccountClient, live: () => boolean): ScanSource<Conv> {
  return {
    idOf: (conv) => conv.id,
    page: async (conv, query) => (await sdk.messages(conv, query)).map((m) => ({ ...sdk.rowOf(m), convId: conv.id })),
    skip: async (conv) => sdk.isGroup(conv) && (await isSyncConv(conv)),
    deleteRights: async (conv) => {
      const admins = sdk.isGroup(conv)
        ? { convId: conv.id, inboxToAddr: (await convMembers(conv)).inboxToAddr, where: 'storage.superAdmins' }
        : null;
      return deleteRightsOf(admins, sdk.inboxIdOf(context.client));
    },
    current: () => live() && context.current(),
    failed: reported('storage.scanChat'),
  };
}

function sinkFor(accountId: string): ScanSink {
  return {
    index: () => currentIndex(accountId),
    apply: (findings) => {
      commit(accountId, applyFindings(currentIndex(accountId), findings));
    },
    progress: (done, total) => {
      state = { ...state, done, total };
      publishSoon();
    },
  };
}

function stopUnless(live: () => boolean): void {
  if (!live()) throw new ScanStopped();
}

async function startIndex(context: AccountClient): Promise<StorageIndex> {
  const accountId = context.account.id;
  const inboxId = sdk.inboxIdOf(context.client);
  const stored = await heldIndex(accountId);
  context.assertCurrent();
  const start = stored !== null && stored.inboxId === inboxId ? stored : emptyIndex(inboxId);
  commit(accountId, start);
  return start;
}

async function runScan(live: () => boolean): Promise<void> {
  const context = await accountClient();
  stopUnless(live);
  const accountId = context.account.id;
  const start = await startIndex(context);
  stopUnless(live);
  setState({ ...INITIAL, accountId, files: start.files, loaded: true, scanning: true, firstScan: start.cursorNs === 0 });
  const startedMs = Date.now();
  const convs = await sdk.listConvs(context.client, ALL_CONSENT);
  stopUnless(live);
  context.assertCurrent();
  setState({ total: convs.length });
  const failed = await scanConversations(convs, start, sourceFor(context, live), sinkFor(accountId));
  stopUnless(live);
  commit(accountId, finishScan(currentIndex(accountId), nextCursorNs(startedMs), failed));
  publishNow();
  setState({ scanning: false, firstScan: false, done: convs.length, failed: failed.size > 0 });
}

function scanEnded(err: unknown): void {
  const stopped = err instanceof ScanStopped || err instanceof AccountChangedError || err instanceof NoAccountError;
  if (!stopped) report('storage.scan', err);
  setState({ scanning: false, firstScan: false, failed: !stopped, loaded: state.loaded || !stopped });
}

export function retryStorage(): void {
  const epoch = getAccountEpoch();
  if (scanRun !== null && scanRun.epoch === epoch) {
    scanAgain = true;
    return;
  }
  scanAgain = false;
  const run = { epoch };
  scanRun = run;
  const live = (): boolean => scanRun === run && getAccountEpoch() === epoch;
  void runScan(live)
    .catch((err: unknown) => {
      if (live()) scanEnded(err);
    })
    .finally(() => {
      if (scanRun !== run) return;
      scanRun = null;
      if (!scanAgain) return;
      scanAgain = false;
      retryStorage();
    });
}

function onStreamMessage({ convId, msg }: StreamMsg): void {
  if (held === null || convId === null) return;
  const { accountId, index } = held;
  const findings = settleFindings(index, findingsOf([{ ...msg, convId }], index.inboxId), NO_DELETE_RIGHTS);
  if (findings.files.length > 0 || findings.deletedIds.length > 0) commit(accountId, applyFindings(index, findings));
}

function openStorage(): () => void {
  let open = true;
  void showCached()
    .then(() => {
      if (open) retryStorage();
    })
    .catch(reported('storage.open'));
  const stop = subscribeAllMessages(onStreamMessage, { includeHidden: true });
  return () => {
    open = false;
    stop();
  };
}

export function useStorage(): StorageState {
  const epoch = useAccountEpoch();
  useEffect(openStorage, [epoch]);
  return useStoreValue(listeners.subscribe, getState);
}

export class FileUnavailableError extends Error {
  constructor() {
    super('This file is no longer available.');
  }
}

async function storedRow(messageId: string): Promise<StreamedMessage | null> {
  const message = await sdk.messageById(await sdk.client(), messageId);
  return message ? sdk.rowOf(message) : null;
}

export async function storageFileGone(messageId: string): Promise<boolean> {
  const row = await storedRow(messageId);
  return row === null || isDeletedPlaceholderType(row.contentTypeId);
}

export async function storedFilePart(file: StoredFile): Promise<AttachedFile> {
  const row = await storedRow(file.messageId);
  if (row === null || isDeletedPlaceholderType(row.contentTypeId)) throw new FileUnavailableError();
  const part = attachedFilesOf(row.contentTypeId, row.content)[file.index];
  if (part === undefined || (part.remote === undefined && part.dataB64 === undefined)) throw new FileUnavailableError();
  return part;
}

export function forgetStorageFile(messageId: string): void {
  if (held === null) return;
  commit(held.accountId, applyFindings(held.index, { files: [], deletedIds: [messageId] }));
}
