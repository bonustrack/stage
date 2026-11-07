import { includesKey, uniqueKeys } from '../collections';
import { validMemberAddresses } from './groups';

export const MAX_LABELS = 16;
export const MAX_LABEL_LEN = 24;

export class LabelPermissionError extends Error {
  constructor(what = 'labels') {
    super(`You don't have permission to edit ${what} in this channel.`);
    this.name = 'LabelPermissionError';
  }
}

export function cleanLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, MAX_LABEL_LEN);
}

export function parseObject(raw: string | undefined): Record<string, unknown> | null {
  if (raw === undefined) return null;
  if (!raw.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

export function labelsOf(raw: unknown): string[] {
  return uniqueKeys(stringList(raw).map(cleanLabel).filter(Boolean)).slice(0, MAX_LABELS);
}

export function categoryOf(value: unknown): string | null {
  return typeof value === 'string' ? cleanLabel(value) || null : null;
}

export const CHANNEL_PRIORITIES = ['Urgent', 'High', 'Medium', 'Low'] as const;
export type ChannelPriority = (typeof CHANNEL_PRIORITIES)[number];

export function priorityOf(value: unknown): ChannelPriority | null {
  return CHANNEL_PRIORITIES.find((priority) => priority === categoryOf(value)) ?? null;
}

export function addLabel(labels: string[], label: string): string[] {
  const clean = cleanLabel(label);
  if (!clean) return labels;
  if (includesKey(labels, clean) || labels.length >= MAX_LABELS) return labels;
  return [...labels, clean];
}

export function removeLabel(labels: string[], label: string): string[] {
  const target = cleanLabel(label).toLowerCase();
  return labels.filter((l) => l.toLowerCase() !== target);
}

export function moveLabel(labels: string[], from: string | null, to: string | null): string[] {
  if (to === null) return [];
  return addLabel(from === null ? labels : removeLabel(labels, from), to);
}

export function renameLabels(labels: string[], from: string, to: string): string[] {
  const clean = cleanLabel(to);
  const names = new Set([from, clean].map((name) => cleanLabel(name).toLowerCase()));
  const at = labels.findIndex((l) => names.has(l.toLowerCase()));
  if (!clean || at === -1) return labels;
  return labels.flatMap((l, i) => {
    if (i === at) return [clean];
    return names.has(l.toLowerCase()) ? [] : [l];
  });
}

export function assignedAddresses(value: unknown): string[] {
  return [...new Set(validMemberAddresses(stringList(value)).map((address) => address.toLowerCase()))];
}
