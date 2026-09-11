import {
  PUSH_RPC, deleteInstallationBody, isWelcomeTopic, registerInstallationBody, subscribeWithMetadataBody,
  type HmacKeysByTopic, type PushPlatform,
} from '@stage-labs/client/xmtp/pushServer';
import { appStorage } from '../platform/storage';
import { isPushEnabledSync, loadPushEnabled } from './pushPref';
import { setPushStatus } from './pushStatus';

const SERVER_URL_ENV: unknown = process.env.EXPO_PUBLIC_PUSH_SERVER_URL;
const PUSH_SERVER_URL =
  typeof SERVER_URL_ENV === 'string' && SERVER_URL_ENV !== ''
    ? SERVER_URL_ENV.replace(/\/$/, '')
    : 'https://push.stage.box';

const REGISTER_TTL_MS = 6 * 60 * 60 * 1000;
const stateKey = (installationId: string): string => `push.server.${installationId}`;

export interface PushTopics { topics: string[]; hmacKeys: HmacKeysByTopic }

export interface PushRegistrationInput {
  installationId: string;
  platform: PushPlatform;
  getToken: () => Promise<string | null>;
  collectTopics: () => Promise<PushTopics>;
}

interface RegisterState { token: string; at: number; topics: string }

export function reportPushFailure(label: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  setPushStatus('failed', message);
  if (process.env.NODE_ENV !== 'production') console.warn(label, message);
}

async function postJson(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${PUSH_SERVER_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`push server ${path} responded ${res.status}`);
}

async function readState(key: string): Promise<RegisterState | null> {
  const raw = await appStorage.get(key).catch(() => null);
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
    PUSH_RPC.subscribe,
    subscribeWithMetadataBody(input.installationId, subs.topics, subs.hmacKeys, isWelcomeTopic),
  );
  const next: RegisterState = { token, at: registeredAt, topics: signature };
  await appStorage.set(stateKey(input.installationId), JSON.stringify(next)).catch(() => undefined);
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
    const token = await input.getToken();
    if (!token) {
      setPushStatus('no-token');
      return;
    }
    setPushStatus('registering');
    const prev = await readState(stateKey(input.installationId));
    const fresh = prev !== null && prev.token === token && Date.now() - prev.at < REGISTER_TTL_MS;
    if (!fresh) {
      await postJson(PUSH_RPC.register, registerInstallationBody(input.installationId, token, input.platform));
    }
    await subscribeTopics(input, fresh ? prev : null, token, fresh ? prev.at : Date.now());
  } catch (err) {
    reportPushFailure('push registration failed', err);
  }
}

export async function runPushUnregistration(installationId: string): Promise<void> {
  try {
    const key = stateKey(installationId);
    const prev = await readState(key);
    await appStorage.delete(key).catch(() => undefined);
    setPushStatus('disabled');
    if (!prev) return;
    await postJson(PUSH_RPC.remove, deleteInstallationBody(installationId));
  } catch (err) {
    reportPushFailure('push unregistration failed', err);
  }
}
