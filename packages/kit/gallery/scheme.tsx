import { createContext, useContext } from 'react';

export type Scheme = 'light' | 'dark';

export interface SchemeValue {
  scheme: Scheme;
  setScheme: (next: Scheme) => void;
}

export const SchemeContext = createContext<SchemeValue>({ scheme: 'light', setScheme: () => undefined });

export function useScheme(): SchemeValue {
  return useContext(SchemeContext);
}

export function useDark(): boolean {
  return useScheme().scheme === 'dark';
}
