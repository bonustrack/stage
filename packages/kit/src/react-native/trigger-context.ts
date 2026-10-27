import { createContext, useContext } from 'react';

export const TriggerContext = createContext<(() => void) | null>(null);

export function useTriggerPress<T>(onPress: T): T | (() => void) {
  return useContext(TriggerContext) ?? onPress;
}
