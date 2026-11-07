import { XMTP_ENV } from './xmtp.types';
import { linkProxyBase } from './linkProxy';
import { PROXY_ROUTES, historyEnvOf } from '@stage-labs/client/endpoints';

export function historyServerUrl(): string {
  return `${linkProxyBase()}${PROXY_ROUTES.history}${historyEnvOf(XMTP_ENV)}`;
}
