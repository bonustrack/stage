import { useEffect } from 'react';
import { isDeletedPlaceholderType } from '@stage-labs/client/xmtp/deleteMessage';
import { sdk } from './xmtp.sdk';
import { accountClient, type AccountClient } from './xmtp.account';
import { AccountChangedError, NoAccountError } from './xmtp.client.core';
import { conversationIsSyncGroup } from './xmtp.conv';
import { subscribeAllMessages } from './xmtp.stream';
import type { StreamMsg, XmtpConsent } from './xmtp.types';
import { getActiveAccountId } from './accounts';
import { useAccountEpoch } from './accountEpoch';
import { getCachedRows, knownActiveAccountId } from './channelsCache';
import { listedConvRow } from '../modules/messaging/convRow.model';
import { makeListeners, useStoreValue } from './storeCore';
import { report, reported } from './errorPolicy';
import { onStorageIndexForgotten, readStorageIndex, writeStorageIndex } from './storageIndexStore';
import {
  applyFindings, emptyIndex, findingsOf, nextCursorNs, withCursor, type ScanFindings, type StorageIndex, type StoredFile,
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

interface StorageChat { peerAddress: string | null; groupName: string }

const ALL_CONSENT: XmtpConsent[] = ['allowed', 'unknown', 'denied'];
const PUBLISH_MS = 250;

const INITIAL: StorageState = {
  accountId: null, files: [], loaded: false, scanning: false, firstScan: false, done: 0, total: 0, failed: false,
};

let state = INITIAL;
let held: { accountId: string; index: StorageIndex } | null = null;
let publishTimer: ReturnType<typeof setTimeout> | null = null;
let scanRun: Promise<void> | null = null;
let scanAgain = false;
const listeners = makeListeners();

function setState(patch: Partial<StorageState>): void {
  state = { ...state, ...patch };
  listeners.notify();
}

function getState(): StorageState { return state; }

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
  const accountId = knownActiveAccountId() ?? await getActiveAccountId();
  if (accountId === null) return;
  const index = await heldIndex(accountId);
  if (state.accountId === accountId && state.loaded) return;
  setState({ ...INITIAL, accountId, files: index?.files ?? [], loaded: index !== null });
}

function sourceFor(context: AccountClient): ScanSource<Conv> {
  return {
    page: async (conv, query) => (await sdk.messages(conv, query)).map(m => ({ ...sdk.rowOf(m), convId: conv.id })),
    skip: async (conv) => sdk.isGroup(conv) && await conversationIsSyncGroup(conv),
    superAdmins: async (conv) => new Set((await sdk.groupAdmins(conv)).superAdmins.map(id => id.toLowerCase())),
    current: context.current,
    failed: reported('storage.scanChat'),
  };
}

function sinkFor(accountId: string): ScanSink {
  return {
    index: () => currentIndex(accountId),
    apply: (findings) => { commit(accountId, applyFindings(currentIndex(accountId), findings)); },
    progress: (done, total) => { state = { ...state, done, total }; publishSoon(); },
  };
}

async function startIndex(context: AccountClient): Promise<StorageIndex> {
  const accountId = context.account.id;
  const inboxId = context.client.inboxId;
  const stored = await heldIndex(accountId);
  context.assertCurrent();
  const start = stored !== null && stored.inboxId === inboxId ? stored : emptyIndex(inboxId);
  commit(accountId, start);
  return start;
}

async function runScan(): Promise<void> {
  const context = await accountClient();
  const accountId = context.account.id;
  const start = await startIndex(context);
  setState({ accountId, files: start.files, loaded: true, scanning: true, firstScan: start.cursorNs === 0, done: 0, total: 0, failed: false });
  const startedMs = Date.now();
  const convs = await sdk.listConvs(context.client, ALL_CONSENT);
  context.assertCurrent();
  setState({ total: convs.length });
  const complete = await scanConversations(convs, start.cursorNs, sourceFor(context), sinkFor(accountId));
  const index = currentIndex(accountId);
  commit(accountId, complete ? withCursor(index, nextCursorNs(startedMs)) : index);
  publishNow();
  setState({ scanning: false, firstScan: false, done: convs.length, failed: !complete });
}

function isStop(err: unknown): boolean {
  return err instanceof ScanStopped || err instanceof AccountChangedError || err instanceof NoAccountError;
}

function scanEnded(err: unknown): void {
  if (!isStop(err)) report('storage.scan', err);
  setState({ scanning: false, firstScan: false, failed: !isStop(err) });
}

function refreshStorage(): void {
  if (scanRun !== null) { scanAgain = true; return; }
  scanRun = runScan().catch(scanEnded).finally(() => {
    scanRun = null;
    if (!scanAgain) return;
    scanAgain = false;
    refreshStorage();
  });
}

function onStreamMessage({ convId, msg }: StreamMsg): void {
  if (held === null || convId === null) return;
  const { accountId, index } = held;
  const findings: ScanFindings = findingsOf([{ ...msg, convId }], index.inboxId);
  if (findings.files.length > 0 || findings.deletedIds.length > 0) commit(accountId, applyFindings(index, findings));
}

function openStorage(): () => void {
  let open = true;
  void showCached().then(() => { if (open) refreshStorage(); }).catch(reported('storage.open'));
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

export async function storageFileGone(messageId: string): Promise<boolean> {
  const message = await sdk.messageById(await sdk.client(), messageId);
  return !message || isDeletedPlaceholderType(sdk.rowOf(message).contentTypeId);
}

export function forgetStorageFile(messageId: string): void {
  if (held === null) return;
  commit(held.accountId, applyFindings(held.index, { files: [], deletedIds: [messageId] }));
}

export async function storageChatOf(convId: string): Promise<StorageChat | null> {
  const listed = listedConvRow(getCachedRows(), convId);
  if (listed !== undefined) return { peerAddress: listed.peerAddress, groupName: listed.groupName ?? '' };
  const client = await sdk.client();
  const conv = await sdk.findConv(client, convId);
  if (!conv) return null;
  const peer = sdk.dmPeerInboxId(conv);
  if (peer === null) return { peerAddress: null, groupName: (await sdk.groupInfo(conv)).name };
  const [address] = await sdk.ethAddressesOf(client, [await peer()]);
  return { peerAddress: address ?? null, groupName: '' };
}
