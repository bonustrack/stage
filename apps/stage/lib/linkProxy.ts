import { envBaseUrl } from './env';

const PROXY_BASE = envBaseUrl(process.env.EXPO_PUBLIC_LINKPROXY_URL, 'https://proxy.stage.box');

export function linkProxyBase(): string {
  return PROXY_BASE;
}
