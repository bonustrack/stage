import type { Color, ColNode, WidgetNode } from '@stage-labs/kit/kit';
import view from './messageBubble.json';
import { buildView } from '../buildView';
import { markdown, text } from '../primitives';

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
  return (buildView(view, {
    align,
    metaColor,
    metaTextColor: metaColor,
    authorName: params.authorName,
    hasAuthor:
      (params.authorName !== undefined && params.authorName !== '') || undefined,
    body: bodyNodes(params),
    meta,
    hasMeta: meta.length > 0 || undefined,
  }) as ColNode);
}
