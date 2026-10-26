import { beforeEach, describe, expect, test } from 'bun:test';
import type { RendererMessage } from '@stage-labs/kit/a2ui/protocol';
import { ROOT_SCOPE } from '@stage-labs/kit/a2ui/evaluate';
import type { FrameContent, FrameMessage } from '@stage-labs/client/xmtp/frame';
import {
  RENDERER_CAPABILITIES, activateFrameSessionHost, applyToFrameSession, clearFrameSessions, engageFrameSession, frameSession, rejectAgentCall, setFrameSessionHost, streamInto,
  type FrameSessionHost,
} from '../lib/frameSession';
import { KIT_CATALOG, titleMessages } from './frameFixtures';

const QUOTE = { '@call': 'quote', catalogId: KIT_CATALOG, args: { coin: 'BTC' } };

const FRAME: FrameContent = { messages: titleMessages('Price') };

function recorder(): { host: FrameSessionHost; sent: RendererMessage[] } {
  const sent: RendererMessage[] = [];
  return { sent, host: { accepts: () => true, send: (message) => { sent.push(message); }, navigate: () => undefined, openUrl: () => undefined } };
}

function callIdOf(message: RendererMessage | undefined): string {
  return message !== undefined && 'callAgentFunction' in message ? message.callAgentFunction.functionCallId : '';
}

describe('frame sessions', () => {
  beforeEach(() => { clearFrameSessions(); });

  test('one live client per key, kept while the frame is the same', () => {
    const client = frameSession('m1', FRAME);
    expect(frameSession('m1', structuredClone(FRAME))).toBe(client);
    expect(frameSession('m2', FRAME)).not.toBe(client);
    expect(frameSession('m1', { messages: titleMessages('Other') })).not.toBe(client);
  });

  test('an agent function goes out once, waits for the host, and settles from the reply', () => {
    const client = frameSession('m1', FRAME);
    expect(client.resolve('main', QUOTE, ROOT_SCOPE)).toBeUndefined();
    const { host, sent } = recorder();
    setFrameSessionHost('m1', host);
    expect(sent).toHaveLength(1);
    expect(client.resolve('main', QUOTE, ROOT_SCOPE)).toBeUndefined();
    expect(sent).toHaveLength(1);
    const answer = { version: 'v1.0', agentFunctionResponse: { functionCallId: callIdOf(sent[0]), value: 64_210 } };
    expect(applyToFrameSession('m1', [answer])).toEqual({ kind: 'unchanged' });
    expect(client.resolve('main', QUOTE, ROOT_SCOPE)).toBe(64_210);
  });

  test('a call nobody answers settles as an error instead of waiting forever', () => {
    const client = frameSession('m1', FRAME);
    const { host, sent } = recorder();
    setFrameSessionHost('m1', host);
    client.resolve('main', QUOTE, ROOT_SCOPE);
    rejectAgentCall('m1', callIdOf(sent[0]));
    expect(client.resolve('main', QUOTE, ROOT_SCOPE)).toBeNull();
  });

  test('a renderer function call from the node is answered to the host, with the caller rules applied', () => {
    frameSession('m1', FRAME);
    const { host, sent } = recorder();
    setFrameSessionHost('m1', host);
    const call = (id: string, name: string) => ({ version: 'v1.0', callRendererFunction: { functionCallId: id, callFunction: { '@call': name, catalogId: KIT_CATALOG, args: { value: 1234.5 } } } });
    applyToFrameSession('m1', [call('r1', 'formatNumber'), call('r2', 'openSurface')]);
    expect(sent).toEqual([
      { version: 'v1.0', rendererFunctionResponse: { functionCallId: 'r1', value: expect.stringContaining('1') } },
      { version: 'v1.0', rendererFunctionResponse: { functionCallId: 'r2', error: { code: 'INVALID_FUNCTION_CALL', message: expect.stringContaining('rendererOnly') } } },
    ]);
  });

  test('surface messages update the stored frame, and a reply that leaves nothing to show is refused', () => {
    frameSession('m1', FRAME);
    const updated = applyToFrameSession('m1', [{ version: 'v1.0', updateComponents: { surfaceId: 'main', components: [{ id: 'root', component: 'Title', text: 'New' }] } }]);
    expect(updated).toEqual({ kind: 'frame', frame: { messages: titleMessages('New') } });
    expect(applyToFrameSession('m1', [{ version: 'v1.0', deleteSurface: { surfaceId: 'main' } }])).toEqual({ kind: 'invalid' });
    expect(applyToFrameSession('missing', [])).toEqual({ kind: 'invalid' });
  });

  test('the renderer advertises the basic and Kit catalogs', () => {
    expect(RENDERER_CAPABILITIES).toEqual({
      'v1.0': { supportedCatalogIds: ['https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json', KIT_CATALOG] },
    });
  });

  test('a load keeps showing the old client until the new one renders, then takes over', async () => {
    const shown = frameSession('m1', FRAME);
    const frames: unknown[] = [];
    const surface = { version: 'v1.0', createSurface: { surfaceId: 'main', catalogId: KIT_CATALOG } };
    const root = { version: 'v1.0', updateComponents: { surfaceId: 'main', components: [{ id: 'root', component: 'Title', text: 'Loaded' }] } };
    const { applied } = await streamInto('m1', true, (frame) => { frames.push(frame); }, (onMessage) => {
      onMessage(surface);
      expect(frameSession('m1', FRAME)).toBe(shown);
      onMessage(root);
      return Promise.resolve({ ok: true, reply: { kind: 'streamed', load: true } });
    });
    expect(applied).toEqual({ kind: 'frame', frame: { messages: titleMessages('Loaded') } });
    expect(frames).toEqual([{ messages: titleMessages('Loaded') }]);
    expect(frameSession('m1', { messages: titleMessages('Loaded') })).not.toBe(shown);
  });

  test('a load that renders nothing is dropped and leaves the shown frame alone', async () => {
    const shown = frameSession('m1', FRAME);
    const late: { push?: (message: FrameMessage) => void } = {};
    const { applied } = await streamInto('m1', true, () => undefined, (onMessage) => {
      late.push = onMessage;
      return Promise.resolve({ ok: true, reply: { kind: 'streamed', load: true } });
    });
    late.push?.(titleMessages('Late')[0] ?? {});
    expect(applied).toEqual({ kind: 'unchanged' });
    expect(frameSession('m1', FRAME)).toBe(shown);
  });

  test('a gated host gets only taps until the frame is engaged, then the held messages', () => {
    const client = frameSession('m1', FRAME);
    const { host, sent } = recorder();
    setFrameSessionHost('m1', { ...host, accepts: (message, engaged) => engaged || 'action' in message });
    client.resolve('main', QUOTE, ROOT_SCOPE);
    expect(sent).toEqual([]);
    engageFrameSession('m1');
    expect(sent).toHaveLength(1);
  });

  test('the newest host gets messages, and the one below takes over when it leaves', () => {
    const client = frameSession('m1', FRAME);
    const bubble = recorder();
    const page = recorder();
    setFrameSessionHost('m1', bubble.host);
    const leave = setFrameSessionHost('m1', page.host);
    client.resolve('main', QUOTE, ROOT_SCOPE);
    leave();
    client.resolve('main', { ...QUOTE, args: { coin: 'ETH' } }, ROOT_SCOPE);
    expect([bubble.sent.length, page.sent.length]).toEqual([1, 1]);
  });
  test('a host stays registered when its session is rebuilt, and the touched view takes over', () => {
    const { host, sent } = recorder();
    frameSession('m1', FRAME);
    setFrameSessionHost('m1', host);
    const rebuilt = frameSession('m1', { messages: titleMessages('Other') });
    rebuilt.resolve('main', QUOTE, ROOT_SCOPE);
    expect(sent).toHaveLength(1);
    const other = recorder();
    setFrameSessionHost('m1', other.host);
    activateFrameSessionHost('m1', host);
    rebuilt.resolve('main', { ...QUOTE, args: { coin: 'SOL' } }, ROOT_SCOPE);
    expect([sent.length, other.sent.length]).toEqual([2, 0]);
  });
});

