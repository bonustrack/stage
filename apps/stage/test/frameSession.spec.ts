import { beforeEach, describe, expect, test } from 'bun:test';
import type { RendererMessage } from '@stage-labs/kit/a2ui/protocol';
import { ROOT_SCOPE } from '@stage-labs/kit/a2ui/evaluate';
import type { FrameContent, FrameMessage } from '@stage-labs/client/xmtp/frame';
import { makeFrameSessions, type FrameSessionHost, type FrameSessions } from '../lib/frames/frameSession';
import { RENDERER_CAPABILITIES } from '../lib/frames/nodeTransport';
import { KIT_CATALOG, titleMessages } from './frameFixtures';

const QUOTE = { '@call': 'quote', catalogId: KIT_CATALOG, args: { coin: 'BTC' } };

const FRAME: FrameContent = { messages: titleMessages('Price') };

function recorder(): { host: FrameSessionHost; sent: RendererMessage[] } {
  const sent: RendererMessage[] = [];
  return {
    sent,
    host: {
      accepts: () => true,
      send: (message) => {
        sent.push(message);
      },
      navigate: () => undefined,
      openUrl: () => undefined,
    },
  };
}

function callIdOf(message: RendererMessage | undefined): string {
  return message !== undefined && 'callAgentFunction' in message ? message.callAgentFunction.functionCallId : '';
}

describe('frame sessions', () => {
  let sessions: FrameSessions = makeFrameSessions();
  beforeEach(() => {
    sessions = makeFrameSessions();
  });

  test('one live client per key, kept while the frame is the same', () => {
    const client = sessions.clientFor('m1', FRAME);
    expect(sessions.clientFor('m1', structuredClone(FRAME))).toBe(client);
    expect(sessions.clientFor('m2', FRAME)).not.toBe(client);
    expect(sessions.clientFor('m1', { messages: titleMessages('Other') })).not.toBe(client);
  });

  test('an agent function goes out once, waits for the host, and settles from the reply', () => {
    const client = sessions.clientFor('m1', FRAME);
    expect(client.resolve('main', QUOTE, ROOT_SCOPE)).toBeUndefined();
    const { host, sent } = recorder();
    sessions.setHost('m1', host);
    expect(sent).toHaveLength(1);
    expect(client.resolve('main', QUOTE, ROOT_SCOPE)).toBeUndefined();
    expect(sent).toHaveLength(1);
    const answer = { version: 'v1.0', agentFunctionResponse: { functionCallId: callIdOf(sent[0]), value: 64_210 } };
    expect(sessions.apply('m1', [answer])).toEqual({ kind: 'unchanged' });
    expect(client.resolve('main', QUOTE, ROOT_SCOPE)).toBe(64_210);
  });

  test('a call nobody answers settles as an error instead of waiting forever', () => {
    const client = sessions.clientFor('m1', FRAME);
    const { host, sent } = recorder();
    sessions.setHost('m1', host);
    client.resolve('main', QUOTE, ROOT_SCOPE);
    sessions.rejectAgentCall('m1', callIdOf(sent[0]));
    expect(client.resolve('main', QUOTE, ROOT_SCOPE)).toBeNull();
  });

  test('a renderer function call from the node is answered to the host, with the caller rules applied', () => {
    sessions.clientFor('m1', FRAME);
    const { host, sent } = recorder();
    sessions.setHost('m1', host);
    const call = (id: string, name: string) => ({
      version: 'v1.0',
      callRendererFunction: { functionCallId: id, callFunction: { '@call': name, catalogId: KIT_CATALOG, args: { value: 1234.5 } } },
    });
    sessions.apply('m1', [call('r1', 'formatNumber'), call('r2', 'openSurface')]);
    expect(sent).toEqual([
      { version: 'v1.0', rendererFunctionResponse: { functionCallId: 'r1', value: expect.stringContaining('1') } },
      {
        version: 'v1.0',
        rendererFunctionResponse: {
          functionCallId: 'r2',
          error: { code: 'INVALID_FUNCTION_CALL', message: expect.stringContaining('rendererOnly') },
        },
      },
    ]);
  });

  test('surface messages update the stored frame, and a reply that leaves nothing to show is refused', () => {
    sessions.clientFor('m1', FRAME);
    const updated = sessions.apply('m1', [
      { version: 'v1.0', updateComponents: { surfaceId: 'main', components: [{ id: 'root', component: 'Title', text: 'New' }] } },
    ]);
    expect(updated).toEqual({ kind: 'frame', frame: { messages: titleMessages('New') } });
    expect(sessions.apply('m1', [{ version: 'v1.0', deleteSurface: { surfaceId: 'main' } }])).toEqual({ kind: 'invalid' });
    expect(sessions.apply('missing', [])).toEqual({ kind: 'invalid' });
  });

  test('nodes are told the renderer draws the Kit catalog', () => {
    expect(JSON.stringify(RENDERER_CAPABILITIES)).toContain(JSON.stringify(KIT_CATALOG));
  });

  test('a load keeps showing the old client until the new one renders, then takes over', async () => {
    const shown = sessions.clientFor('m1', FRAME);
    const frames: unknown[] = [];
    const surface = { version: 'v1.0', createSurface: { surfaceId: 'main', catalogId: KIT_CATALOG } };
    const root = {
      version: 'v1.0',
      updateComponents: { surfaceId: 'main', components: [{ id: 'root', component: 'Title', text: 'Loaded' }] },
    };
    const { applied } = await sessions.streamInto(
      'm1',
      true,
      (frame) => {
        frames.push(frame);
      },
      (onMessage) => {
        onMessage(surface);
        expect(sessions.clientFor('m1', FRAME)).toBe(shown);
        onMessage(root);
        return Promise.resolve({ ok: true, reply: { kind: 'streamed', load: true } });
      },
    );
    expect(applied).toEqual({ kind: 'frame', frame: { messages: titleMessages('Loaded') } });
    expect(frames).toEqual([{ messages: titleMessages('Loaded') }]);
    expect(sessions.clientFor('m1', { messages: titleMessages('Loaded') })).not.toBe(shown);
  });

  test('a load that renders nothing is dropped and leaves the shown frame alone', async () => {
    const shown = sessions.clientFor('m1', FRAME);
    const late: { push?: (message: FrameMessage) => void } = {};
    const { applied } = await sessions.streamInto(
      'm1',
      true,
      () => undefined,
      (onMessage) => {
        late.push = onMessage;
        return Promise.resolve({ ok: true, reply: { kind: 'streamed', load: true } });
      },
    );
    late.push?.(titleMessages('Late')[0] ?? {});
    expect(applied).toEqual({ kind: 'unchanged' });
    expect(sessions.clientFor('m1', FRAME)).toBe(shown);
  });

  test('a gated host gets only taps until the frame is engaged, then the held messages', () => {
    const client = sessions.clientFor('m1', FRAME);
    const { host, sent } = recorder();
    sessions.setHost('m1', { ...host, accepts: (message, engaged) => engaged || 'action' in message });
    client.resolve('main', QUOTE, ROOT_SCOPE);
    expect(sent).toEqual([]);
    sessions.engage('m1');
    expect(sent).toHaveLength(1);
  });

  test('the newest host gets messages, and the one below takes over when it leaves', () => {
    const client = sessions.clientFor('m1', FRAME);
    const bubble = recorder();
    const page = recorder();
    sessions.setHost('m1', bubble.host);
    const leave = sessions.setHost('m1', page.host);
    client.resolve('main', QUOTE, ROOT_SCOPE);
    leave();
    client.resolve('main', { ...QUOTE, args: { coin: 'ETH' } }, ROOT_SCOPE);
    expect([bubble.sent.length, page.sent.length]).toEqual([1, 1]);
  });
  test('a host stays registered when its session is rebuilt, and the touched view takes over', () => {
    const { host, sent } = recorder();
    sessions.clientFor('m1', FRAME);
    sessions.setHost('m1', host);
    const rebuilt = sessions.clientFor('m1', { messages: titleMessages('Other') });
    rebuilt.resolve('main', QUOTE, ROOT_SCOPE);
    expect(sent).toHaveLength(1);
    const other = recorder();
    sessions.setHost('m1', other.host);
    sessions.activateHost('m1', host);
    rebuilt.resolve('main', { ...QUOTE, args: { coin: 'SOL' } }, ROOT_SCOPE);
    expect([sent.length, other.sent.length]).toEqual([2, 0]);
  });
});
