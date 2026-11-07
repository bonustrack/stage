import { newNodeKey } from '@stage-labs/client/nodes/protocol';
import { subscribeAccountEpoch } from '../accountEpoch';
import { capabilities } from '../capabilities';
import { makeFrameSessions } from './frameSession';
import { makeFrameStacks } from './frameStacks';
import { makeLiveEngine } from './liveEngine';
import { makeLiveFrames } from './liveFrame.core';
import { frameNodes } from './nodeTransport';

export const frameSessions = makeFrameSessions();

export const frameStacks = makeFrameStacks();

export const liveEngine = makeLiveEngine({
  sessions: frameSessions,
  transport: frameNodes,
  now: () => Date.now(),
  toast: (message) => {
    capabilities.toast(message);
  },
});

export const chatFrames = makeLiveFrames(liveEngine, newNodeKey);

subscribeAccountEpoch(() => {
  chatFrames.clear();
  frameSessions.clear();
  frameStacks.clear();
});
