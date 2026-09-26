import { z } from 'zod';
import { cleanLabel } from './labels';

export const MAX_LABEL_ENTRIES = 256;
export const MAX_LABEL_ALIASES = 16;

const nameSchema = z.string().min(1).max(64);

export const labelEntrySchema = z.object({
  id: nameSchema,
  name: nameSchema,
  aliases: z.array(nameSchema).max(MAX_LABEL_ALIASES),
  at: z.number().nonnegative(),
});

export type LabelEntry = z.infer<typeof labelEntrySchema>;

export const labelEntriesSchema = z.array(labelEntrySchema).max(MAX_LABEL_ENTRIES);

export function labelKey(name: string): string {
  return cleanLabel(name).toLowerCase();
}

function freeId(taken: ReadonlySet<string>, name: string): string {
  const base = labelKey(name);
  let id = base;
  for (let n = 2; taken.has(id); n += 1) id = `${base}~${n}`;
  return id;
}

export type LabelIndex = ReadonlyMap<string, LabelEntry>;

export function labelIndex(entries: readonly LabelEntry[]): LabelIndex {
  const index = new Map<string, LabelEntry>();
  for (const entry of entries) index.set(labelKey(entry.name), entry);
  for (const entry of entries) {
    for (const alias of entry.aliases) if (!index.has(labelKey(alias))) index.set(labelKey(alias), entry);
  }
  return index;
}

export function resolveLabel(entries: readonly LabelEntry[], name: string, index = labelIndex(entries)): LabelEntry {
  const known = index.get(labelKey(name));
  if (known !== undefined) return known;
  const clean = cleanLabel(name);
  return { id: freeId(new Set(entries.map(e => e.id)), clean), name: clean, aliases: [], at: 0 };
}

export function labelNames(entry: LabelEntry): string[] {
  return [entry.name, ...entry.aliases];
}

function aliasList(names: readonly string[], name: string): string[] {
  const seen = new Set([labelKey(name)]);
  const out: string[] = [];
  for (const alias of names) {
    const key = labelKey(alias);
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    out.push(cleanLabel(alias));
  }
  return out.slice(-MAX_LABEL_ALIASES);
}

function newer(a: LabelEntry, b: LabelEntry): boolean {
  if (a.at !== b.at) return a.at > b.at;
  return a.id === b.id ? a.name < b.name : a.id < b.id;
}

function combine(a: LabelEntry, b: LabelEntry): LabelEntry {
  const [win, lose] = newer(a, b) ? [a, b] : [b, a];
  return { ...win, aliases: aliasList([...lose.aliases, lose.name, ...win.aliases], win.name) };
}

function combinedBy(entries: readonly LabelEntry[], keyOf: (entry: LabelEntry) => string): LabelEntry[] {
  const byKey = new Map<string, LabelEntry>();
  for (const entry of entries) {
    const current = byKey.get(keyOf(entry));
    byKey.set(keyOf(entry), current === undefined ? entry : combine(current, entry));
  }
  return [...byKey.values()];
}

function settled(entries: readonly LabelEntry[]): LabelEntry[] {
  const unique = combinedBy(combinedBy(entries, e => e.id), e => labelKey(e.name));
  const names = new Set(unique.map(e => labelKey(e.name)));
  return unique
    .map(e => ({ ...e, aliases: e.aliases.filter(alias => !names.has(labelKey(alias))) }))
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .slice(0, MAX_LABEL_ENTRIES);
}

export function mergeLabelEntries(local: readonly LabelEntry[], incoming: readonly LabelEntry[]): LabelEntry[] {
  return settled([...local, ...incoming]);
}

export function sameLabelEntries(a: readonly LabelEntry[], b: readonly LabelEntry[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function withLabelNames(entries: readonly LabelEntry[], names: readonly string[]): readonly LabelEntry[] {
  const added: LabelEntry[] = [];
  for (const name of names) {
    const all = [...entries, ...added];
    if (labelKey(name) === '' || all.length >= MAX_LABEL_ENTRIES) continue;
    const entry = resolveLabel(all, name);
    if (!all.some(e => e.id === entry.id)) added.push(entry);
  }
  return added.length === 0 ? entries : settled([...entries, ...added]);
}

export function renamedLabelEntries(
  entries: readonly LabelEntry[], entry: LabelEntry, name: string, at: number,
): LabelEntry[] {
  const clean = cleanLabel(name);
  const current = entries.find(e => e.id === entry.id) ?? entry;
  const renamed = { id: current.id, name: clean, aliases: aliasList([...current.aliases, current.name], clean), at };
  return settled([...entries.filter(e => e.id !== current.id), renamed]);
}
