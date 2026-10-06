export type MessageInteraction = 'browser' | 'gestures' | 'selectableText' | 'readonlyInput';

export function messageInteraction(platform: string, selecting: boolean): MessageInteraction {
  if (platform === 'web') return 'browser';
  if (!selecting) return 'gestures';
  return platform === 'ios' ? 'readonlyInput' : 'selectableText';
}
