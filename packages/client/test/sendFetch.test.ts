import { describe, expect, test } from 'bun:test';
import { createXmtpSendFetch } from '../src/xmtp/sendFetch';

const URL = 'https://api.production.xmtp.network:5558/xmtp.mls.api.v1.MlsApi/SendGroupMessages';
const options = { method: 'POST', headers: { 'content-type': 'application/grpc-web+proto' }, body: new Uint8Array([0, 0, 0, 0, 2, 10, 4]) };
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function reply(status = '0', flags = 128) {
  const text = new TextEncoder().encode(`grpc-status:${status}\r\ngrpc-message:\r\n`);
  const body = new Uint8Array(5 + text.length);
  body[0] = flags;
  new DataView(body.buffer).setUint32(1, text.length);
  body.set(text, 5);
  return new Response(body, { headers: { 'content-type': 'application/grpc-web+proto' } });
}

function pending(signal?: AbortSignal | null): Promise<Response> {
  return new Promise((_resolve, reject) => {
    signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
}

describe('XMTP send transport', () => {
  test('does not add requests to fast sends or background traffic', async () => {
    let calls = 0;
    const transport = createXmtpSendFetch(async () => { calls++; return reply(); }, 5);
    await transport.fetch(URL, options);
    await transport.send(() => transport.fetch(URL, options));
    await wait(15);
    expect(calls).toBe(2);
  });

  test('replays identical encrypted bytes once and cancels the slower request', async () => {
    const bodies: number[][] = [];
    const signals: (AbortSignal | null | undefined)[] = [];
    const transport = createXmtpSendFetch(async (input, init) => {
      signals.push(init?.signal);
      bodies.push(Array.from(new Uint8Array(await new Request(input).arrayBuffer())));
      return bodies.length === 1 ? pending(init?.signal) : reply();
    }, 5);
    const response = await transport.send(() => transport.fetch(URL, options));
    expect(await response.text()).toContain('grpc-status:0');
    await wait(20);
    expect(bodies).toEqual([Array.from(options.body), Array.from(options.body)]);
    expect(signals[0]?.aborted).toBe(true);
  });

  test('does not hedge a fast rate limit or protocol error', async () => {
    for (const response of [new Response('rate limited', { status: 429 }), reply('8')]) {
      let calls = 0;
      const transport = createXmtpSendFetch(async () => { calls++; return response; }, 5);
      const result = await transport.send(() => transport.fetch(URL, options));
      expect(result.status).toBe(response.status);
      expect((await result.text()).length).toBeGreaterThan(0);
      await wait(15);
      expect(calls).toBe(1);
    }
  });

  test('waits for real success when the backup fails', async () => {
    let calls = 0;
    const transport = createXmtpSendFetch(async () => {
      calls++;
      if (calls === 2) return reply('14');
      await wait(20);
      return reply();
    }, 5);
    const result = await transport.send(() => transport.fetch(URL, options));
    expect(await result.text()).toContain('grpc-status:0');
    expect(calls).toBe(2);
  });

  test('preserves the original error when both requests fail', async () => {
    let calls = 0;
    const transport = createXmtpSendFetch(async () => {
      const status = ++calls === 1 ? '8' : '14';
      await wait(10);
      return reply(status);
    }, 5);
    const result = await transport.send(() => transport.fetch(URL, options));
    expect(await result.text()).toContain('grpc-status:8');
    expect(calls).toBe(2);
  });

  test('never treats a status string in message data as confirmation', async () => {
    let calls = 0;
    const transport = createXmtpSendFetch(async () => {
      if (++calls === 2) return reply('14');
      await wait(15);
      return reply('0', 0);
    }, 5);
    const result = await transport.send(() => transport.fetch(URL, options));
    expect(new Uint8Array(await result.arrayBuffer())[0]).toBe(0);
  });

  test('leaves streams, other hosts, mutations and encodings untouched', async () => {
    let calls = 0;
    const transport = createXmtpSendFetch(async () => { calls++; await wait(15); return reply(); }, 5);
    const targets = [
      URL.replace('SendGroupMessages', 'SubscribeGroupMessages'),
      URL.replace('SendGroupMessages', 'SendWelcomeMessages'),
      URL.replace('api.production.xmtp.network', 'example.com'),
    ];
    for (const target of targets) await transport.send(() => transport.fetch(target, options));
    await transport.send(() => transport.fetch(URL, { ...options, headers: { 'content-type': 'text/plain' } }));
    expect(calls).toBe(4);
  });

  test('cancels both requests when the caller aborts', async () => {
    const controller = new AbortController();
    const signals: (AbortSignal | null | undefined)[] = [];
    const transport = createXmtpSendFetch((_input, init) => { signals.push(init?.signal); return pending(init?.signal); }, 5);
    const result = transport.send(() => transport.fetch(URL, { ...options, signal: controller.signal }));
    await wait(15);
    controller.abort(new Error('cancelled'));
    await expect(result).rejects.toThrow('cancelled');
    expect(signals.length).toBe(2);
    expect(signals.every((signal) => signal?.aborted)).toBe(true);
  });

  test('drops send scope after rejection and caps concurrent hedges', async () => {
    let calls = 0;
    const transport = createXmtpSendFetch(async () => { calls++; await wait(15); return reply(); }, 5);
    await transport.send(() => Promise.all([transport.fetch(URL, options), transport.fetch(URL, options)]));
    expect(calls).toBe(3);
    await expect(transport.send(() => Promise.reject(new Error('failed')))).rejects.toThrow('failed');
    await transport.fetch(URL, options);
    expect(calls).toBe(4);
  });
});
