import { useRef } from 'react';
import type { RenderedNode } from '../layout/webChrome';
import type { Arrow, KeyEventLike, KeyTarget, MarkedNode, Shortcut } from './keys.model';

export function useShortcut(shortcut: Shortcut | undefined, action: (() => void) | undefined): React.RefObject<RenderedNode | null> {
  void shortcut;
  void action;
  return useRef<RenderedNode>(null);
}

export function useArrowKeys<A extends Arrow>(active: boolean, arrows: ReadonlySet<A>, onArrow: (arrow: A) => void): void {
  void active;
  void arrows;
  void onArrow;
}

export function useKeyStep(
  active: boolean,
  stepOf: (event: KeyEventLike, target: KeyTarget | null) => number,
  onStep: (delta: number) => void,
): void {
  void active;
  void stepOf;
  void onStep;
}

export function revealMarked(node: MarkedNode): boolean {
  void node;
  return false;
}
