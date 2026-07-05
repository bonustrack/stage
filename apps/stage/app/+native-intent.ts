
function isLaunchUrl(path: string): boolean {
  const url = path.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\/expo-development-client(\/|\?|$)/i.test(url)) return true;
  if (/^exp(\+[a-z0-9.-]+)?:\/\//i.test(url) && !url.includes('/--/')) return true;
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^?#]*)/i.exec(url);
  if (m) {
    const authorityAndPath = (m[1] ?? '').replace(/\/+$/, '');
    if (authorityAndPath === '') return true;
  }
  return false;
}

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return isLaunchUrl(path) ? '/' : path;
}
