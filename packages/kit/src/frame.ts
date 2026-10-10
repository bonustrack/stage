import { isRecord, type FrameAction, type FrameSpacing } from './frame.values';
import { isFrameNodeType, schemaOf, type FrameNode, type FrameUnsupportedNode } from './frame.schema';

export type { FrameAction, FrameColor, FrameOption, FrameSpacing } from './frame.values';
export { resolveFrameColor, FRAME_SPACING_UNIT } from './frame.values';
export type { FrameIconName, FrameNode, FrameNodeOf, FrameNodeType } from './frame.schema';
export { FRAME_ICONS } from './frame.schema';

export const FRAME_LIMITS = {
  maxChars: 64 * 1024,
  maxDepth: 16,
  maxNodes: 500,
  maxChildren: 200,
  maxScreens: 50,
} as const;

const MAX_TYPE_NAME = 60;
const SUMMARY_SCAN = 80;
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export type FrameError = 'invalid' | 'too-large' | 'too-deep' | 'too-many-nodes' | 'too-many-screens';

export type FrameParseResult = { ok: true; root: FrameNode } | { ok: false; error: FrameError };

interface Walk {
  nodes: number;
  error?: FrameError;
}

function jsonChars(raw: unknown): number | undefined {
  try {
    return JSON.stringify(raw)?.length;
  } catch {
    return undefined;
  }
}

function unsupported(name: string): FrameUnsupportedNode {
  return { type: 'Unsupported', props: { name: name.slice(0, MAX_TYPE_NAME) }, children: [] };
}

function pickProps(raw: Record<string, unknown>, schema: Record<string, (v: unknown) => unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, validate] of Object.entries(schema)) {
    const value = validate(raw[key]);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function childList(raw: unknown, kind: 'nodes' | 'single' | undefined): unknown[] {
  if (kind === 'single') return Array.isArray(raw) ? raw.slice(0, 1) : raw === undefined ? [] : [raw];
  if (kind === 'nodes' && Array.isArray(raw)) return raw.slice(0, FRAME_LIMITS.maxChildren);
  return [];
}

function overLimit(depth: number, walk: Walk): boolean {
  walk.nodes += 1;
  if (walk.nodes > FRAME_LIMITS.maxNodes) walk.error ??= 'too-many-nodes';
  if (depth > FRAME_LIMITS.maxDepth) walk.error ??= 'too-deep';
  return walk.error !== undefined;
}

function normalizeNode(raw: unknown, depth: number, walk: Walk): FrameNode {
  if (overLimit(depth, walk)) return unsupported('');
  if (!isRecord(raw) || typeof raw.type !== 'string') return unsupported('');
  if (!isFrameNodeType(raw.type)) return unsupported(raw.type);
  const schema = schemaOf(raw.type);
  const props = pickProps(raw, schema.props);
  if (schema.required?.some((key) => props[key] === undefined) === true) return unsupported(raw.type);
  const children = childList(raw.children, schema.children).map((c) => normalizeNode(c, depth + 1, walk));
  return { type: raw.type, props, children } as FrameNode;
}

export function parseFrame(raw: unknown): FrameParseResult {
  const chars = jsonChars(raw);
  if (chars === undefined || !isRecord(raw)) return { ok: false, error: 'invalid' };
  if (chars > FRAME_LIMITS.maxChars) return { ok: false, error: 'too-large' };
  const walk: Walk = { nodes: 0 };
  const root = normalizeNode(raw, 0, walk);
  return walk.error === undefined ? { ok: true, root } : { ok: false, error: walk.error };
}

export const FRAME_OPEN = 'frame.open';
export const FRAME_BACK = 'frame.back';

const MAX_SCREEN_ID = 120;
const MAX_SCREEN_TITLE = 200;
const MAX_STACK = 50;
const INDEX_KEY = /^(?:0|[1-9]\d*)$/;

export interface FrameScreen {
  title?: string;
  root: FrameNode;
}

export interface FrameDoc {
  start: string;
  screens: ReadonlyMap<string, FrameScreen>;
  multi: boolean;
}

export type FrameDocResult = { ok: true; doc: FrameDoc } | { ok: false; error: FrameError };

export type FrameNav = { kind: 'open'; screen: string } | { kind: 'back' };

function screenTitle(raw: unknown): string | undefined {
  const title = typeof raw === 'string' ? raw.trim().slice(0, MAX_SCREEN_TITLE) : '';
  return title === '' ? undefined : title;
}

function parseScreen(raw: unknown): FrameParseResult & { title?: string } {
  const wrapped = isRecord(raw) && isRecord(raw.widget) && raw.type === undefined;
  const parsed = parseFrame(wrapped ? raw.widget : raw);
  const title = wrapped ? screenTitle(raw.title) : undefined;
  return parsed.ok && title !== undefined ? { ...parsed, title } : parsed;
}

function screenEntries(raw: Record<string, unknown>): [string, unknown][] | FrameError {
  const chars = jsonChars(raw);
  if (chars === undefined) return 'invalid';
  if (chars > FRAME_LIMITS.maxChars) return 'too-large';
  const entries = Object.entries(raw).filter(([id]) => id !== '' && id.length <= MAX_SCREEN_ID);
  if (entries.length === 0) return 'invalid';
  return entries.length > FRAME_LIMITS.maxScreens ? 'too-many-screens' : entries;
}

function parseScreens(raw: Record<string, unknown>, start: unknown): FrameDocResult {
  const entries = screenEntries(raw);
  if (typeof entries === 'string') return { ok: false, error: entries };
  const screens = new Map<string, FrameScreen>();
  for (const [id, value] of entries) {
    const parsed = parseScreen(value);
    if (!parsed.ok) return parsed;
    screens.set(id, parsed.title === undefined ? { root: parsed.root } : { title: parsed.title, root: parsed.root });
  }
  const first = (entries.find(([id]) => !INDEX_KEY.test(id)) ?? entries[0])?.[0] ?? '';
  return { ok: true, doc: { start: typeof start === 'string' ? start : first, screens, multi: true } };
}

export function parseFrameDoc(raw: unknown): FrameDocResult {
  if (isRecord(raw) && raw.type === undefined && isRecord(raw.screens)) return parseScreens(raw.screens, raw.start);
  const parsed = parseFrame(raw);
  if (!parsed.ok) return parsed;
  return { ok: true, doc: { start: '', screens: new Map([['', { root: parsed.root }]]), multi: false } };
}

export function frameNavOf(action: FrameAction | undefined): FrameNav | undefined {
  if (action?.type === FRAME_BACK) return { kind: 'back' };
  if (action?.type !== FRAME_OPEN) return undefined;
  const screen = action.payload?.screen;
  return { kind: 'open', screen: typeof screen === 'string' ? screen : '' };
}

export function navigateFrame(stack: readonly string[], nav: FrameNav): readonly string[] {
  if (nav.kind === 'back') return stack.length > 1 ? stack.slice(0, -1) : stack;
  if (stack[stack.length - 1] === nav.screen) return stack;
  const next = [...stack, nav.screen];
  return next.length > MAX_STACK ? next.slice(0, 1).concat(next.slice(1 - MAX_STACK)) : next;
}

export function withScreen(action: FrameAction, screen: string): FrameAction {
  return { type: action.type, payload: { screen, ...action.payload } };
}

export interface FrameSummary {
  title?: string;
  description?: string;
}

const SUMMARY_TEXT_MAX = 400;

function plainText(value: string): string {
  return value
    .slice(0, SUMMARY_TEXT_MAX)
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*(?:#{1,6}|>)\s*/gm, '')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectTexts(root: FrameNode): { titles: string[]; texts: string[] } {
  const titles: string[] = [];
  const texts: string[] = [];
  const stack: FrameNode[] = [root];
  for (let seen = 0; stack.length > 0 && seen < SUMMARY_SCAN; seen += 1) {
    const node = stack.pop();
    if (node === undefined) break;
    if (node.type === 'Title') titles.push(plainText(node.props.value ?? ''));
    if (node.type === 'Text' || node.type === 'Caption' || node.type === 'Markdown') {
      texts.push(plainText(node.props.value ?? ''));
    }
    stack.push(...[...node.children].reverse());
  }
  return { titles: titles.filter(Boolean), texts: texts.filter(Boolean) };
}

export function frameSummary(root: FrameNode): FrameSummary {
  const { titles, texts } = collectTexts(root);
  const title = titles[0] ?? texts[0];
  const description = texts.find((t) => t !== title);
  return { title, description };
}

function setPath(target: Record<string, unknown>, path: string[], value: unknown): void {
  const [head, ...rest] = path;
  if (head === undefined || head === '' || UNSAFE_KEYS.has(head)) return;
  if (rest.length === 0) {
    if (!Object.hasOwn(target, head)) target[head] = value;
    return;
  }
  const existing = Object.hasOwn(target, head) ? target[head] : undefined;
  if (existing !== undefined && !isRecord(existing)) return;
  const next: Record<string, unknown> = existing === undefined ? {} : { ...existing };
  setPath(next, rest, value);
  target[head] = next;
}

export function withFormValues(action: FrameAction, values: Readonly<Record<string, unknown>>): FrameAction {
  const names = Object.keys(values);
  if (names.length === 0) return action;
  const payload: Record<string, unknown> = { ...action.payload };
  for (const name of names) setPath(payload, name.split('.'), values[name]);
  return { type: action.type, payload };
}

export function missingRequired(required: Iterable<string>, values: Readonly<Record<string, unknown>>): string[] {
  return [...required].filter((name) => {
    const v = values[name];
    return v === undefined || v === null || v === '' || v === false;
  });
}

export interface FrameFill {
  padding: number;
  insetBottom?: number;
}

export function frameFillPadding(padding: FrameSpacing | undefined, fill: FrameFill): FrameSpacing {
  const own = padding ?? { top: fill.padding, right: fill.padding, bottom: fill.padding, left: fill.padding };
  return { ...own, bottom: (own.bottom ?? 0) + (fill.insetBottom ?? 0) };
}

type FrameFlex = Readonly<{ flexShrink: 0 | 1; minWidth?: 0 }>;

const SHRINK: FrameFlex = { flexShrink: 1, minWidth: 0 };
const SHRINK_OWN_MIN: FrameFlex = { flexShrink: 1 };
const KEEP: FrameFlex = { flexShrink: 0 };
const BOX_TYPES: ReadonlySet<FrameNode['type']> = new Set(['Box', 'Row', 'Col', 'Form', 'Chart']);
const KEEP_MAX_CHARS = 12;

function keepsWidth(value: string): boolean {
  const word = value.trim();
  return word.length <= KEEP_MAX_CHARS && !/\s/.test(word);
}

function hasOwnMinWidth(props: object): boolean {
  return ('minWidth' in props && props.minWidth !== undefined) || ('minSize' in props && props.minSize !== undefined);
}

export function frameFlex(node: FrameNode): FrameFlex {
  if (BOX_TYPES.has(node.type)) return hasOwnMinWidth(node.props) ? SHRINK_OWN_MIN : SHRINK;
  const value = 'value' in node.props ? node.props.value : undefined;
  return typeof value === 'string' && !keepsWidth(value) ? SHRINK : KEEP;
}
