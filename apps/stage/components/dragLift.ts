import { Platform, Vibration } from 'react-native';
import { LIST_CELL_SELECTOR } from './layout/VirtualList.model';
import { domElementOf } from './home/listDrag.model';

export const HOLD_MS = 250;
export const MOVE_SLOP = 6;
const CLICK_GRACE_MS = 300;

export function setDragging(on: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('stage-dragging', on);
}

let lifted = false;

export const isLifted = (): boolean => lifted;

function blockScroll(event: TouchEvent): void {
  if (lifted && event.cancelable) event.preventDefault();
}

const WEB = Platform.OS === 'web';

export function lockScrollOnLift(node: unknown): void {
  domElementOf(node, WEB)?.addEventListener('touchmove', blockScroll, { passive: false });
}

let raisedCell: HTMLElement | null = null;

function raiseCell(node: unknown): void {
  raisedCell = domElementOf(node, WEB)?.closest<HTMLElement>(LIST_CELL_SELECTOR) ?? null;
  if (raisedCell !== null) raisedCell.style.zIndex = '1';
}

export function lift(node: unknown): void {
  lifted = true;
  raiseCell(node);
  Vibration.vibrate(10);
}

export function settle(): void {
  lifted = false;
  setDragging(false);
  if (raisedCell !== null) raisedCell.style.zIndex = '';
  raisedCell = null;
}

function swallowClick(event: Event): void {
  event.stopPropagation();
  event.preventDefault();
}

export function suppressNextClick(): void {
  if (typeof document === 'undefined') return;
  document.addEventListener('click', swallowClick, { capture: true, once: true });
  setTimeout(() => { document.removeEventListener('click', swallowClick, { capture: true }); }, CLICK_GRACE_MS);
}
