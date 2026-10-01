import type { FrameNode, FrameNodeType } from './frame.schema';

export type FrameAxis = 'row' | 'col';

export interface FrameFlow {
  direction: FrameAxis;
  filled: boolean;
}

export const FRAME_ROOT_FLOW: FrameFlow = { direction: 'col', filled: false };

const ROW_TYPES: ReadonlySet<FrameNodeType> = new Set(['Row', 'ListViewItem']);
const COL_TYPES: ReadonlySet<FrameNodeType> = new Set(['Col', 'Card', 'Table.Cell']);
const DIRECTED_TYPES: ReadonlySet<FrameNodeType> = new Set(['Box', 'Form', 'Basic']);
const FILL_TYPES: ReadonlySet<FrameNodeType> = new Set(['Box', 'Row', 'Col', 'Form']);

function axisOf(node: FrameNode): FrameAxis | undefined {
  if (node.type === 'Chart' || node.type === 'Unsupported') return undefined;
  if (ROW_TYPES.has(node.type)) return 'row';
  if (COL_TYPES.has(node.type)) return 'col';
  if (!DIRECTED_TYPES.has(node.type)) return undefined;
  return (node.props as { direction?: FrameAxis }).direction === 'row' ? 'row' : 'col';
}

function hasBackground(node: FrameNode): boolean {
  if (node.type === 'Chart' || node.type === 'Unsupported' || !FILL_TYPES.has(node.type)) return false;
  return (node.props as { background?: unknown }).background !== undefined;
}

export function frameChildFlow(node: FrameNode, parent: FrameFlow): FrameFlow | undefined {
  const direction = axisOf(node);
  if (direction === undefined) return undefined;
  if (node.type === 'Card') return { direction, filled: false };
  return { direction, filled: parent.filled || hasBackground(node) };
}

export type FrameFieldVariant = 'solid' | 'soft' | 'outline' | 'ghost';

export interface FrameFieldStyle {
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number;
  minWidth?: number;
  alignSelf?: 'stretch';
  backgroundColor?: 'transparent';
}

const GROW_IN_ROW: FrameFieldStyle = { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 };
const GROW_IN_COL: FrameFieldStyle = { alignSelf: 'stretch' };

export function frameFieldStyle(flow: FrameFlow, grow: boolean, variant: FrameFieldVariant | undefined): FrameFieldStyle {
  const size = grow ? (flow.direction === 'row' ? GROW_IN_ROW : GROW_IN_COL) : {};
  const blend = variant === 'ghost' || (flow.filled && (variant === undefined || variant === 'soft'));
  return blend ? { ...size, backgroundColor: 'transparent' } : size;
}

export function frameSpacerStyle(direction: FrameAxis, minSize: number | string | undefined): { minWidth?: number | string; minHeight?: number | string } {
  if (minSize === undefined) return {};
  return direction === 'row' ? { minWidth: minSize } : { minHeight: minSize };
}

type Length = number | string;

interface BlockSize {
  minSize?: Length;
  maxSize?: Length;
  minWidth?: Length;
  minHeight?: Length;
  maxWidth?: Length;
  maxHeight?: Length;
}

export function frameBlockSize<T extends BlockSize>(props: T): Omit<T, 'minSize' | 'maxSize'> {
  const { minSize, maxSize, ...rest } = props;
  return {
    ...rest,
    minWidth: rest.minWidth ?? minSize,
    minHeight: rest.minHeight ?? minSize,
    maxWidth: rest.maxWidth ?? maxSize,
    maxHeight: rest.maxHeight ?? maxSize,
  };
}
