const CONTROL_BODY_PREFIX = 'METRO_CTRL:';

export function isControlBody(text: unknown): boolean {
  return typeof text === 'string' && text.startsWith(CONTROL_BODY_PREFIX);
}
