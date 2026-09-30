import { z } from 'zod';
import type { XmtpContentTypeId } from './codecs';

export const CALL_INVITE_CONTENT_TYPE: XmtpContentTypeId = {
  authorityId: 'stage.box', typeId: 'callInvite', versionMajor: 1, versionMinor: 0,
};

export const CALL_SIGNAL_CONTENT_TYPE: XmtpContentTypeId = {
  authorityId: 'stage.box', typeId: 'callSignal', versionMajor: 1, versionMinor: 0,
};

export const MAX_CALL_PARTICIPANTS = 8;
export const VIDEO_OFF_ABOVE = 6;
export const CALL_RING_TIMEOUT_MS = 45_000;
export const CALL_SIGNAL_MAX_AGE_MS = 60_000;
export const CALL_STALE_MS = 2 * 60 * 60_000;
export const CALL_ICE_GATHER_MS = 2_500;

export const CALL_ICE_SERVERS: readonly { urls: string[] }[] = [
  { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] },
];

const idSchema = z.string().min(8).max(64);
const sdpSchema = z.string().min(1).max(64_000);

export const callInviteSchema = z.object({
  callId: idSchema,
  from: idSchema,
  video: z.boolean(),
});

export type CallInvite = z.infer<typeof callInviteSchema>;

export const callSignalSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('join'), callId: idSchema, from: idSchema }),
  z.object({ kind: z.literal('leave'), callId: idSchema, from: idSchema }),
  z.object({ kind: z.literal('decline'), callId: idSchema }),
  z.object({ kind: z.literal('offer'), callId: idSchema, from: idSchema, to: idSchema, sdp: sdpSchema }),
  z.object({ kind: z.literal('answer'), callId: idSchema, from: idSchema, to: idSchema, sdp: sdpSchema }),
]);

export type CallSignal = z.infer<typeof callSignalSchema>;

export function isCallInviteType(contentTypeId: string | undefined): boolean {
  return typeof contentTypeId === 'string' && contentTypeId.includes(CALL_INVITE_CONTENT_TYPE.typeId);
}

export function isCallSignalType(contentTypeId: string | undefined): boolean {
  return typeof contentTypeId === 'string' && contentTypeId.includes(CALL_SIGNAL_CONTENT_TYPE.typeId);
}

export function isCallSignalEntry(entry: { payload?: unknown }): boolean {
  return isCallSignalType((entry.payload as { contentType?: string } | undefined)?.contentType);
}

export function parseCallInvite(content: unknown): CallInvite | null {
  const parsed = callInviteSchema.safeParse(content);
  return parsed.success ? parsed.data : null;
}

export function parseCallSignal(content: unknown): CallSignal | null {
  const parsed = callSignalSchema.safeParse(content);
  return parsed.success ? parsed.data : null;
}

export function callInviteText(invite: Pick<CallInvite, 'video'>): string {
  return invite.video ? '📞 Video call' : '📞 Voice call';
}

export function callPreviewText(decoded: unknown): string {
  const invite = parseCallInvite(decoded);
  return invite ? callInviteText(invite) : '📞 Call';
}
