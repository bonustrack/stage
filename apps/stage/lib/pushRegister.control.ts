const METRO_CTRL_PREFIX = 'METRO_CTRL:';

export function isMetroControlBody(text: unknown): boolean {
  return typeof text === 'string' && text.startsWith(METRO_CTRL_PREFIX);
}
