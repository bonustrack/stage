import { Platform, Vibration } from 'react-native';
import type { SortRect } from '../sortable';
import { isCoarsePointer, measureElement, scrollAt, setCursor, setDocumentDragging, swallowNextClick } from './dom';

export { listenKeys, raiseWithin } from './dom';

const WEB = Platform.OS === 'web';
const EDGE = 48;
const MAX_SCROLL_STEP = 18;
const CLICK_GRACE_MS = 300;

interface Measurable {
  measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void;
}

function isMeasurable(node: unknown): node is Measurable {
  return typeof node === 'object' && node !== null && 'measureInWindow' in node && typeof node.measureInWindow === 'function';
}

export function isTouchPointer(): boolean {
  return isCoarsePointer();
}

export function measureNow(node: unknown): SortRect | null {
  return measureElement(node);
}

export function measureLater(node: unknown): Promise<SortRect | null> {
  if (WEB || !isMeasurable(node)) return Promise.resolve(measureNow(node));
  return new Promise((resolve) => {
    node.measureInWindow((x, y, width, height) => {
      resolve({ x, y, width, height });
    });
  });
}

export const measuresSynchronously = WEB;

export const ghostInViewport = WEB;

export function setPageDragging(on: boolean): void {
  setDocumentDragging(on);
}

export function liftFeedback(): void {
  if (!WEB) Vibration.vibrate(10);
}

export function suppressNextClick(): void {
  swallowNextClick(CLICK_GRACE_MS);
}

function scrollStep(distance: number): number {
  return Math.ceil(((EDGE - distance) / EDGE) * MAX_SCROLL_STEP);
}

function axisStep(low: number, high: number, point: number): number {
  if (point - low < EDGE) return -scrollStep(Math.max(0, point - low));
  if (high - point < EDGE) return scrollStep(Math.max(0, high - point));
  return 0;
}

export function autoScroll(x: number, y: number): boolean {
  return scrollAt(x, y, axisStep);
}

export function nextFrame(run: () => void): () => void {
  if (typeof requestAnimationFrame !== 'function') return () => undefined;
  const id = requestAnimationFrame(run);
  return () => {
    cancelAnimationFrame(id);
  };
}

export function setGrabCursor(node: unknown, on: boolean): void {
  setCursor(node, on ? 'grab' : '');
}
