import { NativeModule, requireOptionalNativeModule } from 'expo';
import type { IncomingShareBridge } from './incomingShare.types';

interface ShareEvents {
  [event: string]: () => void;
  onShareChanged: () => void;
}

declare class ShareModule extends NativeModule<ShareEvents> {
  getPending: IncomingShareBridge['getPending'];
  dismiss: IncomingShareBridge['dismiss'];
}

const native = requireOptionalNativeModule<ShareModule>('StageShare');

export const incomingShare: IncomingShareBridge = {
  getPending: () => native?.getPending() ?? Promise.resolve(null),
  dismiss: (id, keepFiles) => native?.dismiss(id, keepFiles) ?? Promise.resolve(),
  subscribe: (listener) => {
    const subscription = native?.addListener('onShareChanged', listener);
    return () => {
      subscription?.remove();
    };
  },
};
