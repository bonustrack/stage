export type ParsedRoute =
  | { pathname: '/xmtp/[convId]'; params: { convId: string; m?: string; focus?: string } }
  | { pathname: '/group/[convId]'; params: { convId: string } }
  | { pathname: '/user/[address]'; params: { address: string } }
  | { pathname: '/(tabs)'; params?: undefined }
  | { pathname: '/(tabs)/settings'; params?: undefined }
  | { pathname: '/(tabs)/contacts'; params?: undefined };

function stripAuthority(work: string): string {
  const m = /^([a-z][a-z0-9+.-]*):\/\/(.*)$/i.exec(work);
  const scheme = m?.[1];
  const rest = m?.[2];
  if (scheme === undefined || rest === undefined) return work;
  if (scheme.toLowerCase() === 'http' || scheme.toLowerCase() === 'https') {
    const cut = rest.search(/[/?]/);
    return cut === -1 ? '/' : rest.slice(cut);
  }
  return '/' + rest;
}

function extractRoute(url: string): { segments: string[]; query: URLSearchParams } {
  let work = url.trim();

  const hashIdx = work.indexOf('#');
  work = hashIdx !== -1 ? work.slice(hashIdx + 1) : stripAuthority(work);

  const qIdx = work.indexOf('?');
  const pathPart = qIdx === -1 ? work : work.slice(0, qIdx);
  const queryPart = qIdx === -1 ? '' : work.slice(qIdx + 1);

  const segments = pathPart
    .split('/')
    .map(s => decodeURIComponent(s))
    .filter(Boolean);

  return { segments, query: new URLSearchParams(queryPart) };
}

function conversationRoute(second: string | undefined, query: URLSearchParams): ParsedRoute | null {
  if (!second) return null;
  const m = query.get('m') ?? undefined;
  const focus = query.get('focus') ?? undefined;
  return {
    pathname: '/xmtp/[convId]',
    params: { convId: second, ...(m ? { m } : {}), ...(focus ? { focus } : {}) },
  };
}

const STATIC_ROUTES: Record<string, ParsedRoute> = {
  channels: { pathname: '/(tabs)' },
  settings: { pathname: '/(tabs)/settings' },
  contacts: { pathname: '/(tabs)/contacts' },
};

export function routeForUrl(url: string): ParsedRoute | null {
  const { segments, query } = extractRoute(url);
  if (segments.length === 0) return { pathname: '/(tabs)' };

  const [head, second] = segments;
  if (head === 'xmtp' || head === 'embed') return conversationRoute(second, query);
  if (head === 'group') {
    return second ? { pathname: '/group/[convId]', params: { convId: second } } : null;
  }
  if (head === 'user') {
    return second ? { pathname: '/user/[address]', params: { address: second } } : null;
  }
  return (head !== undefined ? STATIC_ROUTES[head] : undefined) ?? null;
}

export function shouldHandleDeepLink(url: string): boolean {
  return url.includes('#');
}
