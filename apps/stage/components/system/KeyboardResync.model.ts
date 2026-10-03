export const KEYBOARD_CHECK_MS = 500;
export const KEYBOARD_MISSES_TO_DROP = 2;

export function keyboardMisses(misses: number, keyboardShown: boolean, fieldFocused: boolean, appPaused: boolean): number {
  return keyboardShown || (fieldFocused && !appPaused) ? 0 : misses + 1;
}
