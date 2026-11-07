import type { RefObject } from 'react';

export interface Measurable {
  measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void;
}

export interface FillViewport {
  onLayout: () => void;
  minHeight?: number;
}

const UNMEASURED: FillViewport = { onLayout: () => undefined };

export function useFillViewport(ref: RefObject<Measurable | null>): FillViewport {
  void ref;
  return UNMEASURED;
}
