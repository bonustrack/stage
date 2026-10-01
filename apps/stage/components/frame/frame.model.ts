import type { HistoryEntry } from '@stage-labs/client/types';
import { frameActionSchema, frameContentSchema, type FrameActionContent, type FrameContent } from '@stage-labs/client/xmtp/frame.schema';
import {
  frameSummary, parseFrameDoc, resolveFrameColor, type FrameAction, type FrameColor, type FrameDocResult, type FrameFill,
  type FrameNode,
} from '@stage-labs/kit/frame';
import { kitPalette, type KitPalette, type Scheme } from '@stage-labs/kit/tokens';
import { ATTACHMENT_MAX_HEIGHT } from '../bubble/imageBox.model';

export const FRAME_ROUTE = '/frame';

export const FRAME_PREVIEW_BORDER = 1;
export const FRAME_PREVIEW_FADE = 48;
export const FRAME_PREVIEW_FILL: FrameFill = { padding: 12 };

export interface FrameLink {
  pathname: typeof FRAME_ROUTE;
  params: { convId: string; id: string };
}

export interface FrameCardModel {
  title: string;
  description?: string;
}

export function frameOf(entry: HistoryEntry | undefined): FrameContent | null {
  const frame = (entry?.payload as { frame?: unknown } | undefined)?.frame;
  if (frame === undefined) return null;
  const parsed = frameContentSchema.safeParse(frame);
  return parsed.success ? parsed.data : null;
}

function filled(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

export function frameInputOf(frame: FrameContent): unknown {
  return frame.screens === undefined ? frame.widget : { screens: frame.screens, start: frame.start };
}

function startRootOf(frame: FrameContent): FrameNode | undefined {
  const parsed = parseFrameDoc(frameInputOf(frame));
  return parsed.ok ? parsed.doc.screens.get(parsed.doc.start)?.root : undefined;
}

export function frameCardModel(frame: FrameContent): FrameCardModel {
  const root = startRootOf(frame);
  const derived = root === undefined ? {} : frameSummary(root);
  const title = filled(frame.title) ?? filled(derived.title) ?? 'Frame';
  const description = filled(frame.description) ?? filled(derived.description);
  return description === undefined || description === title ? { title } : { title, description };
}

export function frameLinkOf(convId: string, messageId: string): FrameLink {
  return { pathname: FRAME_ROUTE, params: { convId, id: messageId } };
}

export function frameActionContent(frameId: string, action: FrameAction, label: string | undefined): FrameActionContent | null {
  const name = filled(label);
  const act = action.payload === undefined ? { type: action.type } : { type: action.type, payload: action.payload };
  const parsed = frameActionSchema.safeParse(name === undefined ? { frameId, action: act } : { frameId, action: act, label: name });
  return parsed.success ? parsed.data : null;
}

export function frameScreenTitle(frame: FrameContent, parsed: FrameDocResult, screen: string): string {
  return (parsed.ok ? parsed.doc.screens.get(screen)?.title : undefined) ?? frameCardModel(frame).title;
}

function rootLookOf(root: FrameNode | undefined): { theme?: Scheme; background?: FrameColor } {
  if (root?.type === 'Card' || root?.type === 'Basic') return { theme: root.props.theme, background: root.props.background };
  return root?.type === 'ListView' ? { theme: root.props.theme } : {};
}

export function frameBackdrop(frame: FrameContent, scheme: Scheme, palette: KitPalette): string {
  const { theme = scheme, background } = rootLookOf(startRootOf(frame));
  const own = theme === scheme ? palette : kitPalette(theme);
  return resolveFrameColor(background, theme, own) ?? own.bg;
}

export function framePreviewClipped(contentHeight: number): boolean {
  return contentHeight > ATTACHMENT_MAX_HEIGHT - 2 * FRAME_PREVIEW_BORDER;
}
