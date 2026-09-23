import { resyncActiveFeeds } from './xmtp.resync';
import type { StreamStatus } from './xmtp.types';

let visibilityHandler: (() => void) | null = null;

export const foregroundWatch = {
  attach(status: StreamStatus): void {
    if (visibilityHandler) return;
    visibilityHandler = (): void => {
      if (document.visibilityState !== 'visible') return;
      void resyncActiveFeeds();
      if (!status.live()) status.ensure();
    };
    document.addEventListener('visibilitychange', visibilityHandler);
  },
  detach(): void {
    if (!visibilityHandler) return;
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  },
};
