export const KEYBOARD_SETTLE_MS = 600;

export function keyboardLiftIsStale(keyboardVisible: boolean, height: number, progress: number): boolean {
  return !keyboardVisible && (height !== 0 || progress !== 0);
}
