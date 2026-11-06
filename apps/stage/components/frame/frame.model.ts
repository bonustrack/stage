import { frameStartSurface, frameSummaryOf } from '@stage-labs/client/xmtp/frame';
import type { FrameContent } from '@stage-labs/client/xmtp/frame.schema';
import { filledText } from '../../lib/frames/frame.model';
import { ATTACHMENT_MAX_HEIGHT } from '../media/imageBox.model';

export const FRAME_ROUTE = '/frame';

export const FRAME_PREVIEW_BORDER = 1;
export const FRAME_PREVIEW_FADE = 48;
export const FRAME_PREVIEW_PADDING = 12;
export const FRAME_PREVIEW_BAR = 40;

export interface FrameLink {
  pathname: typeof FRAME_ROUTE;
  params: { convId: string; id: string };
}

export interface FrameCardModel {
  title: string;
  description?: string;
}

export function frameCardModel(frame: FrameContent): FrameCardModel {
  const derived = frameSummaryOf(frame);
  const title = filledText(frame.title) ?? filledText(derived.title) ?? 'Frame';
  const description = filledText(frame.description) ?? filledText(derived.description);
  return description === undefined || description === title ? { title } : { title, description };
}

export function frameLinkOf(convId: string, messageId: string): FrameLink {
  return { pathname: FRAME_ROUTE, params: { convId, id: messageId } };
}

export function frameScreenTitle(frame: FrameContent, screen: string): string {
  const card = frameCardModel(frame).title;
  return screen === frameStartSurface(frame) ? card : (filledText(frameSummaryOf(frame, screen).title) ?? card);
}

export function frameMediaUrl(url: string): string {
  return /^https:\/\/[^/]/i.test(url.trim()) ? url.trim() : '';
}

export function framePreviewCap(depth: number): number {
  return ATTACHMENT_MAX_HEIGHT - 2 * FRAME_PREVIEW_BORDER - (depth > 0 ? FRAME_PREVIEW_BAR : 0);
}

export function frameMoreBelow({ content, viewport, offset }: { content: number; viewport: number; offset: number }): boolean {
  return content - viewport - offset > 1;
}
