import type { XmtpContentTypeId } from './codecs';
import type { FrameActionContent, FrameContent } from './frame.schema';

export type { FrameActionContent, FrameContent } from './frame.schema';

export const FRAME_CONTENT_TYPE: XmtpContentTypeId = {
  authorityId: 'stage.box', typeId: 'frame', versionMajor: 1, versionMinor: 0,
};

export const FRAME_ACTION_CONTENT_TYPE: XmtpContentTypeId = {
  authorityId: 'stage.box', typeId: 'frameAction', versionMajor: 1, versionMinor: 0,
};

export function frameFallbackText(frame: FrameContent): string {
  const title = frame.title === undefined || frame.title === '' ? 'Frame' : `Frame: ${frame.title}`;
  return frame.description ? `${title}\n${frame.description}` : title;
}

export function frameActionText(content: { label?: string; action: { type: string } }): string {
  return content.label === undefined || content.label === '' ? `Tapped ${content.action.type}` : `Tapped "${content.label}"`;
}

export function frameActionFallbackText(content: FrameActionContent): string {
  const payload = content.action.payload === undefined ? '' : ` ${JSON.stringify(content.action.payload)}`;
  return `Frame action: ${content.action.type}${payload}`;
}
