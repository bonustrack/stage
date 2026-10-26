import { createContext, createElement, useContext, type ReactNode } from 'react';

const ContentColorContext = createContext<string | undefined>(undefined);

export function ContentColorProvider({ color, children }: { color: string; children: ReactNode }): React.ReactElement {
  return createElement(ContentColorContext.Provider, { value: color }, children);
}

export function useContentColor(): string | undefined {
  return useContext(ContentColorContext);
}
