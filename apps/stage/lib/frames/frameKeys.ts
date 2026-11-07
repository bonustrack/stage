export interface FrameKeys {
  session: string;
  stack: string;
}

export type FrameRef =
  | { kind: 'chat'; epoch: number; messageId: string }
  | { kind: 'widget'; widgetId: string }
  | { kind: 'linkPreview' | 'codePreview'; nodeKey: string };

function shared(key: string): FrameKeys {
  return { session: key, stack: key };
}

export function frameKeysOf(ref: FrameRef): FrameKeys {
  switch (ref.kind) {
    case 'chat':
      return { session: `${ref.epoch}:${ref.messageId}`, stack: ref.messageId };
    case 'widget':
      return shared(`live:${ref.widgetId}`);
    case 'linkPreview':
      return shared(`preview:${ref.nodeKey}`);
    case 'codePreview':
      return shared(`node:${ref.nodeKey}`);
  }
}
