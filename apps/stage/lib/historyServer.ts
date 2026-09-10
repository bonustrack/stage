const PROXY_BASE_ENV: unknown = process.env.EXPO_PUBLIC_LINKPROXY_URL;

const PROXY_BASE =
  typeof PROXY_BASE_ENV === 'string' && PROXY_BASE_ENV !== ''
    ? PROXY_BASE_ENV.replace(/\/$/, '')
    : 'https://proxy.stage.box';

export function historyServerUrl(env: string): string {
  return `${PROXY_BASE}/xmtp-history/${env === 'dev' ? 'dev' : 'production'}`;
}
