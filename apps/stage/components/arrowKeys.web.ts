import { useEffect, useRef } from 'react';
import { arrowKeyOf, revealScrollDelta, type Arrow, type MarkedNode } from './arrowKeys.model';
import { keyTarget, modalOpen } from './keyEvents.web';

export function useArrowKeys<A extends Arrow>(active: boolean, arrows: ReadonlySet<A>, onArrow: (arrow: A) => void): void {
  const handler = useRef(onArrow);
  handler.current = onArrow;
  useEffect(() => {
    if (!active) return undefined;
    const onKeyDown = (event: KeyboardEvent): void => {
      const arrow = arrowKeyOf(event, keyTarget(event.target), arrows);
      if (arrow === null || modalOpen()) return;
      event.preventDefault();
      handler.current(arrow);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return (): void => { window.removeEventListener('keydown', onKeyDown, true); };
  }, [active, arrows]);
}

function scrollerOf(node: HTMLElement): HTMLElement | null {
  for (let el = node.parentElement; el !== null; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) return el;
  }
  return null;
}

export function revealMarked({ dataSet }: MarkedNode): boolean {
  const selector = Object.entries(dataSet).map(([name, value]) => `[data-${name}="${CSS.escape(value)}"]`).join('');
  const node = document.querySelector<HTMLElement>(selector);
  if (node === null) return false;
  const scroller = scrollerOf(node);
  if (scroller === null) return true;
  const item = node.getBoundingClientRect();
  const view = scroller.getBoundingClientRect();
  scroller.scrollTop += revealScrollDelta(item.top, item.bottom, view.top, view.bottom);
  return true;
}
