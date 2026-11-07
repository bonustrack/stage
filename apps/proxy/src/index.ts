import { BUNDLER_HOST, PROXY_ROUTES } from '@stage-labs/client/endpoints';
import { clientRateKey } from '@stage-labs/client/net/clientIp';
import { handleBundler } from './bundler.ts';
import { handleImg, handlePreview, handleSettle } from './linkRoutes.ts';
import { HISTORY_CORS_HEADERS, handleHistory } from './historyStore.ts';
import { ATTACHMENT_CORS, handleAttachments, r2AttachmentStore } from './attachments.ts';
import { PUSH_CORS_HEADERS, handlePush } from './pushProxy.ts';
import { configuredChain, handleNamesRequest, type NamesEnv } from './names.ts';
import { MAIL_CORS, handleMail, type MailChain } from './mailApi.ts';
import { mailboxStub } from './mailBox.ts';
import { receiveMail, type IncomingMail } from './mailReceive.ts';
import { NODES_CORS, cloudflareApi, handleNodes } from './nodes.ts';
import { limitsAtRouter, overLimit, type RouteLimit } from './rateLimit.ts';
import { CLIENT_CORS, OPEN_CORS, RATE_LIMITED, corsResponse, openJson, type HeaderMap } from './respond.ts';

export { NamesClaims } from './names.ts';
export { HistoryArchives } from './historyStore.ts';
export { MailBoxes } from './mailBox.ts';

type ProxyEnv = NamesEnv & {
  HISTORY_ARCHIVES?: DurableObjectNamespace;
  MAIL_REQUESTS?: RateLimit;
  ATTACHMENTS?: R2Bucket;
  ATTACHMENT_UPLOADS?: RateLimit;
  NODES_CF_API_TOKEN?: string;
  NODES_CF_ACCOUNT_ID?: string;
  NODE_PUBLISHES?: RateLimit;
  NODE_PUBLISHES_ALL?: RateLimit;
};

interface RouteScope {
  env: ProxyEnv;
  ctx: ExecutionContext;
  limited: () => Promise<boolean>;
}

interface ProxyRoute {
  path: string;
  match: 'exact' | 'prefix' | 'tree';
  preflight: HeaderMap;
  limit?: RouteLimit<ProxyEnv>;
  handle: (request: Request, scope: RouteScope) => Promise<Response> | Response;
}

interface MailWiring {
  mailbox: (label: string) => ReturnType<typeof mailboxStub>;
  chain: MailChain;
}

function mailWiring(env: ProxyEnv): MailWiring | null {
  const chain = configuredChain(env);
  const boxes = env.MAIL_BOXES;
  if (chain === null || boxes === undefined) return null;
  return {
    mailbox: (label) => mailboxStub(boxes, label),
    chain: {
      owner: (label) => chain.subnameOwner(label),
      verify: (address, message, signature) => chain.verifyClaim(address, message, signature),
    },
  };
}

function routeMail(request: Request, { env, limited }: RouteScope): Promise<Response> | Response {
  const wiring = mailWiring(env);
  if (wiring === null) return openJson({ error: 'mail is not configured' }, 503);
  return handleMail(request, { ...wiring, limited });
}

const ROUTES: readonly ProxyRoute[] = [
  { path: PROXY_ROUTES.health, match: 'exact', preflight: OPEN_CORS, handle: () => corsResponse(OPEN_CORS, 'ok', 200, 'text/plain') },
  {
    path: PROXY_ROUTES.preview,
    match: 'exact',
    preflight: CLIENT_CORS,
    limit: { budget: 'preview', inHandler: true },
    handle: (request, { ctx, limited }) => handlePreview(request, ctx, limited),
  },
  {
    path: PROXY_ROUTES.img,
    match: 'exact',
    preflight: CLIENT_CORS,
    limit: { budget: 'img' },
    handle: (request, { ctx }) => handleImg(request, ctx),
  },
  {
    path: PROXY_ROUTES.settle,
    match: 'exact',
    preflight: CLIENT_CORS,
    limit: { budget: 'settle', inHandler: true },
    handle: (request, { limited }) => handleSettle(request, limited),
  },
  {
    path: PROXY_ROUTES.attachments,
    match: 'tree',
    preflight: ATTACHMENT_CORS,
    limit: { budget: 'attachments', methods: ['POST'], edge: (env, ip) => [{ binding: env.ATTACHMENT_UPLOADS, key: ip }] },
    handle: (request, { env }) =>
      handleAttachments(request, env.ATTACHMENTS === undefined ? undefined : r2AttachmentStore(env.ATTACHMENTS)),
  },
  {
    path: PROXY_ROUTES.nodes,
    match: 'exact',
    preflight: NODES_CORS,
    limit: {
      budget: 'nodes',
      inHandler: true,
      edge: (env, ip) => [
        { binding: env.NODE_PUBLISHES, key: clientRateKey(ip) },
        { binding: env.NODE_PUBLISHES_ALL, key: 'all' },
      ],
    },
    handle: (request, { env, limited }) =>
      handleNodes(request, { api: cloudflareApi(env.NODES_CF_API_TOKEN, env.NODES_CF_ACCOUNT_ID), limited }),
  },
  {
    path: PROXY_ROUTES.history,
    match: 'prefix',
    preflight: HISTORY_CORS_HEADERS,
    limit: { budget: 'history', methods: ['POST'] },
    handle: (request, { env }) => handleHistory(request, env.HISTORY_ARCHIVES),
  },
  { path: PROXY_ROUTES.push, match: 'prefix', preflight: PUSH_CORS_HEADERS, handle: (request) => handlePush(request) },
  {
    path: PROXY_ROUTES.mail,
    match: 'prefix',
    preflight: MAIL_CORS,
    limit: { inHandler: true, edge: (env, ip) => [{ binding: env.MAIL_REQUESTS, key: ip }] },
    handle: routeMail,
  },
  {
    path: PROXY_ROUTES.names,
    match: 'prefix',
    preflight: CLIENT_CORS,
    limit: { budget: 'names' },
    handle: (request, { env }) => handleNamesRequest(request, env),
  },
];

function matches({ path, match }: ProxyRoute, pathname: string): boolean {
  if (match === 'prefix') return pathname.startsWith(path);
  return pathname === path || (match === 'tree' && pathname.startsWith(`${path}/`));
}

async function serve(route: ProxyRoute, request: Request, env: ProxyEnv, ctx: ExecutionContext): Promise<Response> {
  if (request.method === 'OPTIONS') return corsResponse(route.preflight, null, 204);
  const limited = (): Promise<boolean> => overLimit(route.limit, request, env);
  if (limitsAtRouter(route.limit, request.method) && (await limited())) return RATE_LIMITED();
  return route.handle(request, { env, ctx, limited });
}

export default {
  async fetch(request: Request, env: ProxyEnv, ctx: ExecutionContext): Promise<Response> {
    const { hostname, pathname } = new URL(request.url);
    if (hostname === BUNDLER_HOST) return handleBundler(request);
    const route = ROUTES.find((candidate) => matches(candidate, pathname));
    return route === undefined ? openJson({ error: 'not found' }, 404) : serve(route, request, env, ctx);
  },

  async email(message: IncomingMail, env: ProxyEnv): Promise<void> {
    const wiring = mailWiring(env);
    if (wiring === null) throw new Error('st.box mail is not configured');
    await receiveMail(message, wiring);
  },
};
