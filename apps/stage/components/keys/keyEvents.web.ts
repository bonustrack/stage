import type { ArrowKeyTarget } from './arrowKeys.model';

export function keyTarget(target: EventTarget | null): ArrowKeyTarget | null {
  if (!(target instanceof HTMLElement)) return null;
  const value = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target.value : null;
  return { tagName: target.tagName, contentEditable: target.isContentEditable, text: value ?? target.textContent ?? '' };
}

export const modalOpen = (): boolean => document.querySelector('[aria-modal="true"]') !== null;

export const isShown = (node: unknown): boolean => node instanceof HTMLElement && node.getClientRects().length > 0;
