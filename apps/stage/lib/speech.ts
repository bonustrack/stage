import { NativeModule, requireOptionalNativeModule } from 'expo';
import type { SpeechBridge, SpeechEvent } from './speech.types';
import { unavailableSpeech } from './speech.unavailable';

interface SpeechEvents {
  [event: string]: (event: SpeechEvent) => void;
  onSpeech: (event: SpeechEvent) => void;
}

declare class SpeechModule extends NativeModule<SpeechEvents> {
  availability: SpeechBridge['availability'];
  requestPermission: SpeechBridge['requestPermission'];
  downloadModel: SpeechBridge['downloadModel'];
  start: SpeechBridge['start'];
  stop: SpeechBridge['stop'];
  cancel: SpeechBridge['cancel'];
}

const native = requireOptionalNativeModule<SpeechModule>('StageSpeech');

export const speech: SpeechBridge = native ? {
  availability: () => native.availability(),
  requestPermission: () => native.requestPermission(),
  downloadModel: () => native.downloadModel(),
  start: id => native.start(id),
  stop: id => native.stop(id),
  cancel: id => native.cancel(id),
  subscribe: listener => {
    const subscription = native.addListener('onSpeech', listener);
    return () => { subscription.remove(); };
  },
} : unavailableSpeech;
