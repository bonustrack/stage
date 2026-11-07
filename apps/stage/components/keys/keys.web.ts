import { useEffect, useRef } from 'react';
import {
  arrowKeyOf,
  revealScrollDelta,
  shortcutOf,
  type Arrow,
  type KeyEventLike,
  type KeyTarget,
  type MarkedNode,
  type Shortcut,
} from './keys.model';
import { isRendered, type RenderedNode } from '../layout/webChrome';
import { hideRailTooltip } from '../system/railTooltip';

interface KeyContext {
  event: KeyboardEvent;
  target: KeyTarget | null;
  modal: boolean;
}

type KeyHandler = (key: KeyContext) => boolean;

type Phase = 'capture' | 'bubble';

const handlers: Record<Phase, KeyHandler[]> = { capture: [], bubble: [] };
const listening: Record<Phase, boolean> = { capture: false, bubble: false };

function keyTarget(target: EventTarget | null): KeyTarget | null {
  if (!(target instanceof HTMLElement)) return null;
  const value = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target.value : null;
  return { tagName: target.tagName, contentEditable: target.isContentEditable, text: value ?? target.textContent ?? '' };
}

const modalOpen = (): boolean => document.querySelector('[aria-modal="true"]') !== null;

function dispatch(phase: Phase): (event: KeyboardEvent) => void {
  return (event) => {
    const key = { event, target: keyTarget(event.target), modal: modalOpen() };
    for (const handle of [...handlers[phase]]) if (handle(key)) return;
  };
}

function useKeyHandler(phase: Phase, active: boolean, handle: KeyHandler): void {
  const current = useRef(handle);
  current.current = handle;
  useEffect(() => {
    if (!active) return undefined;
    if (!listening[phase]) {
      window.addEventListener('keydown', dispatch(phase), phase === 'capture');
      listening[phase] = true;
    }
    const entry: KeyHandler = (key) => current.current(key);
    handlers[phase].push(entry);
    return (): void => {
      handlers[phase] = handlers[phase].filter((other) => other !== entry);
    };
  }, [phase, active]);
}

export function useShortcut(shortcut: Shortcut | undefined, action: (() => void) | undefined): React.RefObject<RenderedNode | null> {
  const node = useRef<RenderedNode>(null);
  useKeyHandler('bubble', shortcut !== undefined && action !== undefined, ({ event, target, modal }) => {
    if (shortcutOf(event, target, modal) !== shortcut || !isRendered(node.current)) return false;
    event.preventDefault();
    hideRailTooltip();
    action?.();
    return true;
  });
  return node;
}

export function useArrowKeys<A extends Arrow>(active: boolean, arrows: ReadonlySet<A>, onArrow: (arrow: A) => void): void {
  useKeyHandler('capture', active, ({ event, target, modal }) => {
    const arrow = arrowKeyOf(event, target, arrows);
    if (arrow === null || modal) return false;
    event.preventDefault();
    onArrow(arrow);
    return true;
  });
}

export function useKeyStep(
  active: boolean,
  stepOf: (event: KeyEventLike, target: KeyTarget | null) => number,
  onStep: (delta: number) => void,
): void {
  useKeyHandler('bubble', active, ({ event, target }) => {
    const delta = stepOf(event, target);
    if (delta === 0) return false;
    event.preventDefault();
    onStep(delta);
    return true;
  });
}

function scrollerOf(node: HTMLElement): HTMLElement | null {
  for (let el = node.parentElement; el !== null; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) return el;
  }
  return null;
}

export function revealMarked({ dataSet }: MarkedNode): boolean {
  const selector = Object.entries(dataSet)
    .map(([name, value]) => `[data-${name}="${CSS.escape(value)}"]`)
    .join('');
  const node = document.querySelector<HTMLElement>(selector);
  if (node === null) return false;
  const scroller = scrollerOf(node);
  if (scroller === null) return true;
  const item = node.getBoundingClientRect();
  const view = scroller.getBoundingClientRect();
  scroller.scrollTop += revealScrollDelta(item.top, item.bottom, view.top, view.bottom);
  return true;
}
