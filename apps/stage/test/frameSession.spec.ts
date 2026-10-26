import { beforeEach, describe, expect, test } from 'bun:test';
import type { RendererMessage } from '@stage-labs/kit/a2ui/protocol';
import { ROOT_SCOPE } from '@stage-labs/kit/a2ui/evaluate';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import {
  RENDERER_CAPABILITIES, applyToFrameSession, clearFrameSessions, frameSession, rejectAgentCall, setFrameSessionHost, type FrameSessionHost,
} from '../lib/frameSession';
import { KIT_CATALOG, titleMessages } from './frameFixtures';

const QUOTE = { '@call': 'quote', catalogId: KIT_CATALOG, args: { coin: 'BTC' } };

const FRAME: FrameContent = {
  messages: [{
    version: 'v1.0',
    createSurface: { surfaceId: 'main', catalogId: KIT_CATALOG, components: [{ id: 'root', component: 'Title', text: 'Price' }] },
  }],
};

function recorder(): { host: FrameSessionHost; sent: RendererMessage[] } {
  const sent: RendererMessage[] = [];
  return { sent, host: { send: (message) => { sent.push(message); }, navigate: () => undefined, openUrl: () => undefined } };
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
    const call = { version: 'v1.0', callRendererFunction: { functionCallId: 'r1', callFunction: { '@call': 'formatNumber', catalogId: KIT_CATALOG, args: { value: 1234.5 } } } };
    applyToFrameSession('m1', [call]);
    expect(sent).toEqual([{
      version: 'v1.0',
      rendererFunctionResponse: { functionCallId: 'r1', error: { code: 'INVALID_FUNCTION_CALL', message: expect.stringContaining('rendererOnly') } },
    }]);
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
});
