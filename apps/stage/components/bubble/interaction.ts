import { Platform } from 'react-native';
import { nativeInteraction, type MessageInteraction } from './messageInteraction.model';

export const textSelectable = false;

export const offersSelectMode = true;

export function messageInteraction(selecting: boolean): MessageInteraction {
  return nativeInteraction(Platform.OS, selecting);
}
