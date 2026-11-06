import type { MessageInteraction } from './messageInteraction.model';

export const textSelectable = true;

export const offersSelectMode = false;

export function messageInteraction(): MessageInteraction {
  return 'browser';
}
