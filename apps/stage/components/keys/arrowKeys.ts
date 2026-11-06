import type { Arrow, MarkedNode } from './arrowKeys.model';

export function useArrowKeys<A extends Arrow>(active: boolean, arrows: ReadonlySet<A>, onArrow: (arrow: A) => void): void {
  void active;
  void arrows;
  void onArrow;
}

export function revealMarked(node: MarkedNode): boolean {
  void node;
  return false;
}
