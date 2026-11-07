export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ScrollStep = (low: number, high: number, point: number) => number;

function elementOf(node: unknown): HTMLElement | null {
  return typeof HTMLElement !== 'undefined' && node instanceof HTMLElement ? node : null;
}

export function isCoarsePointer(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

export function measureElement(node: unknown): ScreenRect | null {
  const el = elementOf(node);
  if (el === null) return null;
  const rect = el.getBoundingClientRect();
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

export interface DragPlatform {
  measuresSynchronously: boolean;
  ghostInViewport: boolean;
}

export const DRAG_PLATFORM: DragPlatform = { measuresSynchronously: true, ghostInViewport: true };

export function measureElementLater(node: unknown): Promise<ScreenRect | null> {
  return Promise.resolve(measureElement(node));
}

export const liftFeedback = (): void => undefined;

export function liftToBody(node: unknown): () => void {
  const el = elementOf(node);
  const home = el?.parentNode;
  if (el === null || home === null || home === undefined) return () => undefined;
  el.style.position = 'fixed';
  document.body.appendChild(el);
  return () => {
    home.appendChild(el);
  };
}

function blockTouchScroll(event: TouchEvent): void {
  if (event.cancelable) event.preventDefault();
}

export function setTouchScrollBlocked(on: boolean): void {
  if (typeof document === 'undefined') return;
  if (on) document.addEventListener('touchmove', blockTouchScroll, { passive: false });
  else document.removeEventListener('touchmove', blockTouchScroll);
}

export function setDocumentDragging(on: boolean): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.cursor = on ? 'grabbing' : '';
  root.style.userSelect = on ? 'none' : '';
  if (on) window.getSelection()?.removeAllRanges();
  setTouchScrollBlocked(on);
}

function swallowClick(event: Event): void {
  event.stopPropagation();
  event.preventDefault();
}

const CLICK_GRACE_MS = 300;

export function swallowNextClick(graceMs = CLICK_GRACE_MS): void {
  if (typeof document === 'undefined') return;
  document.addEventListener('click', swallowClick, { capture: true, once: true });
  setTimeout(() => {
    document.removeEventListener('click', swallowClick, { capture: true });
  }, graceMs);
}

function scrollable(el: HTMLElement, axis: 'x' | 'y'): boolean {
  const style = getComputedStyle(el);
  const overflow = axis === 'x' ? style.overflowX : style.overflowY;
  const room = axis === 'x' ? el.scrollWidth > el.clientWidth : el.scrollHeight > el.clientHeight;
  return room && (overflow === 'auto' || overflow === 'scroll');
}

function scrollAncestors(x: number, y: number, step: ScrollStep): boolean {
  let el = document.elementFromPoint(x, y);
  let scrolled = false;
  while (el instanceof HTMLElement && !scrolled) {
    const rect = el.getBoundingClientRect();
    const dx = scrollable(el, 'x') ? step(rect.left, rect.right, x) : 0;
    const dy = scrollable(el, 'y') ? step(rect.top, rect.bottom, y) : 0;
    if (dx !== 0 || dy !== 0) {
      const before = el.scrollLeft + el.scrollTop;
      el.scrollBy(dx, dy);
      scrolled = el.scrollLeft + el.scrollTop !== before;
    }
    el = el.parentElement;
  }
  return scrolled;
}

export function scrollAt(x: number, y: number, step: ScrollStep): boolean {
  if (typeof document === 'undefined') return false;
  if (scrollAncestors(x, y, step)) return true;
  const dy = step(0, window.innerHeight, y);
  const dx = step(0, window.innerWidth, x);
  if (dx === 0 && dy === 0) return false;
  const before = window.scrollX + window.scrollY;
  window.scrollBy(dx, dy);
  return window.scrollX + window.scrollY !== before;
}

export function listenKeys(node: unknown, onKey: (key: string) => boolean): () => void {
  const el = elementOf(node);
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

export function setCursor(node: unknown, cursor: string): void {
  const el = elementOf(node);
  if (el !== null) el.style.cursor = cursor;
}

export function raiseWithin(node: unknown, container: unknown): () => void {
  const start = elementOf(node);
  const stop = elementOf(container);
  if (start === null) return () => undefined;
  const raised: HTMLElement[] = [];
  for (let el: HTMLElement | null = start; el !== null && el !== stop; el = el.parentElement) {
    raised.push(el);
    el.style.zIndex = '10';
  }
  return () => {
    for (const el of raised) el.style.zIndex = '';
  };
}

export function reopenContextMenuAt(clientX: number, clientY: number): void {
  requestAnimationFrame(() => {
    const target = document.elementFromPoint(clientX, clientY);
    if (!target) return;
    target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX, clientY }));
  });
}

function videoIn(frame: unknown): HTMLVideoElement | null {
  return elementOf(frame)?.querySelector('video') ?? null;
}

export function watchVideoSize(frame: unknown, report: (width: number, height: number) => void): (() => void) | undefined {
  const video = videoIn(frame);
  if (video === null) return undefined;
  const read = (): void => {
    report(video.videoWidth, video.videoHeight);
  };
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) read();
  video.addEventListener('loadedmetadata', read);
  return () => {
    video.removeEventListener('loadedmetadata', read);
  };
}

export function setVideoPoster(frame: unknown, url: string): void {
  const video = videoIn(frame);
  if (video) video.poster = url;
}

export function growToContent(node: unknown, min: number, max: number): number | undefined {
  const el = elementOf(node);
  if (el === null) return undefined;
  el.style.height = 'auto';
  const next = Math.min(max, Math.max(min, el.scrollHeight));
  el.style.height = `${next}px`;
  return next;
}
