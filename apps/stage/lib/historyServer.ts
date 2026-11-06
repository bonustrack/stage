import { secureStorage } from '../platform/storage';
import { XMTP_ENV_KEY } from './xmtp.types';
import { ignored } from './errorPolicy';
import { linkProxyBase } from './linkProxy';
import { PROXY_ROUTES, historyEnvOf } from '@stage-labs/client/endpoints';

export function historyServerUrl(env: string): string {
  return `${linkProxyBase()}${PROXY_ROUTES.history}${historyEnvOf(env)}`;
}

export async function historyServer(): Promise<string> {
  const env = await secureStorage.get(XMTP_ENV_KEY).catch(ignored(null, 'optional'));
  return historyServerUrl(env ?? 'production');
}
