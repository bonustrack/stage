import type { Color, ColNode, WidgetNode } from '@stage-labs/kit/kit';
import { caption, col, markdown, text } from '../primitives';

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
        weight: segment.emphasized === true ? 'bold' : undefined,
        color: params.textColor,
      }),
    );
  }
  return [text(params.text ?? '', { color: params.textColor })];
}

function metaNodes(params: MessageBubbleParams): WidgetNode[] {
  const color = params.metaColor ?? 'secondary';
  const meta: WidgetNode[] = [];
  if (params.timestamp !== undefined && params.timestamp !== '') {
    meta.push(caption(params.timestamp, { color }));
  }
  if (params.status !== undefined && params.status !== '') {
    meta.push(caption(params.status, { color }));
  }
  return meta;
}

export function messageBubble(params: MessageBubbleParams): ColNode {
  const align = params.align === 'end' ? 'end' : 'start';
  const children: WidgetNode[] = [];
  if (params.authorName !== undefined && params.authorName !== '') {
    children.push(
      caption(params.authorName, { color: params.metaColor ?? 'secondary', weight: 'semibold' }),
    );
  }
  children.push(...bodyNodes(params));
  const meta = metaNodes(params);
  if (meta.length > 0) children.push(col(meta, { align }));
  return col(children, { gap: 2, align });
}
