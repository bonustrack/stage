import type { SpeechBridge } from './speech.types';

export const unavailableSpeech: SpeechBridge = {
  availability: () => Promise.resolve({
    available: false, locale: '', download: false,
    reason: 'On-device dictation needs a newer Stage app. You can still type or record a voice message from +.',
  }),
  requestPermission: () => Promise.resolve(false),
  downloadModel: () => Promise.reject(new Error('On-device dictation is unavailable.')),
  start: () => Promise.reject(new Error('On-device dictation is unavailable.')),
  stop: () => Promise.resolve(),
  cancel: () => Promise.resolve(),
  subscribe: () => () => undefined,
};
