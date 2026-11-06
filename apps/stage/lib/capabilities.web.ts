import { makeCapabilities } from './capabilities.core';
import { presentAlert } from './alertHost';
import { showToast } from './toastHost';

export type { ConfirmOptions } from './capabilities.core';
export { openInBubbleLink } from './capabilities.core';

export const capabilities = makeCapabilities({
  alert: presentAlert,
  toast: showToast,
  reload: (home) => {
    const { location } = window;
    if (home) location.replace(location.origin + location.pathname);
    else location.reload();
  },
});
