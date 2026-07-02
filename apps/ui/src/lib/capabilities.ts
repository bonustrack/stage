
import type { Capabilities } from '@stage-labs/views';
import { router } from '@/router';

export const capabilities: Capabilities = {
  navigate: (to) => { void router.push(to); },
  back: () => { router.back(); },
  copyToClipboard: async (text) => {
    if (navigator.clipboard) await navigator.clipboard.writeText(text);
  },
  toast: () => undefined,
  confirm: (options) => {
    const text = options.message ? `${options.title}\n\n${options.message}` : options.title;
    return Promise.resolve(window.confirm(text));
  },
  openUrl: (url) => { window.open(url, '_blank', 'noopener,noreferrer'); },
  share: async (payload) => {
    const text = payload.url ?? payload.text ?? '';
    if (!text) return;
    if (navigator.share) await navigator.share({ url: payload.url, text: payload.text });
    else if (navigator.clipboard) await navigator.clipboard.writeText(text);
  },
};
