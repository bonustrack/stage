import { z } from 'zod';

export const FRAME_MAX_CHARS = 64 * 1024;

export const FRAME_ACTION_MAX_CHARS = 16 * 1024;

export const FRAME_MAX_COMPONENTS = 500;

export const A2UI_MESSAGE_VERSION = 'v1.0';

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 1000;
const MAX_ID = 200;
const MAX_ACTION_NAME = 120;
const MAX_MESSAGES = 200;
const MAX_SURFACE_ID = 120;
const MAX_SOURCE_URL = 2048;
const MAX_TIMESTAMP = 64;

function jsonChars(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? Number.POSITIVE_INFINITY;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

const clipped = (max: number) => z.string().transform(s => s.trim().slice(0, max));

const surfaceIdSchema = z.string().min(1).max(MAX_SURFACE_ID);
const functionCallIdSchema = z.string().min(1).max(MAX_ID);

type MessageKinds = Readonly<Record<string, (body: Record<string, unknown>) => boolean>>;

const withSurface = (body: Record<string, unknown>): boolean => surfaceIdSchema.safeParse(body.surfaceId).success;
const withCallId = (body: Record<string, unknown>): boolean => functionCallIdSchema.safeParse(body.functionCallId).success;
const anyBody = (): boolean => true;

const SURFACE_KINDS: MessageKinds = { createSurface: withSurface, updateComponents: withSurface, updateDataModel: withSurface, deleteSurface: withSurface };
const REPLY_KINDS: MessageKinds = { ...SURFACE_KINDS, callRendererFunction: withCallId, agentFunctionResponse: withCallId };
const RENDERER_KINDS: MessageKinds = { action: withSurface, callAgentFunction: withCallId, rendererFunctionResponse: withCallId, error: anyBody };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function a2uiMessage(kinds: MessageKinds, extraKeys: readonly string[]) {
  return z.record(z.string(), z.unknown()).refine(m => {
    const present = Object.keys(kinds).filter(kind => m[kind] !== undefined);
    const kind = present[0];
    const check = kind === undefined ? undefined : kinds[kind];
    const body = kind === undefined ? undefined : m[kind];
    const extras = Object.keys(m).filter(key => key !== 'version' && key !== kind);
    return m.version === A2UI_MESSAGE_VERSION && present.length === 1 && check !== undefined && isRecord(body) && check(body)
      && extras.every(key => extraKeys.includes(key));
  }, { message: `not one A2UI ${A2UI_MESSAGE_VERSION} message of an allowed kind` });
}

const messageSchema = a2uiMessage(SURFACE_KINDS, []);

export type FrameMessage = z.infer<typeof messageSchema>;

export const SURFACE_MESSAGE_KINDS: readonly string[] = Object.keys(SURFACE_KINDS);

export function isSurfaceMessage(message: Record<string, unknown>): boolean {
  return SURFACE_MESSAGE_KINDS.some(kind => message[kind] !== undefined);
}

export const nodeReplyMessagesSchema = z.array(a2uiMessage(REPLY_KINDS, [])).max(MAX_MESSAGES)
  .refine(m => jsonChars(m) <= FRAME_MAX_CHARS, { message: `a reply is larger than ${FRAME_MAX_CHARS} characters` })
  .refine(m => componentCount(m) <= FRAME_MAX_COMPONENTS, { message: `a reply has at most ${FRAME_MAX_COMPONENTS} components` });

export const rendererMessageSchema = a2uiMessage(RENDERER_KINDS, ['metadata']);

function componentCount(messages: readonly Record<string, unknown>[]): number {
  return messages.reduce((sum, m) => {
    const body = (m.createSurface ?? m.updateComponents) as { components?: unknown } | undefined;
    return sum + (Array.isArray(body?.components) ? body.components.length : 0);
  }, 0);
}

const messagesSchema = z.array(messageSchema).min(1).max(MAX_MESSAGES)
  .refine(m => jsonChars(m) <= FRAME_MAX_CHARS, { message: `frame messages are larger than ${FRAME_MAX_CHARS} characters` })
  .refine(m => componentCount(m) <= FRAME_MAX_COMPONENTS, { message: `a frame has at most ${FRAME_MAX_COMPONENTS} components` });

export const frameSourceSchema = z.object({ url: z.string().trim().min(1).max(MAX_SOURCE_URL) });

export const frameContentSchema = z.object({
  title: clipped(MAX_TITLE).optional(),
  description: clipped(MAX_DESCRIPTION).optional(),
  messages: messagesSchema,
  start: surfaceIdSchema.optional(),
  source: frameSourceSchema.optional().catch(undefined),
});

export type FrameContent = z.infer<typeof frameContentSchema>;

export const frameActionSchema = z.object({
  frameId: z.string().min(1).max(MAX_ID),
  action: z.object({
    name: z.string().min(1).max(MAX_ACTION_NAME),
    surfaceId: surfaceIdSchema,
    sourceComponentId: z.string().min(1).max(MAX_ID),
    timestamp: z.string().max(MAX_TIMESTAMP),
    context: z.record(z.string(), z.unknown()),
    userMessage: clipped(MAX_DESCRIPTION).optional(),
  }),
  dataModel: z.record(z.string(), z.unknown()).optional(),
  label: clipped(MAX_TITLE).optional(),
}).refine(a => jsonChars(a) <= FRAME_ACTION_MAX_CHARS, { message: 'frame action is too large' });

export type FrameActionContent = z.infer<typeof frameActionSchema>;
