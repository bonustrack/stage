import type { IncomingShareBridge } from './incomingShare.types';

export const incomingShare: IncomingShareBridge = {
  getPending: () => Promise.resolve(null),
  dismiss: () => Promise.resolve(),
  subscribe: () => () => { return; },
};
