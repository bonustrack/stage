export const APP_ROUTE_SEGMENTS = [
  'account',
  'add-members',
  'board',
  'channel',
  'contacts',
  'dashboard',
  'frame',
  'import',
  'inbox',
  'new',
  'profile',
  'scan',
  'settings',
  'signup',
  'storage',
  'wallet',
] as const;

export type AppRouteSegment = (typeof APP_ROUTE_SEGMENTS)[number];

const LINK_ONLY_SEGMENTS = ['channels', 'xmtp'] as const;

const RETIRED_SEGMENTS = ['accounts', 'embed', 'group', 'new-group', 'requests', 'user'] as const;

export const RESERVED_ROOT_SEGMENTS: ReadonlySet<string> = new Set([...APP_ROUTE_SEGMENTS, ...LINK_ONLY_SEGMENTS, ...RETIRED_SEGMENTS]);

export function channelPath(convId: string): string {
  return `/channel/${convId}`;
}

export function profilePath(id: string): string {
  return `/profile/${id}`;
}
