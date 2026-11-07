import { PAGER_ORDER } from './pages';

const SWITCH_FRACTION = 0.2;
const FLING_VELOCITY = 450;
const LAST_INDEX = PAGER_ORDER.length - 1;

export function swipedTabIndex(index: number, width: number, translation: number, velocity: number): number {
  'worklet';
  if (Math.abs(translation) <= width * SWITCH_FRACTION && Math.abs(velocity) <= FLING_VELOCITY) return index;
  if (translation < 0) return Math.min(index + 1, LAST_INDEX);
  if (translation > 0) return Math.max(index - 1, 0);
  return index;
}
