import type { HistoryEntry } from '@stage-labs/client/types';
import { frameActionSchema, frameContentSchema, type FrameActionContent, type FrameContent } from '@stage-labs/client/xmtp/frame.schema';
import { frameSummary, parseFrame, type FrameAction } from '@stage-labs/kit/frame';

export const FRAME_ROUTE = '/frame';

export interface FrameLink {
  pathname: typeof FRAME_ROUTE;
  params: { convId: string; id: string };
}

export interface FrameCardModel {
  title: string;
  description?: string;
}

export function frameOf(entry: HistoryEntry | undefined): FrameContent | null {
  const frame = (entry?.payload as { frame?: unknown } | undefined)?.frame;
  if (frame === undefined) return null;
  const parsed = frameContentSchema.safeParse(frame);
  return parsed.success ? parsed.data : null;
}

function filled(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

export function frameCardModel(frame: FrameContent): FrameCardModel {
  const parsed = parseFrame(frame.widget);
  const derived = parsed.ok ? frameSummary(parsed.root) : {};
  const title = filled(frame.title) ?? filled(derived.title) ?? 'Frame';
  const description = filled(frame.description) ?? filled(derived.description);
  return description === undefined || description === title ? { title } : { title, description };
}

export function frameLinkOf(convId: string, messageId: string): FrameLink {
  return { pathname: FRAME_ROUTE, params: { convId, id: messageId } };
}

export function frameActionContent(frameId: string, action: FrameAction, label: string | undefined): FrameActionContent | null {
  const name = filled(label);
  const act = action.payload === undefined ? { type: action.type } : { type: action.type, payload: action.payload };
  const parsed = frameActionSchema.safeParse(name === undefined ? { frameId, action: act } : { frameId, action: act, label: name });
  return parsed.success ? parsed.data : null;
}
