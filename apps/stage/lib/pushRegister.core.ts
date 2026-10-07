import { errorMessage } from '@stage-labs/client/errors';
import {
  PUSH_RPC, clearConversationBody, deleteInstallationBody, derivePushGroupKey, joinDeviceGroupBody, pushRpcPath, type PushRpc,
} from '@stage-labs/client/xmtp/pushServer';
import { appStorage } from '../platform/storage';
import { getActiveAccount, type AccountRecord } from './accounts';
import { makePushRegistrar, readPushRegistration, type PushRegistrationInput } from './pushRegistration.core';

export type { PushTopics } from './pushRegistration.core';
import { onReadStateChanged } from './channelsCache';
import { isPushEnabledSync, loadPushEnabled } from './pushPref';
import { setPushStatus } from './pushStatus';
import { report, reported, ignored } from './errorPolicy';
import { afterFirstPages } from './feedLines';
import { envBaseUrl } from './env';
import { signingKeyForRecord } from './xmtp.signing.core';

const PUSH_SERVER_URL = envBaseUrl(process.env.EXPO_PUBLIC_PUSH_SERVER_URL, 'https://push.stage.box');
const CLEAR_DEBOUNCE_MS = 1_500;
const HTTP_CONFLICT = 409;

const stateKey = (installationId: string): string => `push.server.${installationId}`;
const joinedKey = (installationId: string): string => `push.group.${installationId}`;

export type PushPermission = 'granted' | 'denied' | 'undetermined';

const TOPIC_REFRESH_DEBOUNCE_MS = 1_500;

export function toPermission(status: string): PushPermission {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

export function makeTopicRefresh<C>(
  getClient: () => C | null | undefined, register: (client: C) => Promise<void>,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const client = getClient();
      if (client) void register(client);
    }, TOPIC_REFRESH_DEBOUNCE_MS);
  };
}

function reportPushFailure(scope: string, err: unknown): void {
  setPushStatus('failed', errorMessage(err));
  report(scope, err);
}

export function directRpcUrl(method: PushRpc): string {
  return `${PUSH_SERVER_URL}${pushRpcPath(method)}`;
}

async function postJson(url: string, body: unknown, accepted?: number): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== accepted) throw new Error(`push server responded ${res.status}`);
}

const groupKeys = new Map<string, Promise<string>>();

async function pushGroupKey(rec: AccountRecord): Promise<string> {
  const known = groupKeys.get(rec.address);
  if (known) return known;
  const pending = signingKeyForRecord(rec).then(({ signMessage }) => derivePushGroupKey(rec.address, signMessage));
  groupKeys.set(rec.address, pending);
  pending.catch(() => { groupKeys.delete(rec.address); });
  return pending;
}

async function joinDeviceGroup(input: PushRegistrationInput, account: AccountRecord): Promise<void> {
  const key = joinedKey(input.installationId);
  if ((await appStorage.get(key).catch(ignored(null, 'cache'))) === '1' || !input.current()) return;
  const groupKey = await pushGroupKey(account);
  if (!input.current()) return;
  await postJson(input.rpcUrl(PUSH_RPC.join), joinDeviceGroupBody(input.installationId, groupKey), HTTP_CONFLICT);
  await appStorage.set(key, '1').catch(ignored(undefined, 'cache'));
}

const register = makePushRegistrar({
  read: installationId => appStorage.get(stateKey(installationId)),
  write: (installationId, value) => appStorage.set(stateKey(installationId), value),
  post: postJson,
  now: Date.now,
  status: setPushStatus,
});

async function pushEnabled(): Promise<boolean> {
  await loadPushEnabled();
  if (isPushEnabledSync()) return true;
  setPushStatus('disabled');
  return false;
}

export async function runPushRegistration(input: PushRegistrationInput & { accountAddress: string }): Promise<void> {
  const current = (): boolean => input.current() && isPushEnabledSync();
  try {
    if (!input.current() || !(await pushEnabled())) return;
    const account = await getActiveAccount();
    if (!account || account.address.toLowerCase() !== input.accountAddress.toLowerCase() || !current()) return;
    await afterFirstPages();
    const guarded = { ...input, current };
    if (await register(guarded)) await joinDeviceGroup(guarded, account).catch(reported('push.join'));
  } catch (err) {
    if (current()) reportPushFailure('push.register', err);
  }
}

export async function runPushUnregistration(installationId: string, rpcUrl: (method: PushRpc) => string): Promise<void> {
  try {
    const key = stateKey(installationId);
    const prev = readPushRegistration(await appStorage.get(key));
    await appStorage.delete(key).catch(ignored(undefined, 'cleanup'));
    setPushStatus('disabled');
    if (!prev) return;
    await postJson(rpcUrl(PUSH_RPC.remove), deleteInstallationBody(installationId));
  } catch (err) {
    reportPushFailure('push.unregister', err);
  }
}

interface PushClearInput {
  installationId: () => string | null;
  rpcUrl: (method: PushRpc) => string;
  dismissLocal: (convId: string) => Promise<void>;
}

async function requestPushClear(input: PushClearInput, convId: string): Promise<void> {
  const installationId = input.installationId();
  if (installationId === null) return;
  const account = await getActiveAccount();
  if (account === null || input.installationId() !== installationId) return;
  const groupKey = await pushGroupKey(account);
  if (input.installationId() !== installationId) return;
  await postJson(input.rpcUrl(PUSH_RPC.clear), clearConversationBody(installationId, groupKey, convId));
}

export function makePushClear(input: PushClearInput): () => void {
  const pending = new Map<string, ReturnType<typeof setTimeout>>();
  let started = false;
  return () => {
    if (started) return;
    started = true;
    onReadStateChanged(({ convId, markedUnread }) => {
      if (markedUnread) return;
      void input.dismissLocal(convId).catch(ignored(undefined, 'ui'));
      const timer = pending.get(convId);
      if (timer !== undefined) clearTimeout(timer);
      pending.set(convId, setTimeout(() => {
        pending.delete(convId);
        void requestPushClear(input, convId).catch(reported('push.clear'));
      }, CLEAR_DEBOUNCE_MS));
    });
  };
}
