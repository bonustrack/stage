import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex } from '@noble/hashes/utils';
import {
  PUSH_RPC, isWelcomeTopic, registerInstallationBody, subscribeWithMetadataBody,
  type HmacKeysByTopic, type PushPlatform, type PushRpc, type PushSubscriptionJson,
} from '@stage-labs/client/xmtp/pushServer';

const REGISTER_TTL_MS = 6 * 60 * 60 * 1000;

export interface PushTopics { topics: string[]; hmacKeys: HmacKeysByTopic }

export interface PushRegistrationInput {
  installationId: string;
  platform: PushPlatform;
  current: () => boolean;
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
  return bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(sorted))));
}

export function readPushRegistration(raw: string | null): RegisterState | null {
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
  post: (url: string, body: unknown) => Promise<void>;
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
  await deps.write(input.installationId, JSON.stringify(next));
  if (!input.current()) return false;
  deps.status('registered', `${subs.topics.length} topics`);
  return true;
}

export function makePushRegistrar(deps: RegistrationDeps): (input: PushRegistrationInput) => Promise<boolean> {
  const pending = new Map<string, Promise<boolean>>();
  return async (input) => {
    const previous = pending.get(input.installationId);
    const run = (): Promise<boolean> => register(input, deps);
    const next = previous ? previous.then(run, run) : run();
    pending.set(input.installationId, next);
    try { return await next; } finally {
      if (pending.get(input.installationId) === next) pending.delete(input.installationId);
    }
  };
}
