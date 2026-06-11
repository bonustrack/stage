// Stage usernames gateway train (`<name>.stage.box`).
//
// A plain long-running HTTP server supervised by metro (NOT a chat station —
// emits no inbound/outbound message events, only a startup log line). It serves
// two co-located surfaces.
//
// 1. REGISTRATION API (consumed by the Metro app):
//      GET  /name/:name        -> 200 record | 404
//      GET  /address/:address  -> 200 record | 404   (reverse lookup)
//      POST /claim {name,address,avatar?,sig,ts}
//                              -> 200 record | 400 bad | 401 sig | 409 taken
//    Records persist as flat JSON under ~/.cache/metro/usernames.json.
//
// 2. CCIP-READ GATEWAY (consumed by the OffchainResolver contract, EIP-3668):
//      GET  /:sender/:data     -> 200 { data: <abi (result,expires,sig)> }
//      POST /                  -> 200 { data: ... }   (sender,data in body)
//    Signs answers with METRO_USERNAMES_SIGNER_KEY so the contract verifies the
//    gateway operator.
//
// Env:
//   USERNAMES_PORT             (default 8457)
//   METRO_USERNAMES_SIGNER_KEY 0x-hex private key (gateway signer). REQUIRED for
//                              the CCIP-Read path; registration API works without
//                              it. Address must equal a signer in the resolver.
//   METRO_USERNAMES_RESOLVER   deployed OffchainResolver address (binds the sig).
//   METRO_USERNAMES_FILE       override the JSON store path.
//
// Tunnel: front this with a named cloudflared tunnel (blob.metro.box pattern) on
// a stable HTTPS host, e.g. usernames.stage.box → :8457. That host is BOTH the
// resolver's gateway URL AND the app's registration base. Do NOT create the
// tunnel here — Less/orchestrator wires it.

import { type Address, type Hex, isAddress } from 'viem';
import { getByAddress, getByName, putRecord } from './store.js';
import { validateClaim } from './claim.js';
import {
  encodeGatewayResponse, handleResolve, signerAddress,
} from './resolver.js';

const PORT = Number(process.env.USERNAMES_PORT ?? 8457);
const SIGNER_KEY = process.env.METRO_USERNAMES_SIGNER_KEY as Hex | undefined;
const RESOLVER = process.env.METRO_USERNAMES_RESOLVER as Address | undefined;

const emit = (e: unknown): void => void process.stdout.write(JSON.stringify(e) + '\n');

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

/** POST /claim: validate signature + name, then first-come persist. */
async function handleClaim(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  const v = await validateClaim(body);
  if (!v.ok) return json({ error: v.error }, v.status);
  const put = await putRecord(v.record);
  if (!put.ok) {
    const error = put.reason === 'name-taken' ? 'name already taken' : 'address already has a name';
    return json({ error }, 409);
  }
  return json(put.record);
}

/** CCIP-Read: resolve+sign. Both /:sender/:data and POST / land here. */
async function handleCcip(sender: string, data: string): Promise<Response> {
  if (!SIGNER_KEY || !RESOLVER) return json({ error: 'gateway signer not configured' }, 501);
  if (!isAddress(sender)) return json({ error: 'bad sender' }, 400);
  if (!data.startsWith('0x')) return json({ error: 'bad data' }, 400);
  try {
    const { result, expires, sig } = await handleResolve(RESOLVER, data as Hex, SIGNER_KEY);
    return json({ data: encodeGatewayResponse(result, expires, sig) });
  } catch (e) {
    emit({ kind: 'log', level: 'error', station: 'usernames', msg: 'ccip resolve failed', detail: String(e).slice(0, 200) });
    return json({ error: 'resolve failed' }, 502);
  }
}

const server = Bun.serve({
  port: PORT,
  hostname: '127.0.0.1',
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (req.method === 'GET' && path === '/health') return json({ ok: true });

    // Registration API.
    if (req.method === 'GET' && path.startsWith('/name/')) {
      const rec = await getByName(decodeURIComponent(path.slice('/name/'.length)));
      return rec ? json(rec) : json({ error: 'not found' }, 404);
    }
    if (req.method === 'GET' && path.startsWith('/address/')) {
      const rec = await getByAddress(decodeURIComponent(path.slice('/address/'.length)));
      return rec ? json(rec) : json({ error: 'not found' }, 404);
    }
    if (req.method === 'POST' && path === '/claim') return handleClaim(req);

    // CCIP-Read: POST / { sender, data }.
    if (req.method === 'POST' && path === '/') {
      const b = (await req.json().catch(() => ({}))) as { sender?: string; data?: string };
      return handleCcip(b.sender ?? '', b.data ?? '');
    }
    // CCIP-Read: GET /:sender/:data (EIP-3668 default).
    const seg = path.split('/').filter(Boolean);
    if (req.method === 'GET' && seg.length === 2) {
      return handleCcip(seg[0]!, seg[1]!.replace(/\.json$/, ''));
    }
    return json({ error: 'not found' }, 404);
  },
});

emit({
  kind: 'log', level: 'info', station: 'usernames',
  msg: `usernames gateway on http://127.0.0.1:${server.port}`
    + (SIGNER_KEY ? ` (signer ${signerAddress(SIGNER_KEY)})` : ' (CCIP-Read disabled: no signer key)'),
});
