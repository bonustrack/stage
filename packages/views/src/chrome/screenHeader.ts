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
  title: string;
  titleStyle: ScreenHeaderTitle;
  backColor: Color;
  backType?: string;
  backPayload?: Record<string, unknown>;
  safeTop?: number;
  padTop?: number;
  padBottom?: number;
  surface?: Color;
  borderColor?: Color;
  trailing?: WidgetNode[];
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

export function screenHeader(params: ScreenHeaderParams): RowNode {
  const back: WidgetNode = {
    type: 'Pressable',
    hitSlop: 8,
    onClickAction: {
      type: params.backType ?? SCREEN_BACK,
      payload: params.backPayload,
    },
    children: [
      {
        type: 'Box',
        padding: 4,
        children: [
          { type: 'Icon', name: 'arrowLeft', size: 22, color: params.backColor },
        ],
      },
    ],
  };
  const children = compactList<WidgetNode>([
    back,
    titleNode(params.title, params.titleStyle),
    ...(params.trailing ?? []),
  ]);
  return {
    type: 'Row',
    align: 'center',
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
