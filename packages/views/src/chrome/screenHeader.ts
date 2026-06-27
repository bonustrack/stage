import type {
  Color,
  FontWeight,
  RowNode,
  TextSize,
  TitleSize,
  WidgetNode,
} from '@stage-labs/kit/kit';
import { SCREEN_BACK } from '../actions';
import { compactList } from '../node';

export type ScreenHeaderTitle =
  | {
      kind: 'text';
      size?: TextSize;
      weight?: FontWeight;
      color?: Color;
      truncate?: boolean;
      maxLines?: number;
    }
  | {
      kind: 'title';
      size?: TitleSize;
      weight?: FontWeight;
      color?: Color;
      truncate?: boolean;
      maxLines?: number;
      flex?: boolean;
    };

export interface ScreenHeaderParams {
  title?: string;
  titleStyle?: ScreenHeaderTitle;
  backColor: Color;
  backType?: string;
  backPayload?: Record<string, unknown>;
  backHitSlop?: number;
  backPadding?: number;
  safeTop?: number;
  padTop?: number;
  padBottom?: number;
  surface?: Color;
  borderColor?: Color;
  trailing?: WidgetNode[];
  variant?: 'bar' | 'overlay';
  fixedHeight?: number;
  zIndex?: number;
}

function titleNode(label: string, style: ScreenHeaderTitle): WidgetNode {
  if (style.kind === 'title') {
    return {
      type: 'Title',
      value: label,
      size: style.size,
      weight: style.weight,
      color: style.color,
      truncate: style.truncate,
      maxLines: style.maxLines,
      flex: style.flex ? 1 : undefined,
    };
  }
  return {
    type: 'Text',
    value: label,
    size: style.size,
    weight: style.weight,
    color: style.color,
    truncate: style.truncate,
    maxLines: style.maxLines,
    flex: 1,
  };
}

function backNode(params: ScreenHeaderParams): WidgetNode {
  return {
    type: 'Pressable',
    hitSlop: params.backHitSlop ?? 8,
    onClickAction: {
      type: params.backType ?? SCREEN_BACK,
      payload: params.backPayload,
    },
    children: [
      {
        type: 'Box',
        padding: params.backPadding ?? 4,
        children: [
          { type: 'Icon', name: 'arrowLeft', size: 22, color: params.backColor },
        ],
      },
    ],
  };
}

function overlayHeader(params: ScreenHeaderParams): RowNode {
  const safeTop = params.safeTop ?? 0;
  const trailing = params.trailing ?? [];
  return {
    type: 'Row',
    align: 'center',
    justify: 'between',
    background: params.surface,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: params.zIndex ?? 2,
    height: params.fixedHeight ?? 44 + safeTop,
    padding: { x: 14, top: safeTop },
    border: params.borderColor
      ? { bottom: { size: 1, color: params.borderColor } }
      : undefined,
    children: compactList<WidgetNode>([backNode(params), ...trailing]),
  };
}

function barTitleNode(params: ScreenHeaderParams): WidgetNode | undefined {
  if (params.title === undefined || params.title === '') return undefined;
  if (params.titleStyle === undefined) return undefined;
  return titleNode(params.title, params.titleStyle);
}

function barHeader(params: ScreenHeaderParams): RowNode {
  const titled = barTitleNode(params);
  const hasTitle = titled !== undefined;
  const children = compactList<WidgetNode>([
    backNode(params),
    titled,
    ...(params.trailing ?? []),
  ]);
  return {
    type: 'Row',
    align: 'center',
    justify: hasTitle ? undefined : 'between',
    gap: 8,
    background: params.surface,
    padding: {
      x: 12,
      top: (params.padTop ?? 8) + (params.safeTop ?? 0),
      bottom: params.padBottom ?? 10,
    },
    border: params.borderColor
      ? { bottom: { size: 1, color: params.borderColor } }
      : undefined,
    children,
  };
}

export function screenHeader(params: ScreenHeaderParams): RowNode {
  return params.variant === 'overlay' ? overlayHeader(params) : barHeader(params);
}
