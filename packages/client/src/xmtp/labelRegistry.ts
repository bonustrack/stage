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

function outranks(a: LabelEntry, b: LabelEntry): boolean {
  return a.at !== b.at ? a.at > b.at : a.id < b.id;
}

function claim(index: Map<string, LabelEntry>, key: string, entry: LabelEntry): void {
  const held = index.get(key);
  if (held === undefined || outranks(entry, held)) index.set(key, entry);
}

export function labelIndex(entries: readonly LabelEntry[]): LabelIndex {
  const byName = new Map<string, LabelEntry>();
  const byAlias = new Map<string, LabelEntry>();
  for (const entry of entries) {
    claim(byName, labelKey(entry.name), entry);
    for (const alias of entry.aliases) claim(byAlias, labelKey(alias), entry);
  }
  return new Map([...byAlias, ...byName]);
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
  return a.at !== b.at ? a.at > b.at : a.name < b.name;
}

function combine(a: LabelEntry, b: LabelEntry): LabelEntry {
  const [win, lose] = newer(a, b) ? [a, b] : [b, a];
  return { ...win, aliases: aliasList([...lose.aliases, lose.name, ...win.aliases], win.name) };
}

function settled(entries: readonly LabelEntry[]): LabelEntry[] {
  const byId = new Map<string, LabelEntry>();
  for (const entry of entries) {
    const current = byId.get(entry.id);
    byId.set(entry.id, current === undefined ? entry : combine(current, entry));
  }
  const unique = [...byId.values()];
  const renamed = new Set(unique.filter(e => e.at > 0).flatMap(labelNames).map(labelKey));
  return unique
    .filter(e => e.at > 0 || !renamed.has(labelKey(e.name)))
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .slice(0, MAX_LABEL_ENTRIES);
}

export function mergeLabelEntries(local: readonly LabelEntry[], incoming: readonly LabelEntry[]): LabelEntry[] {
  return settled([...local, ...incoming]);
}

export function sameLabelEntries(a: readonly LabelEntry[], b: readonly LabelEntry[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function respelled(entry: LabelEntry, name: string): LabelEntry | null {
  const clean = cleanLabel(name);
  const derived = entry.at === 0 && entry.name === entry.id;
  return derived && clean !== entry.name && labelKey(clean) === entry.id ? { ...entry, name: clean } : null;
}

export function withLabelNames(entries: readonly LabelEntry[], names: readonly string[]): readonly LabelEntry[] {
  const byId = new Map(entries.map(e => [e.id, e]));
  let changed = false;
  for (const name of names) {
    if (labelKey(name) === '') continue;
    const entry = resolveLabel([...byId.values()], name);
    const known = byId.get(entry.id);
    const next = known === undefined ? (byId.size < MAX_LABEL_ENTRIES ? entry : null) : respelled(known, name);
    if (next === null) continue;
    byId.set(next.id, next);
    changed = true;
  }
  return changed ? settled([...byId.values()]) : entries;
}

export function renamedLabelEntries(
  entries: readonly LabelEntry[], entry: LabelEntry, name: string, at: number,
): LabelEntry[] {
  const clean = cleanLabel(name);
  const current = entries.find(e => e.id === entry.id) ?? entry;
  const renamed = { id: current.id, name: clean, aliases: aliasList([...current.aliases, current.name], clean), at };
  return settled([...entries.filter(e => e.id !== current.id), renamed]);
}
