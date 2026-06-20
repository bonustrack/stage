
import type { ZodType } from 'zod';

export type BoundaryName = string;

function summarize(error: unknown): string {
  const issues = (error as { issues?: { path: unknown[]; message: string }[] }).issues;
  if (!Array.isArray(issues)) return String(error);
  return issues
    .map(i => `${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`)
    .join('; ');
}

export function parseOrThrow<T>(where: BoundaryName, schema: ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  console.warn(`[boundary:${where}] validation failed -> ${summarize(r.error)}`);
  throw new Error(`[boundary:${where}] invalid payload: ${summarize(r.error)}`);
}

export function parseOrNull<T>(where: BoundaryName, schema: ZodType<T>, data: unknown): T | null {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  console.warn(`[boundary:${where}] validation failed -> ${summarize(r.error)}`);
  return null;
}
