import { errorMessage } from '@stage-labs/client/errors';
import {
  PUSH_RPC, clearConversationBody, deleteInstallationBody, derivePushGroupKey, isWelcomeTopic, joinDeviceGroupBody,
  pushRpcPath, registerInstallationBody, subscribeWithMetadataBody, type HmacKeysByTopic, type PushPlatform, type PushRpc,
} from '@stage-labs/client/xmtp/pushServer';
import { appStorage } from '../platform/storage';
import { getActiveAccount } from './accounts';
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

const REGISTER_TTL_MS = 6 * 60 * 60 * 1000;
const stateKey = (installationId: string): string => `push.server.${installationId}`;
const joinedKey = (installationId: string): string => `push.group.${installationId}`;

export interface PushTopics { topics: string[]; hmacKeys: HmacKeysByTopic }

interface PushRegistrationInput {
  installationId: string;
  platform: PushPlatform;
  rpcUrl: (method: PushRpc) => string;
  getToken: () => Promise<string | null>;
  collectTopics: () => Promise<PushTopics>;
}

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

interface RegisterState { token: string; at: number; topics: string }

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

async function activePushGroupKey(): Promise<string | null> {
  const rec = await getActiveAccount();
  if (rec === null) return null;
  const known = groupKeys.get(rec.address);
  if (known) return known;
  const pending = signingKeyForRecord(rec).then(({ signMessage }) => derivePushGroupKey(rec.address, signMessage));
  groupKeys.set(rec.address, pending);
  pending.catch(() => { groupKeys.delete(rec.address); });
  return pending;
}

async function joinDeviceGroup(installationId: string, rpcUrl: (method: PushRpc) => string): Promise<void> {
  const key = joinedKey(installationId);
  if ((await appStorage.get(key).catch(ignored(null, 'cache'))) === '1') return;
  const groupKey = await activePushGroupKey();
  if (groupKey === null) return;
  await postJson(rpcUrl(PUSH_RPC.join), joinDeviceGroupBody(installationId, groupKey), HTTP_CONFLICT);
  await appStorage.set(key, '1').catch(ignored(undefined, 'cache'));
}

async function readState(key: string): Promise<RegisterState | null> {
  const raw = await appStorage.get(key).catch(ignored(null, 'cache'));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RegisterState>;
    if (typeof parsed.token !== 'string' || typeof parsed.at !== 'number') return null;
    return { token: parsed.token, at: parsed.at, topics: typeof parsed.topics === 'string' ? parsed.topics : '' };
  } catch { return null; }
}

async function subscribeTopics(
  input: PushRegistrationInput, prev: RegisterState | null, token: string, registeredAt: number,
): Promise<void> {
  const subs = await input.collectTopics();
  const signature = [...subs.topics].sort().join('\n');
  if (prev?.at === registeredAt && prev.topics === signature) {
    setPushStatus('registered', `${subs.topics.length} topics, unchanged`);
    return;
  }
  await postJson(
    input.rpcUrl(PUSH_RPC.subscribe),
    subscribeWithMetadataBody(input.installationId, subs.topics, subs.hmacKeys, isWelcomeTopic),
  );
  const next: RegisterState = { token, at: registeredAt, topics: signature };
  await appStorage.set(stateKey(input.installationId), JSON.stringify(next)).catch(ignored(undefined, 'cache'));
  setPushStatus('registered', `${subs.topics.length} topics`);
}

async function pushEnabled(): Promise<boolean> {
  await loadPushEnabled();
  if (isPushEnabledSync()) return true;
  setPushStatus('disabled');
  return false;
}

export async function runPushRegistration(input: PushRegistrationInput): Promise<void> {
  try {
    if (!(await pushEnabled())) return;
    await afterFirstPages();
    const token = await input.getToken();
    if (!token) {
      setPushStatus('no-token');
      return;
    }
    setPushStatus('registering');
    const prev = await readState(stateKey(input.installationId));
    const fresh = prev !== null && prev.token === token && Date.now() - prev.at < REGISTER_TTL_MS;
    if (!fresh) {
      await postJson(input.rpcUrl(PUSH_RPC.register), registerInstallationBody(input.installationId, token, input.platform));
    }
    await subscribeTopics(input, fresh ? prev : null, token, fresh ? prev.at : Date.now());
  } catch (err) {
    reportPushFailure('push.register', err);
    return;
  }
  await joinDeviceGroup(input.installationId, input.rpcUrl).catch(reported('push.join'));
}

export async function runPushUnregistration(installationId: string, rpcUrl: (method: PushRpc) => string): Promise<void> {
  try {
    const key = stateKey(installationId);
    const prev = await readState(key);
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
  const groupKey = await activePushGroupKey();
  if (groupKey === null) return;
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
