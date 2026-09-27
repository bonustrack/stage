import { useEffect, useRef } from 'react';
import { boardArrowOf, revealScrollDelta, type BoardArrow, type BoardKeyTarget } from './boardKeys.model';

function keyTarget(target: EventTarget | null): BoardKeyTarget | null {
  if (!(target instanceof HTMLElement)) return null;
  const value = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target.value : null;
  return { tagName: target.tagName, contentEditable: target.isContentEditable, text: value ?? target.textContent ?? '' };
}

const modalOpen = (): boolean => document.querySelector('[aria-modal="true"]') !== null;

export function useBoardArrows(active: boolean, onArrow: (arrow: BoardArrow) => void): void {
  const handler = useRef(onArrow);
  handler.current = onArrow;
  useEffect(() => {
    if (!active) return undefined;
    const onKeyDown = (event: KeyboardEvent): void => {
      const arrow = boardArrowOf(event, keyTarget(event.target));
      if (arrow === null || modalOpen()) return;
      event.preventDefault();
      handler.current(arrow);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return (): void => { window.removeEventListener('keydown', onKeyDown, true); };
  }, [active]);
}

function scrollerOf(node: HTMLElement): HTMLElement | null {
  for (let el = node.parentElement; el !== null; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) return el;
  }
  return null;
}

export function revealBoardCard(columnKey: string, convId: string): void {
  const cards = document.querySelectorAll<HTMLElement>(`[data-boardcard="${CSS.escape(convId)}"]`);
  const card = Array.from(cards).find(node => node.dataset.boardcolumn === columnKey);
  const scroller = card === undefined ? null : scrollerOf(card);
  if (card === undefined || scroller === null) return;
  const item = card.getBoundingClientRect();
  const view = scroller.getBoundingClientRect();
  scroller.scrollTop += revealScrollDelta(item.top, item.bottom, view.top, view.bottom);
}
