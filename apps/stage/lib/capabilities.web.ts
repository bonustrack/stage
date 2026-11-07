import { makeCapabilities } from './capabilities.core';
import { presentAlert } from './alertHost';
import { showToast } from './toastHost';

export type { ConfirmOptions } from './capabilities.core';
export { openInBubbleLink } from './capabilities.core';

export const capabilities = makeCapabilities({
  alert: presentAlert,
  share: async (text) => {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
    await navigator.share({ text });
    return true;
  },
  toast: showToast,
  reload: (home) => {
    const { location } = window;
    if (home) location.replace(location.origin + location.pathname);
    else location.reload();
  },
});
