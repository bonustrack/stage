import type * as Web from './dom';

export type { ScreenRect, ScrollStep } from './dom';

const release = (): void => undefined;

export const isCoarsePointer: typeof Web.isCoarsePointer = () => true;

export const measureElement: typeof Web.measureElement = () => null;

export const liftToBody: typeof Web.liftToBody = () => release;

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
