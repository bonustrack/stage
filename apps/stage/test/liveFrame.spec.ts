import { beforeEach, describe, expect, test } from 'bun:test';
import type { NodeRequest, NodeResult } from '@stage-labs/client/nodes/protocol';
import type { FrameContent, FrameMessage } from '@stage-labs/client/xmtp/frame';
import { applyToFrameSession, clearFrameSessions, frameSession } from '../lib/frameSession';
import { makeLiveFrames } from '../lib/liveFrame.core';
import { KIT_CATALOG, REFUSED_MESSAGES, actionOf, tapOf, titleMessages } from './frameFixtures';

const NODE = 'https://eth.example.com/price';
const SENT: FrameContent = { messages: titleMessages('$100'), source: { url: NODE } };
const NEXT = titleMessages('$101');
const LATER = titleMessages('$102');

interface NodeCall { method: 'GET' | 'POST'; url: string; key: string; request?: NodeRequest }

const frameReply = (messages: FrameMessage[]): NodeResult => ({ ok: true, reply: { kind: 'frame', frame: { messages } } });

function harness() {
  const calls: NodeCall[] = [];
  const toasts: string[] = [];
  let answer: () => Promise<NodeResult> = () => Promise.resolve(frameReply(NEXT));
  let keys = 0;
  const frames = makeLiveFrames({
    load: (url, key) => { calls.push({ method: 'GET', url, key }); return answer(); },
    send: (url, key, request) => { calls.push({ method: 'POST', url, key, request }); return answer(); },
    apply: applyToFrameSession,
    newKey: () => { keys += 1; return `key${keys}`; },
    now: () => 5_000,
    toast: (message) => { toasts.push(message); },
  });
  return { frames, calls, toasts, reply: (next: () => Promise<NodeResult>) => { answer = next; } };
}

describe('live frames in chats', () => {
  beforeEach(() => { clearFrameSessions(); });

  test('nothing is shown or called before a tap', () => {
    const h = harness();
    expect(h.frames.frameOf('m1')).toBeNull();
    expect(h.calls).toEqual([]);
  });

  test('a refresh loads the node with the frame key and shows the reply in place', async () => {
    const h = harness();
    let updates = 0;
    h.frames.subscribe(() => { updates += 1; });
    await h.frames.refresh('m1', SENT, NODE);
    expect(h.calls).toEqual([{ method: 'GET', url: NODE, key: 'key1' }]);
    expect(h.frames.frameOf('m1')).toEqual({ messages: NEXT });
    expect(updates).toBe(1);
    expect(h.toasts).toEqual([]);
  });

  test('a tap posts the A2UI message, and each frame keeps its own key', async () => {
    const h = harness();
    await h.frames.refresh('m1', SENT, NODE);
    await h.frames.send('m1', SENT, NODE, tapOf('buy', { amount: 1 }));
    const metadata = { a2uiRendererDataModel: { version: 'v1.0' as const, surfaces: { main: { amount: 2 } } } };
    await h.frames.send('m2', SENT, NODE, { ...tapOf('buy'), metadata });
    expect(h.calls).toEqual([
      { method: 'GET', url: NODE, key: 'key1' },
      { method: 'POST', url: NODE, key: 'key1', request: { message: { version: 'v1.0', action: actionOf('buy', { amount: 1 }) } } },
      { method: 'POST', url: NODE, key: 'key2', request: { message: { version: 'v1.0', action: actionOf('buy') }, dataModel: { main: { amount: 2 } } } },
    ]);
  });

  test('a reply of A2UI messages applies to the live client, keeps local edits and updates the shown frame', async () => {
    const h = harness();
    const client = frameSession('m1', SENT);
    client.write('main', '/note', 'typed');
    const price = { version: 'v1.0', updateComponents: { surfaceId: 'main', components: [{ id: 'root', component: 'Title', text: { '@path': '/price' } }] } };
    const value = { version: 'v1.0', updateDataModel: { surfaceId: 'main', path: '/price', value: '$103' } };
    h.reply(() => Promise.resolve({ ok: true, reply: { kind: 'messages', messages: [price, value] } }));
    await h.frames.send('m1', SENT, NODE, tapOf('buy'));
    const shown = h.frames.frameOf('m1');
    expect(shown?.source).toEqual({ url: NODE });
    expect(shown?.messages).toEqual([{
      version: 'v1.0',
      createSurface: {
        surfaceId: 'main', catalogId: KIT_CATALOG,
        components: [{ id: 'root', component: 'Title', text: { '@path': '/price' } }], dataModel: { note: 'typed', price: '$103' },
      },
    }]);
    expect(shown === null ? null : frameSession('m1', shown)).toBe(client);
  });

  test('a reply of function answers alone changes nothing that is stored', async () => {
    const h = harness();
    frameSession('m1', SENT);
    const answer = { version: 'v1.0', agentFunctionResponse: { functionCallId: 'unknown', value: 1 } };
    h.reply(() => Promise.resolve({ ok: true, reply: { kind: 'messages', messages: [answer] } }));
    await h.frames.send('m1', SENT, NODE, tapOf('quote'));
    expect(h.frames.frameOf('m1')).toEqual(SENT);
    expect(h.toasts).toEqual([]);
  });

  test('an unchanged reply keeps the frame as it was sent', async () => {
    const h = harness();
    h.reply(() => Promise.resolve({ ok: true, reply: { kind: 'unchanged' } }));
    await h.frames.send('m1', SENT, NODE, tapOf('noop'));
    expect(h.frames.frameOf('m1')).toEqual(SENT);
    expect(h.toasts).toEqual([]);
  });

  test('a failure keeps the shown frame and says why', async () => {
    const h = harness();
    await h.frames.refresh('m1', SENT, NODE);
    h.reply(() => Promise.resolve({ ok: false, problem: 'status', status: 503 }));
    await h.frames.refresh('m1', SENT, NODE);
    h.reply(() => Promise.resolve({ ok: false, problem: 'timeout' }));
    await h.frames.send('m1', SENT, NODE, tapOf('buy'));
    expect(h.frames.frameOf('m1')).toEqual({ messages: NEXT });
    expect(h.toasts).toEqual(['Could not refresh: node error 503', 'Could not send: timed out']);
  });

  test('a reply the frame renderer refuses is not shown', async () => {
    const h = harness();
    h.reply(() => Promise.resolve(frameReply(REFUSED_MESSAGES)));
    await h.frames.refresh('m1', SENT, NODE);
    expect(h.frames.frameOf('m1')).toEqual(SENT);
    expect(h.toasts).toEqual(['Could not refresh: not a widget']);
  });

  test('clearing drops every frame, and a call still running then changes nothing', async () => {
    const h = harness();
    await h.frames.refresh('m1', SENT, NODE);
    const slow = Promise.withResolvers<NodeResult>();
    h.reply(() => slow.promise);
    const pending = h.frames.send('m1', SENT, NODE, tapOf('buy'));
    h.frames.clear();
    expect(h.frames.frameOf('m1')).toBeNull();
    slow.resolve({ ok: false, problem: 'unreachable' });
    await pending;
    expect(h.frames.frameOf('m1')).toBeNull();
    expect(h.toasts).toEqual([]);
    h.reply(() => Promise.resolve(frameReply(LATER)));
    await h.frames.refresh('m1', SENT, NODE);
    expect(h.calls.at(-1)).toEqual({ method: 'GET', url: NODE, key: 'key2' });
  });

  test('only the latest call on a frame updates it', async () => {
    const h = harness();
    const slow = Promise.withResolvers<NodeResult>();
    h.reply(() => slow.promise);
    const first = h.frames.refresh('m1', SENT, NODE);
    h.reply(() => Promise.resolve(frameReply(LATER)));
    await h.frames.send('m1', SENT, NODE, tapOf('next'));
    slow.resolve({ ok: false, problem: 'unreachable' });
    await first;
    expect(h.frames.frameOf('m1')).toEqual({ messages: LATER });
    expect(h.toasts).toEqual([]);
  });
});
