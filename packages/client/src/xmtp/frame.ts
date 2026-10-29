import type { XmtpContentTypeId } from './codecs';
import type { FrameActionContent, FrameContent, FrameMessage } from './frame.schema';

export type { FrameActionContent, FrameContent, FrameMessage } from './frame.schema';

export const FRAME_CONTENT_TYPE: XmtpContentTypeId = { authorityId: 'stage.box', typeId: 'frame', versionMajor: 2, versionMinor: 0 };

export const FRAME_ACTION_CONTENT_TYPE: XmtpContentTypeId = {
  authorityId: 'stage.box',
  typeId: 'frameAction',
  versionMajor: 2,
  versionMinor: 0,
};

interface Component {
  id?: unknown;
  component?: unknown;
  text?: unknown;
  variant?: unknown;
}

type Body = { surfaceId?: unknown; components?: unknown } | undefined;

export function frameStartSurface(frame: Pick<FrameContent, 'messages' | 'start'>): string | undefined {
  const ids = frame.messages.map((m) => (m.createSurface as Body)?.surfaceId).filter((id): id is string => typeof id === 'string');
  return frame.start !== undefined && ids.includes(frame.start) ? frame.start : ids[0];
}

function surfaceComponents(messages: readonly FrameMessage[], surfaceId: string): Component[] {
  const byId = new Map<unknown, Component>();
  for (const message of messages) {
    const body = (message.createSurface ?? message.updateComponents) as Body;
    if (body?.surfaceId !== surfaceId || !Array.isArray(body.components)) continue;
    for (const c of body.components as Component[]) byId.set(c.id, c);
  }
  return [...byId.values()];
}

export function frameSummaryOf(
  frame: Pick<FrameContent, 'messages' | 'start'>,
  surfaceId = frameStartSurface(frame),
): { title?: string; description?: string } {
  const components = surfaceId === undefined ? [] : surfaceComponents(frame.messages, surfaceId);
  const textsOf = (match: (c: Component) => boolean): string[] =>
    components
      .filter(match)
      .map((c) => (typeof c.text === 'string' ? c.text.trim() : ''))
      .filter((text) => text !== '');
  const texts = textsOf((c) => c.component === 'Text' && c.variant !== 'caption');
  const title = textsOf((c) => c.component === 'Title')[0] ?? texts[0];
  return { title, description: texts.find((text) => text !== title) };
}

export function frameFallbackText(frame: FrameContent): string {
  const title = frame.title === undefined || frame.title === '' ? 'Frame' : `Frame: ${frame.title}`;
  return frame.description ? `${title}\n${frame.description}` : title;
}

export function frameActionText(content: { label?: string; action: { name: string; userMessage?: string } }): string {
  const label = [content.label, content.action.userMessage].find((text) => text !== undefined && text.trim() !== '');
  return label === undefined ? `Tapped ${content.action.name}` : `Tapped "${label}"`;
}

export function frameActionFallbackText(content: FrameActionContent): string {
  const context = Object.keys(content.action.context).length === 0 ? '' : ` ${JSON.stringify(content.action.context)}`;
  return `Frame action: ${content.action.name}${context}`;
}
