import { describe, expect, mock, test } from 'bun:test';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import { titleMessages } from './frameFixtures';

const toasts: string[] = [];
mock.module('../lib/capabilities', () => ({
  capabilities: {
    toast: (message: string) => {
      toasts.push(message);
    },
  },
}));
const { bumpAccountEpoch } = await import('../lib/accountEpoch');
const { chatFrames, frameSessions, frameStacks } = await import('../lib/frames/runtime');

const BLOCKED_NODE = 'http://btc.example.com/';
const SENT: FrameContent = { messages: titleMessages('$100'), source: { url: BLOCKED_NODE } };

describe('frames on an account switch', () => {
  test('the chat frames, frame sessions and screen stacks of the previous account are forgotten', async () => {
    const client = frameSessions.clientFor('0:m1', SENT);
    frameStacks.navigate('m1', 'main', { kind: 'open', surfaceId: 'more' });
    await chatFrames.refresh('0:m1', SENT, BLOCKED_NODE);
    expect([chatFrames.frameOf('0:m1'), frameStacks.stackOf('m1'), toasts]).toEqual([
      SENT,
      ['main', 'more'],
      ['Could not refresh: link blocked'],
    ]);
    bumpAccountEpoch();
    expect([chatFrames.frameOf('0:m1'), frameStacks.stackOf('m1')]).toEqual([null, undefined]);
    expect(frameSessions.clientFor('0:m1', SENT)).not.toBe(client);
  });
});
