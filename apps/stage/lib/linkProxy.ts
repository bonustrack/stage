import { PROXY_ORIGIN } from '@stage-labs/client/endpoints';
import { envBaseUrl } from './env';

const PROXY_BASE = envBaseUrl(process.env.EXPO_PUBLIC_LINKPROXY_URL, PROXY_ORIGIN);

export function linkProxyBase(): string {
  return PROXY_BASE;
}
