import { secureStorage } from '../platform/storage';
import { XMTP_ENV_KEY } from './xmtp.types';
import { ignored } from './errorPolicy';

const PROXY_BASE_ENV: unknown = process.env.EXPO_PUBLIC_LINKPROXY_URL;

const PROXY_BASE =
  typeof PROXY_BASE_ENV === 'string' && PROXY_BASE_ENV !== ''
    ? PROXY_BASE_ENV.replace(/\/$/, '')
    : 'https://proxy.stage.box';

export function linkProxyBase(): string {
  return PROXY_BASE;
}

export function historyServerUrl(env: string): string {
  return `${PROXY_BASE}/xmtp-history/${env === 'dev' ? 'dev' : 'production'}`;
}

export async function historyServer(): Promise<string> {
  const env = await secureStorage.get(XMTP_ENV_KEY).catch(ignored(null, 'optional'));
  return historyServerUrl(env ?? 'production');
}
