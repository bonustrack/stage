export type MessageInteraction = 'browser' | 'gestures' | 'selectableText' | 'readonlyInput';

export function nativeInteraction(platform: string, selecting: boolean): MessageInteraction {
  if (!selecting) return 'gestures';
  return platform === 'ios' ? 'readonlyInput' : 'selectableText';
}
