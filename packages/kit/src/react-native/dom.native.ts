import { Vibration } from 'react-native';
import type * as Web from './dom';

export type { DragPlatform, ScreenRect, ScrollStep } from './dom';

const release = (): void => undefined;

export const isCoarsePointer: typeof Web.isCoarsePointer = () => true;

export const measureElement: typeof Web.measureElement = () => null;

export const DRAG_PLATFORM: typeof Web.DRAG_PLATFORM = { measuresSynchronously: false, ghostInViewport: false, nativeDriver: true };

interface Measurable {
  measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void;
}

function isMeasurable(node: unknown): node is Measurable {
  return typeof node === 'object' && node !== null && 'measureInWindow' in node && typeof node.measureInWindow === 'function';
}

export const measureElementLater: typeof Web.measureElementLater = (node) => {
  if (!isMeasurable(node)) return Promise.resolve(null);
  return new Promise((resolve) => {
    node.measureInWindow((x, y, width, height) => {
      resolve({ x, y, width, height });
    });
  });
};

export const liftFeedback: typeof Web.liftFeedback = () => {
  Vibration.vibrate(10);
};

export const liftToBody: typeof Web.liftToBody = () => release;

export const setTouchScrollBlocked: typeof Web.setTouchScrollBlocked = release;

export const setDocumentDragging: typeof Web.setDocumentDragging = release;

export const swallowNextClick: typeof Web.swallowNextClick = release;

export const scrollAt: typeof Web.scrollAt = () => false;

export const listenKeys: typeof Web.listenKeys = () => release;

export const setCursor: typeof Web.setCursor = release;

export const raiseWithin: typeof Web.raiseWithin = () => release;

export const reopenContextMenuAt: typeof Web.reopenContextMenuAt = release;

export const watchVideoSize: typeof Web.watchVideoSize = () => undefined;

export const setVideoPoster: typeof Web.setVideoPoster = release;

export const growToContent: typeof Web.growToContent = () => undefined;
