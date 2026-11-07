import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  NAME_TAKEN,
  fetchIssuedAddress,
  fetchIssuedName,
  fetchNameCheck,
  postNameClaim,
  type NamesRequest,
} from '../src/identity/namesApi';
import { fakeFetch } from './helpers';

const BASE = 'https://proxy.test';
const ADDRESS = '0x00000000000000000000000000000000000000Aa';
const CLAIM = { label: 'fabien', address: ADDRESS, issuedAt: 1700000000000, signature: '0xab' as const };

let sent: { url: string; init: RequestInit | undefined }[] = [];
let reply = (): Response => Response.json({});
const realFetch = globalThis.fetch;

beforeEach(() => {
  sent = [];
  globalThis.fetch = fakeFetch(async (input, init) => {
    sent.push({ url: String(input), init });
    return reply();
  });
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('issued names', () => {
  test('reads the name and the address the service issued', async () => {
    reply = () => Response.json({ name: 'fabien.stage.base.eth' });
    expect(await fetchIssuedName(BASE, ADDRESS)).toBe('fabien.stage.base.eth');
    reply = () => Response.json({ address: ADDRESS.toLowerCase() });
    expect(await fetchIssuedAddress(BASE, 'fabien')).toBe(ADDRESS.toLowerCase());
    expect(sent.map((request) => request.url)).toEqual([`${BASE}/names/status?address=${ADDRESS}`, `${BASE}/names/resolve?label=fabien`]);
  });

  test('the service answering no name is no name', async () => {
    reply = () => Response.json({ name: null });
    expect(await fetchIssuedName(BASE, ADDRESS)).toBeNull();
    reply = () => Response.json({ address: null });
    expect(await fetchIssuedAddress(BASE, 'fabien')).toBeNull();
  });

  test('a failed or malformed answer is an error, not no name', async () => {
    reply = () => new Response('', { status: 503 });
    await expect(fetchIssuedName(BASE, ADDRESS)).rejects.toThrow('name service responded 503');
    await expect(fetchIssuedAddress(BASE, 'fabien')).rejects.toThrow('name service responded 503');
    reply = () => Response.json({ name: '' });
    await expect(fetchIssuedName(BASE, ADDRESS)).rejects.toThrow('invalid payload');
    reply = () => Response.json({});
    await expect(fetchIssuedAddress(BASE, 'fabien')).rejects.toThrow('invalid payload');
  });
});

describe('availability', () => {
  test('sends the client headers and validates the answer', async () => {
    reply = () => Response.json({ valid: true, available: false });
    expect(await fetchNameCheck(BASE, 'fabien')).toEqual({ valid: true, available: false });
    expect(sent[0]?.init?.headers).toEqual({ 'content-type': 'application/json', 'x-stage-client': '1' });
    reply = () => new Response('', { status: 502 });
    await expect(fetchNameCheck(BASE, 'fabien')).rejects.toThrow('name service responded 502');
  });
});

describe('claims', () => {
  test('posts the signed claim and confirms the issued name', async () => {
    reply = () => Response.json({ name: 'fabien.stage.base.eth', mailKey: 'failed' });
    expect(await postNameClaim(BASE, CLAIM)).toEqual({ kind: 'claimed', name: 'fabien.stage.base.eth', mailKeyFailed: true });
    expect(sent[0]?.init?.body).toBe(`{"label":"fabien","address":"${ADDRESS}","issuedAt":1700000000000,"signature":"0xab"}`);
  });

  test('tells a taken name from other refusals and unconfirmed replies', async () => {
    reply = () => Response.json({ error: NAME_TAKEN }, { status: 409 });
    expect(await postNameClaim(BASE, CLAIM)).toEqual({ kind: 'taken' });
    reply = () => Response.json({ error: 'this address already has a name' }, { status: 409 });
    expect(await postNameClaim(BASE, CLAIM)).toEqual({ kind: 'refused', status: 409, error: 'this address already has a name' });
    reply = () => Response.json({ name: 'other.stage.base.eth' });
    expect(await postNameClaim(BASE, CLAIM)).toEqual({ kind: 'unconfirmed' });
  });

  test('runs through the caller transport', async () => {
    const urls: string[] = [];
    const request: NamesRequest = (url, _init, read) => {
      urls.push(url);
      return read(Response.json({ name: 'fabien.stage.base.eth' }));
    };
    expect((await postNameClaim(BASE, CLAIM, request)).kind).toBe('claimed');
    expect(urls).toEqual([`${BASE}/names/claim`]);
    expect(sent).toEqual([]);
  });
});
