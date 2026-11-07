import { conversationPathFor, conversationSlugFor, isPeerHandleSegment, profileSlugFor } from './handles';
import { channelPath, type AppRouteSegment } from './routes';
import { STAGE_HOST } from '../endpoints';
import { hashPath, hashRoute, isLaunchPath, shareUrlFor, toStageWebUrl } from './stageLinks';

const MESSAGE_PARAM = 'm';
const MAIL_PATH = '/inbox/mail';

export type ParsedRoute =
  | { pathname: '/[convId]'; params: { convId: string; m?: string; focus?: string } }
  | { pathname: '/channel/[convId]'; params: { convId: string; m?: string; focus?: string } }
  | { pathname: '/profile/[id]'; params: { id: string } }
  | { pathname: '/(tabs)'; params?: undefined }
  | { pathname: '/(tabs)/settings'; params?: undefined }
  | { pathname: '/contacts' | '/dashboard' | '/storage' | '/inbox'; params?: undefined }
  | { pathname: typeof MAIL_PATH; params: { label: string; id: string } }
  | { pathname: '/board'; params?: undefined };

export type DmLink = Extract<ParsedRoute, { pathname: '/[convId]' }>;
export type ChannelLink = Extract<ParsedRoute, { pathname: '/channel/[convId]' }>;
export type ConversationLink = DmLink | ChannelLink;
export type ProfileLink = Extract<ParsedRoute, { pathname: '/profile/[id]' }>;

export interface FrameLink {
  pathname: '/frame';
  params: { convId: string; id: string };
}

export const WALLET_LINKS = { send: '/wallet/send', receive: '/wallet/receive' } as const;

export type WalletLink = (typeof WALLET_LINKS)[keyof typeof WALLET_LINKS];

interface WalletSendLink {
  pathname: typeof WALLET_LINKS.send;
  params: { to: string };
}

export function channelLinkOf(convId: string): ChannelLink {
  return { pathname: '/channel/[convId]', params: { convId } };
}

export function conversationSlugLinkOf(slug: string): DmLink {
  return { pathname: '/[convId]', params: { convId: slug } };
}

export function dmLinkFor(peerAddress: string, handle: string | null | undefined): DmLink {
  return conversationSlugLinkOf(conversationSlugFor(peerAddress, handle));
}

export function conversationLinkFor(
  convId: string,
  peerAddress: string | null | undefined,
  handle: string | null | undefined,
): ConversationLink {
  return peerAddress ? dmLinkFor(peerAddress, handle) : channelLinkOf(convId);
}

export function profileLinkFor(address: string, handle: string | null | undefined): ProfileLink {
  return { pathname: '/profile/[id]', params: { id: profileSlugFor(address, handle) } };
}

export function channelProfileLinkOf(convId: string): ProfileLink {
  return { pathname: '/profile/[id]', params: { id: convId } };
}

export function conversationSharePathFor(
  convId: string,
  peerAddress: string | null | undefined,
  handle: string | null | undefined,
): string {
  return peerAddress ? conversationPathFor(peerAddress, handle) : channelPath(convId);
}

export function messageShareUrlFor(sharePath: string, messageId: string): string {
  return `${shareUrlFor(sharePath)}?${MESSAGE_PARAM}=${messageId}`;
}

export function isActiveConversationPathFor(
  pathname: string,
  convId: string,
  peerAddress: string | null | undefined,
  handle: string | null | undefined,
): boolean {
  if (!pathname) return false;
  const path = pathname.toLowerCase();
  if (path === channelPath(convId).toLowerCase()) return true;
  if (!peerAddress) return false;
  return path === `/${peerAddress}`.toLowerCase() || path === conversationPathFor(peerAddress, handle);
}

export function frameLinkOf(convId: string, messageId: string): FrameLink {
  return { pathname: '/frame', params: { convId, id: messageId } };
}

export function mailLinkOf(label: string, id: string): string {
  return `${MAIL_PATH}?label=${encodeURIComponent(label)}&id=${encodeURIComponent(id)}`;
}

export function walletSendLinkOf(to: string): WalletSendLink {
  return { pathname: WALLET_LINKS.send, params: { to } };
}

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
  const trimmed = url.trim();
  const work = hashRoute(trimmed) ?? stripAuthority(trimmed);

  const qIdx = work.indexOf('?');
  const pathPart = qIdx === -1 ? work : work.slice(0, qIdx);
  const queryPart = qIdx === -1 ? '' : work.slice(qIdx + 1);

  const segments = pathPart
    .split('/')
    .map((s) => decodeURIComponent(s))
    .filter(Boolean);

  return { segments, query: new URLSearchParams(queryPart) };
}

function conversationRoute(
  pathname: '/[convId]' | '/channel/[convId]',
  convId: string | undefined,
  query: URLSearchParams,
): ParsedRoute | null {
  if (!convId) return null;
  const m = query.get(MESSAGE_PARAM) ?? undefined;
  const focus = query.get('focus') ?? undefined;
  return { pathname, params: { convId, ...(m ? { m } : {}), ...(focus ? { focus } : {}) } };
}

const STATIC_ROUTES: ReadonlyMap<string, ParsedRoute> = new Map<AppRouteSegment | 'channels', ParsedRoute>([
  ['channels', { pathname: '/(tabs)' }],
  ['settings', { pathname: '/(tabs)/settings' }],
  ['contacts', { pathname: '/contacts' }],
  ['dashboard', { pathname: '/dashboard' }],
  ['storage', { pathname: '/storage' }],
  ['inbox', { pathname: '/inbox' }],
  ['board', { pathname: '/board' }],
]);

const CONVERSATION_HEADS = new Set(['xmtp', 'channel']);

function entityRoute(head: string, second: string | undefined, query: URLSearchParams): ParsedRoute | null | undefined {
  if (head === 'inbox' && second === 'mail') {
    const label = query.get('label');
    const id = query.get('id');
    return label && id ? { pathname: MAIL_PATH, params: { label, id } } : null;
  }
  if (head !== 'profile') return undefined;
  return second ? { pathname: '/profile/[id]', params: { id: second } } : null;
}

function headRoute(segments: string[], query: URLSearchParams): ParsedRoute | null {
  const [head, second, third] = segments;
  if (head === undefined) return null;
  if (CONVERSATION_HEADS.has(head)) {
    return second === 'user' ? conversationRoute('/[convId]', third, query) : conversationRoute('/channel/[convId]', second, query);
  }
  const entity = entityRoute(head, second, query);
  if (entity !== undefined) return entity;
  const fixed = STATIC_ROUTES.get(head);
  if (fixed) return fixed;
  return isPeerHandleSegment(head) ? conversationRoute('/[convId]', head, query) : null;
}

export function routeForUrl(url: string): ParsedRoute | null {
  const { segments, query } = extractRoute(url);
  if (segments.length === 0) return { pathname: '/(tabs)' };
  return headRoute(segments, query);
}

export function shouldHandleDeepLink(url: string): boolean {
  return url.includes('#');
}

function appPath(path: string): string {
  const target = routeForUrl(path);
  if (!target) return path;
  const queryAt = path.indexOf('?');
  const pathname = queryAt === -1 ? path : path.slice(0, queryAt);
  const segments = pathname.split('/').filter(Boolean);
  const params: Record<string, string | undefined> = target.params ?? {};
  const entity = params.convId ?? params.id;
  if (entity ? decodeURIComponent(segments.at(-1) ?? '') !== entity : segments.length > 1) return path;
  const canonical = target.pathname
    .replace(/\/\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]/g, (_, key: string) => encodeURIComponent(params[key] ?? ''));
  return (canonical || '/') + (queryAt === -1 ? '' : path.slice(queryAt));
}

function stageUrlOf(href: string): URL | null {
  try {
    const parsed = new URL(href);
    return /^https?:$/.test(parsed.protocol) && parsed.host === STAGE_HOST && !parsed.username && !parsed.password ? parsed : null;
  } catch {
    return null;
  }
}

function internalRoute(url: string): string | null {
  const href = toStageWebUrl(url);
  if (/[\s<>\\]/.test(href)) return null;
  const parsed = stageUrlOf(href);
  if (parsed === null) return null;
  const route = hashPath(parsed.hash) ?? parsed.pathname + parsed.search;
  return /[#]/.test(route) || isLaunchPath(route) ? null : route;
}

export function internalLinkPath(url: string): string | null {
  const route = internalRoute(url);
  if (route === null) return null;
  try {
    return appPath(route);
  } catch {
    return null;
  }
}
