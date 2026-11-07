export function isBrowserExtension(): boolean {
  return typeof location !== 'undefined' && location.protocol === 'chrome-extension:';
}
