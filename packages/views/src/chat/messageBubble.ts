import type { Color, ColNode, WidgetNode } from '@stage-labs/kit/kit';
import { compactList } from '../node';
import { markdown, text } from '../primitives';
import { HIGHLIGHT_BG } from '../colors';

export interface BubbleSegment {
  text: string;
  emphasized?: boolean;
}

export interface MessageBubbleParams {
  align: 'start' | 'end';
  text?: string;
  markdown?: string;
  segments?: BubbleSegment[];
  status?: string;
  timestamp?: string;
  authorName?: string;
  textColor?: Color;
  metaColor?: Color;
}

function bodyNodes(params: MessageBubbleParams): WidgetNode[] {
  if (params.markdown !== undefined && params.markdown !== '') {
    return [markdown(params.markdown)];
  }
  if (params.segments !== undefined && params.segments.length > 0) {
    return params.segments.map((segment) =>
      text(segment.text, {
        background: segment.emphasized === true ? HIGHLIGHT_BG : undefined,
        color: params.textColor,
      }),
    );
  }
  return [text(params.text ?? '', { color: params.textColor })];
}

function metaValues(params: MessageBubbleParams): string[] {
  const meta: string[] = [];
  if (params.timestamp !== undefined && params.timestamp !== '') {
    meta.push(params.timestamp);
  }
  if (params.status !== undefined && params.status !== '') {
    meta.push(params.status);
  }
  return meta;
}

export function messageBubble(params: MessageBubbleParams): ColNode {
  const align = params.align === 'end' ? 'end' : 'start';
  const metaColor = params.metaColor ?? 'secondary';
  const meta = metaValues(params);
  const hasAuthor = params.authorName !== undefined && params.authorName !== '';
  const children = compactList<WidgetNode>([
    hasAuthor
      ? {
          type: 'Caption',
          value: params.authorName ?? '',
          color: metaColor,
          weight: 'semibold',
        }
      : undefined,
    ...bodyNodes(params),
    meta.length > 0
      ? {
          type: 'Col',
          align,
          children: meta.map((value) => ({
            type: 'Caption',
            value,
            color: metaColor,
          })),
        }
      : undefined,
  ]);
  return { type: 'Col', gap: 2, align, children };
}
