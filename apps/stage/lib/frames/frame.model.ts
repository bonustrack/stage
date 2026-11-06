import { nodeUrlOf, type NodeRequest } from '@stage-labs/client/nodes/protocol';
import type { HistoryEntry } from '@stage-labs/client/types';
import { frameActionSchema, frameContentSchema, type FrameActionContent, type FrameContent } from '@stage-labs/client/xmtp/frame.schema';
import type { TransportMetadata } from '@stage-labs/kit/a2ui/client';
import type { RendererMessage } from '@stage-labs/kit/a2ui/protocol';
import { a2uiSnapshot } from '@stage-labs/kit/a2ui/snapshot';
import { frameFieldOf, isFrameActionEntry as hasFrameAction } from '@stage-labs/client/xmtp/entryPayload';

export interface FrameOut {
  message: RendererMessage;
  metadata?: TransportMetadata;
  label?: string;
}

export type FrameMessageHandler = (out: FrameOut) => Promise<void> | void;

const parsedFrames = new WeakMap<object, FrameContent | null>();

export function frameOf(entry: HistoryEntry | undefined): FrameContent | null {
  const frame = frameFieldOf(entry);
  if (frame === null) return null;
  const known = parsedFrames.get(frame);
  if (known !== undefined) return known;
  const parsed = frameContentSchema.safeParse(frame);
  const result = parsed.success ? parsed.data : null;
  parsedFrames.set(frame, result);
  return result;
}

export function isFrameActionEntry(entry: HistoryEntry): boolean {
  return hasFrameAction(entry);
}

export function filledText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

export interface FrameNodeLink {
  url: string;
  host: string;
}

export function frameNodeOf(frame: FrameContent): FrameNodeLink | null {
  if (frame.source === undefined) return null;
  const node = nodeUrlOf(frame.source.url);
  return node.ok ? { url: node.url, host: node.host } : null;
}

export function frameLocked(frame: FrameContent, consentAllowed: boolean | undefined): boolean {
  return frameNodeOf(frame) === null ? consentAllowed === false : consentAllowed !== true;
}

function frameDataModelOf(out: FrameOut): Record<string, unknown> | undefined {
  return out.metadata?.a2uiRendererDataModel.surfaces;
}

export function frameActionContent(frameId: string, out: FrameOut): FrameActionContent | null {
  if (!('action' in out.message)) return null;
  const label = filledText(out.label);
  const dataModel = frameDataModelOf(out);
  const parsed = frameActionSchema.safeParse({
    frameId,
    action: out.message.action,
    ...(label === undefined ? {} : { label }),
    ...(dataModel === undefined ? {} : { dataModel }),
  });
  return parsed.success ? parsed.data : null;
}

export function nodeRequestOf(out: FrameOut): NodeRequest {
  return { message: out.message, dataModel: frameDataModelOf(out) };
}

export function frameRenders(frame: Pick<FrameContent, 'messages'>): boolean {
  const snapshot = a2uiSnapshot(frame.messages);
  return snapshot.messages.length > 0 && snapshot.fits;
}
