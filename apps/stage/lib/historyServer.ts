import { secureStorage } from '../platform/storage';
import { XMTP_ENV_KEY } from './xmtp.types';
import { ignored } from './errorPolicy';
import { linkProxyBase } from './linkProxy';

export function historyServerUrl(env: string): string {
  return `${linkProxyBase()}/xmtp-history/${env === 'dev' ? 'dev' : 'production'}`;
}

export async function historyServer(): Promise<string> {
  const env = await secureStorage.get(XMTP_ENV_KEY).catch(ignored(null, 'optional'));
  return historyServerUrl(env ?? 'production');
}
