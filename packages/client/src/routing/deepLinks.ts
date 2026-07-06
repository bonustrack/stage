export type ParsedRoute =
  | { pathname: '/[convId]'; params: { convId: string; m?: string; focus?: string } }
  | { pathname: '/channel/[convId]'; params: { convId: string; m?: string; focus?: string } }
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

function conversationRoute(
  pathname: '/[convId]' | '/channel/[convId]',
  convId: string | undefined,
  query: URLSearchParams,
): ParsedRoute | null {
  if (!convId) return null;
  const m = query.get('m') ?? undefined;
  const focus = query.get('focus') ?? undefined;
  return { pathname, params: { convId, ...(m ? { m } : {}), ...(focus ? { focus } : {}) } };
}

const DM_ADDRESS_HEAD_RE = /^0x[a-fA-F0-9]{40}$/;

const STATIC_ROUTES: Record<string, ParsedRoute> = {
  channels: { pathname: '/(tabs)' },
  settings: { pathname: '/(tabs)/settings' },
  contacts: { pathname: '/(tabs)/contacts' },
};

const CONVERSATION_HEADS = new Set(['xmtp', 'channel', 'embed']);

function headRoute(segments: string[], query: URLSearchParams): ParsedRoute | null {
  const [head, second, third] = segments;
  if (head === undefined) return null;
  if (CONVERSATION_HEADS.has(head)) {
    return second === 'user'
      ? conversationRoute('/[convId]', third, query)
      : conversationRoute('/channel/[convId]', second, query);
  }
  if (head === 'group') {
    return second ? { pathname: '/group/[convId]', params: { convId: second } } : null;
  }
  if (head === 'user') {
    return second ? { pathname: '/user/[address]', params: { address: second } } : null;
  }
  if (DM_ADDRESS_HEAD_RE.test(head)) return conversationRoute('/[convId]', head, query);
  return STATIC_ROUTES[head] ?? null;
}

export function routeForUrl(url: string): ParsedRoute | null {
  const { segments, query } = extractRoute(url);
  if (segments.length === 0) return { pathname: '/(tabs)' };
  return headRoute(segments, query);
}

export function shouldHandleDeepLink(url: string): boolean {
  return url.includes('#');
}
