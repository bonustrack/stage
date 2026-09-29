import { readFileSync, writeFileSync } from 'fs';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

type Answer = { result: unknown } | { error: unknown };

const FIXTURE = new URL('./fixtures/base-rpc.json', import.meta.url);
const RECORD = process.env.STAGE_RPC_RECORD === '1';
const RPC_ENV: unknown = process.env.EXPO_PUBLIC_ZERODEV_RPC;
const RPC = typeof RPC_ENV === 'string' && RPC_ENV.trim() !== '' ? RPC_ENV.trim() : 'https://mainnet.base.org';
const answers = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Record<string, Answer>;

function save(key: string, body: { result?: unknown; error?: unknown }): void {
  answers[key] = body.error === undefined ? { result: body.result } : { error: body.error };
  const sorted = Object.fromEntries(Object.entries(answers).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(FIXTURE, `${JSON.stringify(sorted, null, 2)}\n`);
}

async function replay(_url: string | URL | Request, init?: RequestInit): Promise<Response> {
  const { id, method, params } = JSON.parse(String(init?.body)) as { id: number; method: string; params?: unknown };
  const key = `${method} ${JSON.stringify(params ?? [])}`;
  const answer = answers[key];
  if (answer) return Response.json({ jsonrpc: '2.0', id, ...answer });
  if (!RECORD) throw new Error(`No recorded Base RPC answer for ${key}. Run this test once with STAGE_RPC_RECORD=1.`);
  const live = await fetch(RPC, init);
  if (live.ok) save(key, (await live.clone().json()) as { result?: unknown; error?: unknown });
  return live;
}

export const recordedBaseClient = createPublicClient({
  chain: base,
  transport: http(RPC, { fetchFn: replay, retryCount: RECORD ? 5 : 0 }),
});
