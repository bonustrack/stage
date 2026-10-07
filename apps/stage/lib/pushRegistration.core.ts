import { sha256 } from 'viem';
import {
  PUSH_RPC, isWelcomeTopic, registerInstallationBody, subscribeWithMetadataBody, deleteInstallationBody,
  type HmacKeysByTopic, type PushPlatform, type PushRpc, type PushSubscriptionJson,
} from '@stage-labs/client/xmtp/pushServer';

import { abortable } from './abortable.core';

const REGISTER_TTL_MS = 6 * 60 * 60 * 1000;

export interface PushTopics { topics: string[]; hmacKeys: HmacKeysByTopic }

export interface PushRegistrationInput {
  installationId: string;
  platform: PushPlatform;
  current: () => boolean;
  signal?: AbortSignal;
  rpcUrl: (method: PushRpc) => string;
  getToken: () => Promise<string | null>;
  syncPreferences: () => Promise<unknown>;
  collectTopics: () => Promise<PushTopics>;
}

interface RegisterState { token: string; at: number; subscriptions: string }

function pushSubscriptionSignature(subscriptions: readonly PushSubscriptionJson[]): string {
  const sorted = subscriptions.map(sub => ({
    ...sub,
    hmacKeys: [...sub.hmacKeys].sort((a, b) => a.thirtyDayPeriodsSinceEpoch - b.thirtyDayPeriodsSinceEpoch || a.key.localeCompare(b.key)),
  })).sort((a, b) => a.topic.localeCompare(b.topic));
  return sha256(new TextEncoder().encode(JSON.stringify(sorted)));
}

function readPushRegistration(raw: string | null): RegisterState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RegisterState>;
    if (typeof parsed.token !== 'string' || typeof parsed.at !== 'number') return null;
    return { token: parsed.token, at: parsed.at, subscriptions: typeof parsed.subscriptions === 'string' ? parsed.subscriptions : '' };
  } catch { return null; }
}

interface RegistrationDeps {
  read: (installationId: string) => Promise<string | null>;
  write: (installationId: string, value: string) => Promise<void>;
  post: (url: string, body: unknown, signal?: AbortSignal) => Promise<void>;
  remove: (installationId: string) => Promise<void>;
  cacheError: (error: unknown) => void;
  timeoutMs?: number;
  now: () => number;
  status: (status: 'no-token' | 'registering' | 'registered', message?: string) => void;
}

async function register(input: PushRegistrationInput, deps: RegistrationDeps): Promise<boolean> {
  if (!input.current()) return false;
  const token = await input.getToken();
  if (!input.current()) return false;
  if (!token) { deps.status('no-token'); return false; }
  deps.status('registering');
  await input.syncPreferences();
  if (!input.current()) return false;
  return registerTopics(input, deps, token);
}

function isFresh(prev: RegisterState | null, token: string, now: number): prev is RegisterState {
  return prev !== null && prev.token === token && now - prev.at < REGISTER_TTL_MS;
}

async function registerTopics(input: PushRegistrationInput, deps: RegistrationDeps, token: string): Promise<boolean> {
  const subs = await input.collectTopics();
  if (!input.current()) return false;
  const body = subscribeWithMetadataBody(input.installationId, subs.topics, subs.hmacKeys, isWelcomeTopic);
  const signature = pushSubscriptionSignature(body.subscriptions);
  const prev = readPushRegistration(await deps.read(input.installationId));
  if (!input.current()) return false;
  const fresh = isFresh(prev, token, deps.now());
  if (!fresh) {
    await deps.post(input.rpcUrl(PUSH_RPC.register), registerInstallationBody(input.installationId, token, input.platform));
    if (!input.current()) return false;
  }
  if (fresh && prev.subscriptions === signature) {
    deps.status('registered', `${subs.topics.length} topics, unchanged`);
    return true;
  }
  await deps.post(input.rpcUrl(PUSH_RPC.subscribe), body);
  if (!input.current()) return false;
  const next: RegisterState = { token, at: fresh ? prev.at : deps.now(), subscriptions: signature };
  await deps.write(input.installationId, JSON.stringify(next)).catch(deps.cacheError);
  if (!input.current()) return false;
  deps.status('registered', `${subs.topics.length} topics`);
  return true;
}

async function boundedRegistration(input: PushRegistrationInput, deps: RegistrationDeps): Promise<boolean> {
  const controller = new AbortController();
  const abort = (): void => { controller.abort(new Error('Push registration cancelled')); };
  if (input.signal?.aborted) return false;
  input.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => { controller.abort(new Error('Push registration timed out')); }, deps.timeoutMs ?? 30_000);
  const guarded = { ...input, current: () => !controller.signal.aborted && input.current() };
  const cancellable = { ...deps, post: (url: string, body: unknown) => deps.post(url, body, controller.signal) };
  try { return await abortable(register(guarded, cancellable), controller.signal); }
  finally { clearTimeout(timer); input.signal?.removeEventListener('abort', abort); }
}

export function makePushRegistrar(deps: RegistrationDeps) {
  const pending = new Map<string, Promise<unknown>>();
  async function enqueue<T>(id: string, run: () => Promise<T>): Promise<T> {
    const previous = pending.get(id);
    const next = previous ? previous.then(run, run) : run();
    pending.set(id, next);
    try { return await next; } finally {
      if (pending.get(id) === next) pending.delete(id);
    }
  }
  return {
    register: (input: PushRegistrationInput) => enqueue(input.installationId, () => boundedRegistration(input, deps)),
    unregister: (id: string, rpcUrl: (method: PushRpc) => string) => enqueue(id, async () => {
      await deps.post(rpcUrl(PUSH_RPC.remove), deleteInstallationBody(id));
      await deps.remove(id);
    }),
  };
}
