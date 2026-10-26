import type { XmtpContentTypeId } from './codecs';
import type { FrameActionContent, FrameContent, FrameMessage } from './frame.schema';

export type { FrameActionContent, FrameContent, FrameMessage } from './frame.schema';

export const FRAME_CONTENT_TYPE: XmtpContentTypeId = {
  authorityId: 'stage.box', typeId: 'frame', versionMajor: 2, versionMinor: 0,
};

export const FRAME_ACTION_CONTENT_TYPE: XmtpContentTypeId = {
  authorityId: 'stage.box', typeId: 'frameAction', versionMajor: 2, versionMinor: 0,
};

export interface FrameSummary { title?: string; description?: string }

interface Component { id?: unknown; component?: unknown; text?: unknown; variant?: unknown }

function bodyOf(message: FrameMessage): { surfaceId?: unknown; components?: unknown } | undefined {
  return (message.createSurface ?? message.updateComponents) as { surfaceId?: unknown; components?: unknown } | undefined;
}

export function frameSurfaceIds(messages: readonly FrameMessage[]): string[] {
  const ids = messages.map(m => (m.createSurface as { surfaceId?: unknown } | undefined)?.surfaceId);
  return [...new Set(ids.filter((id): id is string => typeof id === 'string'))];
}

export function frameStartSurface(frame: Pick<FrameContent, 'messages' | 'start'>): string | undefined {
  const ids = frameSurfaceIds(frame.messages);
  return frame.start !== undefined && ids.includes(frame.start) ? frame.start : ids[0];
}

function surfaceComponents(messages: readonly FrameMessage[], surfaceId: string): Component[] {
  const byId = new Map<unknown, Component>();
  for (const message of messages) {
    const body = bodyOf(message);
    if (body?.surfaceId !== surfaceId || !Array.isArray(body.components)) continue;
    for (const c of body.components as Component[]) byId.set(c.id, c);
  }
  return [...byId.values()];
}

function literal(value: unknown): string | undefined {
  const text = typeof value === 'string' ? value.trim() : '';
  return text === '' ? undefined : text;
}

export function frameSummaryOf(frame: Pick<FrameContent, 'messages' | 'start'>, surfaceId = frameStartSurface(frame)): FrameSummary {
  if (surfaceId === undefined) return {};
  const components = surfaceComponents(frame.messages, surfaceId);
  const titles = components.filter(c => c.component === 'Title').map(c => literal(c.text));
  const texts = components.filter(c => c.component === 'Text' && c.variant !== 'caption').map(c => literal(c.text));
  const title = titles.find(t => t !== undefined) ?? texts.find(t => t !== undefined);
  const description = texts.find(t => t !== undefined && t !== title);
  return { ...(title === undefined ? {} : { title }), ...(description === undefined ? {} : { description }) };
}

export function frameFallbackText(frame: FrameContent): string {
  const title = frame.title === undefined || frame.title === '' ? 'Frame' : `Frame: ${frame.title}`;
  return frame.description ? `${title}\n${frame.description}` : title;
}

export function frameActionText(content: { label?: string; action: { name: string; userMessage?: string } }): string {
  const label = content.label ?? content.action.userMessage;
  return label === undefined || label === '' ? `Tapped ${content.action.name}` : `Tapped "${label}"`;
}

export function frameActionFallbackText(content: FrameActionContent): string {
  const context = Object.keys(content.action.context).length === 0 ? '' : ` ${JSON.stringify(content.action.context)}`;
  return `Frame action: ${content.action.name}${context}`;
}
