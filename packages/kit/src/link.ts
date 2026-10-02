export const NEW_TAB = { target: '_blank', rel: 'noopener noreferrer' } as const;

export interface LinkClickEvent {
  defaultPrevented: boolean;
  preventDefault(): void;
  button?: number;
  metaKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
}

export function isPlainClick(event?: LinkClickEvent): boolean {
  if (!event) return true;
  return !event.defaultPrevented && !event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey
    && (event.button === undefined || event.button === 0);
}
