/** @file Boundary validation helpers (parseOrThrow logs+rethrows, parseOrNull logs+returns null) routing every untrusted payload through here so zod schema drift is logged, never silently mis-typed via an `as`-cast; pure zod + console, no @xmtp/react-native/expo imports. */

import type { ZodType } from 'zod';

/** Where a failed validation came from, for the log line. */
export type BoundaryName = string;

/** Format a zod issue list into a single compact line. */
function summarize(error: unknown): string {
  const issues = (error as { issues?: { path: unknown[]; message: string }[] }).issues;
  if (!Array.isArray(issues)) return String(error);
  return issues
    .map(i => `${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`)
    .join('; ');
}

/** Validate `data` against `schema`. On failure: log a structured warning and rethrow, so the caller's existing throw-path fires but the cause is visible. */
export function parseOrThrow<T>(where: BoundaryName, schema: ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  console.warn(`[boundary:${where}] validation failed -> ${summarize(r.error)}`);
  throw new Error(`[boundary:${where}] invalid payload: ${summarize(r.error)}`);
}

/** Validate `data` against `schema`. On failure: log a structured warning and return null, so a graceful-degradation caller can fall back WITHOUT the drift vanishing silently (the whole point of this layer). */
export function parseOrNull<T>(where: BoundaryName, schema: ZodType<T>, data: unknown): T | null {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  console.warn(`[boundary:${where}] validation failed -> ${summarize(r.error)}`);
  return null;
}
