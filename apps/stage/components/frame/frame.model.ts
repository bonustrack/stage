import { nodeUrlOf } from '@stage-labs/client/nodes/protocol';
import type { HistoryEntry } from '@stage-labs/client/types';
import { deletedMessages } from '@stage-labs/client/xmtp/deletions';
import { frameStartSurface, frameSummaryOf } from '@stage-labs/client/xmtp/frame';
import { frameActionSchema, frameContentSchema, type FrameActionContent, type FrameContent } from '@stage-labs/client/xmtp/frame.schema';
import type { NodeRequest } from '@stage-labs/client/nodes/protocol';
import type { SurfaceNav, TransportMetadata } from '@stage-labs/kit/a2ui/client';
import type { RendererMessage } from '@stage-labs/kit/a2ui/protocol';
import { a2uiSnapshot } from '@stage-labs/kit/a2ui/snapshot';
import { ATTACHMENT_MAX_HEIGHT } from '../bubble/imageBox.model';

export const FRAME_ROUTE = '/frame';

export const FRAME_PREVIEW_BORDER = 1;
export const FRAME_PREVIEW_FADE = 48;
export const FRAME_PREVIEW_PADDING = 12;
export const FRAME_PREVIEW_BAR = 40;

const MAX_FRAME_DEPTH = 20;

export type FrameNav = SurfaceNav;

export interface FrameOut {
  message: RendererMessage;
  metadata?: TransportMetadata;
  label?: string;
}

export type FrameMessageHandler = (out: FrameOut) => Promise<void> | void;

export interface FrameLink {
  pathname: typeof FRAME_ROUTE;
  params: { convId: string; id: string };
}

export interface FrameCardModel {
  title: string;
  description?: string;
}

const parsedFrames = new WeakMap<object, FrameContent | null>();

export function frameOf(entry: HistoryEntry | undefined): FrameContent | null {
  const frame = (entry?.payload as { frame?: unknown } | undefined)?.frame;
  if (typeof frame !== 'object' || frame === null) return null;
  const known = parsedFrames.get(frame);
  if (known !== undefined) return known;
  const parsed = frameContentSchema.safeParse(frame);
  const result = parsed.success ? parsed.data : null;
  parsedFrames.set(frame, result);
  return result;
}

export function isFrameActionEntry(entry: HistoryEntry): boolean {
  const action = (entry.payload as { frameAction?: unknown } | undefined)?.frameAction;
  return typeof action === 'object' && action !== null;
}

function filled(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

export function frameCardModel(frame: FrameContent): FrameCardModel {
  const derived = frameSummaryOf(frame);
  const title = filled(frame.title) ?? filled(derived.title) ?? 'Frame';
  const description = filled(frame.description) ?? filled(derived.description);
  return description === undefined || description === title ? { title } : { title, description };
}

export function frameIsDeleted(entry: HistoryEntry, later: readonly HistoryEntry[], ownDeletes: ReadonlySet<string>): boolean {
  return deletedMessages([entry, ...later], { ownDeletes }).has(entry.id);
}

export function frameLinkOf(convId: string, messageId: string): FrameLink {
  return { pathname: FRAME_ROUTE, params: { convId, id: messageId } };
}

export interface FrameNodeLink { url: string; host: string }

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
  const label = filled(out.label);
  const dataModel = frameDataModelOf(out);
  const parsed = frameActionSchema.safeParse({
    frameId, action: out.message.action, ...(label === undefined ? {} : { label }), ...(dataModel === undefined ? {} : { dataModel }),
  });
  return parsed.success ? parsed.data : null;
}

export function nodeRequestOf(out: FrameOut): NodeRequest {
  return { message: out.message, dataModel: frameDataModelOf(out) };
}

export function frameScreenTitle(frame: FrameContent, screen: string): string {
  const card = frameCardModel(frame).title;
  return screen === frameStartSurface(frame) ? card : filled(frameSummaryOf(frame, screen).title) ?? card;
}

export function frameRenders(frame: Pick<FrameContent, 'messages'>): boolean {
  const snapshot = a2uiSnapshot(frame.messages);
  return snapshot.messages.length > 0 && snapshot.fits;
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

export type FrameStacks = ReadonlyMap<string, readonly string[]>;

export function frameStackOf(stack: readonly string[] | undefined, start: string): readonly string[] {
  return stack !== undefined && stack[0] === start ? stack : [start];
}

export function navigateFrame(stack: readonly string[], nav: FrameNav): readonly string[] {
  if (nav.kind === 'close') return stack.length > 1 ? stack.slice(0, -1) : stack;
  if (stack[stack.length - 1] === nav.surfaceId || stack.length >= MAX_FRAME_DEPTH) return stack;
  return [...stack, nav.surfaceId];
}

export function withFrameNav(stacks: FrameStacks, id: string, start: string, nav: FrameNav): FrameStacks {
  const current = frameStackOf(stacks.get(id), start);
  const next = navigateFrame(current, nav);
  if (next === current) return stacks;
  const out = new Map(stacks);
  if (next.length > 1) out.set(id, next);
  else out.delete(id);
  return out;
}
