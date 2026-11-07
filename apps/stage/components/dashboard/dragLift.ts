import { Vibration } from 'react-native';
import { setTouchScrollBlocked } from '@stage-labs/kit/react-native/dom';
import { setChromeClass } from '../layout/webChrome';

export function setDragging(on: boolean): void {
  setChromeClass('dragging', on);
}

export function lift(): void {
  setTouchScrollBlocked(true);
  Vibration.vibrate(10);
}

export function settle(): void {
  setTouchScrollBlocked(false);
  setDragging(false);
}
