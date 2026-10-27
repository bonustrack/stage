import { Platform, Vibration } from 'react-native';
import type { SortRect } from '../sortable';

const WEB = Platform.OS === 'web';
const EDGE = 48;
const MAX_SCROLL_STEP = 18;
const CLICK_GRACE_MS = 300;

interface Measurable {
  measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void;
}

function domOf(node: unknown): HTMLElement | null {
  return WEB && typeof HTMLElement !== 'undefined' && node instanceof HTMLElement ? node : null;
}

function isMeasurable(node: unknown): node is Measurable {
  return typeof node === 'object' && node !== null && 'measureInWindow' in node && typeof node.measureInWindow === 'function';
}

export function isTouchPointer(): boolean {
  if (!WEB) return true;
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

export function measureNow(node: unknown): SortRect | null {
  const el = domOf(node);
  if (el === null) return null;
  const rect = el.getBoundingClientRect();
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

export function measureLater(node: unknown): Promise<SortRect | null> {
  if (WEB || !isMeasurable(node)) return Promise.resolve(measureNow(node));
  return new Promise((resolve) => {
    node.measureInWindow((x, y, width, height) => { resolve({ x, y, width, height }); });
  });
}

export const measuresSynchronously = WEB;

export const ghostInViewport = WEB;

export function pinToViewport(node: unknown): void {
  const el = domOf(node);
  if (el !== null) el.style.position = 'fixed';
}

function blockTouchScroll(event: TouchEvent): void {
  if (event.cancelable) event.preventDefault();
}

export function setPageDragging(on: boolean): void {
  if (!WEB || typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.cursor = on ? 'grabbing' : '';
  root.style.userSelect = on ? 'none' : '';
  if (on) {
    window.getSelection()?.removeAllRanges();
    document.addEventListener('touchmove', blockTouchScroll, { passive: false });
  }
  else {
    document.removeEventListener('touchmove', blockTouchScroll);
  }
}

export function liftFeedback(): void {
  if (!WEB) Vibration.vibrate(10);
}

function swallowClick(event: Event): void {
  event.stopPropagation();
  event.preventDefault();
}

export function suppressNextClick(): void {
  if (!WEB || typeof document === 'undefined') return;
  document.addEventListener('click', swallowClick, { capture: true, once: true });
  setTimeout(() => { document.removeEventListener('click', swallowClick, { capture: true }); }, CLICK_GRACE_MS);
}

function scrollStep(distance: number): number {
  return Math.ceil(((EDGE - distance) / EDGE) * MAX_SCROLL_STEP);
}

function axisStep(low: number, high: number, point: number): number {
  if (point - low < EDGE) return -scrollStep(Math.max(0, point - low));
  if (high - point < EDGE) return scrollStep(Math.max(0, high - point));
  return 0;
}

function scrollable(el: HTMLElement, axis: 'x' | 'y'): boolean {
  const style = getComputedStyle(el);
  const overflow = axis === 'x' ? style.overflowX : style.overflowY;
  const room = axis === 'x' ? el.scrollWidth > el.clientWidth : el.scrollHeight > el.clientHeight;
  return room && (overflow === 'auto' || overflow === 'scroll');
}

function scrollAncestors(x: number, y: number): boolean {
  let el = document.elementFromPoint(x, y);
  let scrolled = false;
  while (el instanceof HTMLElement && !scrolled) {
    const rect = el.getBoundingClientRect();
    const dx = scrollable(el, 'x') ? axisStep(rect.left, rect.right, x) : 0;
    const dy = scrollable(el, 'y') ? axisStep(rect.top, rect.bottom, y) : 0;
    if (dx !== 0 || dy !== 0) {
      const before = el.scrollLeft + el.scrollTop;
      el.scrollBy(dx, dy);
      scrolled = el.scrollLeft + el.scrollTop !== before;
    }
    el = el.parentElement;
  }
  return scrolled;
}

export function autoScroll(x: number, y: number): boolean {
  if (!WEB || typeof document === 'undefined') return false;
  if (scrollAncestors(x, y)) return true;
  const dy = axisStep(0, window.innerHeight, y);
  const dx = axisStep(0, window.innerWidth, x);
  if (dx === 0 && dy === 0) return false;
  const before = window.scrollX + window.scrollY;
  window.scrollBy(dx, dy);
  return window.scrollX + window.scrollY !== before;
}

export function nextFrame(run: () => void): () => void {
  if (typeof requestAnimationFrame !== 'function') return () => undefined;
  const id = requestAnimationFrame(run);
  return () => { cancelAnimationFrame(id); };
}

export function listenKeys(node: unknown, onKey: (key: string) => boolean): () => void {
  const el = domOf(node);
  if (el === null) return () => undefined;
  el.tabIndex = 0;
  const handler = (event: KeyboardEvent): void => {
    if (event.target === el && onKey(event.key)) event.preventDefault();
  };
  el.addEventListener('keydown', handler);
  return () => {
    el.removeEventListener('keydown', handler);
    el.removeAttribute('tabindex');
  };
}

export function setGrabCursor(node: unknown, on: boolean): void {
  const el = domOf(node);
  if (el !== null) el.style.cursor = on ? 'grab' : '';
}

export function raiseWithin(node: unknown, container: unknown): () => void {
  const start = domOf(node);
  const stop = domOf(container);
  if (start === null) return () => undefined;
  const raised: HTMLElement[] = [];
  for (let el: HTMLElement | null = start; el !== null && el !== stop; el = el.parentElement) {
    raised.push(el);
    el.style.zIndex = '10';
  }
  return () => { for (const el of raised) el.style.zIndex = ''; };
}
